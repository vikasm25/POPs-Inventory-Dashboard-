#!/usr/bin/env python3
"""Synchronize official EDGAR v8.1 annual national POPs tables into static JSON.

Dependencies: requests, beautifulsoup4, openpyxl. Python 3.11+.
Fail-closed: unexpected workbook layout / sector code / units raises instead of
publishing misleading data. Re-run after EDGAR updates its workbook schema.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sys
import time
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

SOURCE_PAGE = "https://edgar.jrc.ec.europa.eu/dataset_pop81"
DOI = "https://doi.org/10.2905/950c9f4b-19af-4071-a9e2-f1be34f3c438"
POLLUTANTS = ("PCB", "HCB", "PAH_BaP", "PAH_BbF", "PAH_BkF", "PAH_IcdP")
# PCDD/F is published in toxic-equivalent (TEQ) units, NOT tonnes of substance.
# Exclude until a dedicated TEQ-aware presentation and parser is implemented.
# Mappings based on the annual, sector-specific IPCC 2006 categories on
# https://edgar.jrc.ec.europa.eu/dataset_pop81 (do not map generic 1A blindly).
SECTOR_MAP = {
    "1A1a": "Power Industry",
    "1A1b+1A1ci+1A1cii+1A5biii+1B1b+1B2aiii6+1B2biii3+1B1c": "Fuel Exploitation",
    "1A2": "Industrial Combustion",
    "1A3b": "Transport",
    "1A3c+1A3e": "Transport",
    "1A3d": "Transport",
    "1A4+1A5": "Buildings",
    "2C1+2C2": "Processes",
    "2C3+2C4+2C5+2C6+2C7": "Processes",
    "3C1b": "Agriculture",
    "4C": "Waste",
}
FIELDS = ["country", "iso3", "year", "pollutant", "inventory",
          "emission_source", "emissions_tonnes_per_year", "unit"]
HEADERS = {"countrycodea3": "iso", "name": "country",
           "ipcccode2006forstandardreport": "code"}
MAX_ZIP_BYTES = 80 * 1024 * 1024
MAX_UNZIPPED_BYTES = 160 * 1024 * 1024
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "POPsAtlas-research-synchronizer/1.0 (source: GitHub Actions)",
                        "Accept": "text/html,application/zip,*/*"})

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def norm(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())

def cleaned(value: object) -> str:
    return str(value or "").strip()

def resolve_archives(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, str] = {}
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        for pollutant in POLLUTANTS:
            # Anchor href itself is the authoritative download link.
            needle = f"EDGAR_{pollutant}_1970_2024.zip"
            if needle.lower() in href.lower():
                url = urljoin(SOURCE_PAGE, href)
                host = (urlparse(url).hostname or "").lower()
                if not (host == "edgar.jrc.ec.europa.eu" or host == "jeodpp.jrc.ec.europa.eu"):
                    raise ValueError(f"Unexpected EDGAR host: {url}")
                if pollutant in found and found[pollutant] != url:
                    raise ValueError(f"Multiple archive URLs for {pollutant}")
                found[pollutant] = url
    missing = set(POLLUTANTS) - set(found)
    if missing:
        # EDGAR sometimes places download URLs in separate markup attributes:
        # do not guess, silently use historical links, or substitute grid files.
        raise ValueError(f"Could not find annual archives on EDGAR source page: {sorted(missing)}")
    return found

def fetch(url: str, is_html: bool = False) -> bytes:
    result = SESSION.get(url, timeout=(20, 180), stream=True, allow_redirects=True)
    result.raise_for_status()
    final_host = (urlparse(result.url).hostname or "").lower()
    if not (final_host == "edgar.jrc.ec.europa.eu"
            or final_host == "jeodpp.jrc.ec.europa.eu"):
        raise ValueError(f"Untrusted download redirect host: {final_host}")
    limit = 10 * 1024 * 1024 if is_html else MAX_ZIP_BYTES
    chunks, size = [], 0
    for block in result.iter_content(128 * 1024):
        if block:
            size += len(block)
            if size > limit:
                raise ValueError(f"Download exceeds size limit: {url}")
            chunks.append(block)
    return b"".join(chunks)

def workbooks(zip_bytes: bytes):
    if not zipfile.is_zipfile(io.BytesIO(zip_bytes)):
        raise ValueError("Remote file is not a ZIP archive")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        candidates = [n for n in z.namelist()
                      if n.lower().endswith(".xlsx") and not Path(n).name.startswith("~$")]
        if not candidates:
            raise ValueError("EDGAR archive contains no XLSX workbooks")
        total = sum(z.getinfo(n).file_size for n in candidates)
        if total > MAX_UNZIPPED_BYTES:
            raise ValueError("Uncompressed workbooks exceed size limit")
        for n in candidates:
            if n.startswith("/") or ".." in Path(n).parts:
                raise ValueError("Unsafe workbook path")
            yield n, z.read(n)

def workbook_rows(raw: bytes, pollutant: str):
    wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    try:
        sheet = next((s for s in wb.worksheets if "ipcc2006" in norm(s.title)), None)
        if sheet is None:
            raise ValueError(f"{pollutant}: missing IPCC 2006 worksheet, found {wb.sheetnames}")
        it = sheet.iter_rows(values_only=True)
        headers = None
        for row_no, row in enumerate(it, start=1):
            normed = [norm(c) for c in row]
            if set(HEADERS).issubset(set(normed)) and len([c for c in normed if re.fullmatch(r"y?(19|20)\d\d", c)]) >= 10:
                headers = {name: normed.index(name) for name in HEADERS}
                years = {}
                for i, c in enumerate(normed):
                    m = re.fullmatch(r"y?((?:19|20)\d\d)", c)
                    if m:
                        years[i] = int(m.group(1))
                break
            if row_no > 40:
                raise ValueError(f"{pollutant}: no recognizable data header in first 40 rows")
        if headers is None:
            raise ValueError(f"{pollutant}: missing annual country/sector headers")
        if min(years.values()) > 1970 or max(years.values()) < 2024:
            raise ValueError(f"{pollutant}: unexpected year coverage {min(years.values())}–{max(years.values())}")
        unknown = Counter()
        outputs = []
        for row in it:
            code = cleaned(row[headers["ipcccode2006forstandardreport"]])
            country = cleaned(row[headers["name"]])
            iso = cleaned(row[headers["countrycodea3"]]).upper()
            if not country or not code:
                continue
            # Skip explicitly labeled grand totals, never add them to country values.
            if norm(country) in {"total", "world", "global", "europeanunion",
                                 "europeanunion27", "europeanunion28"} or iso in {"WLD", "EU27", "EU28"}:
                continue
            if len(iso) != 3 or not iso.isalpha():
                raise ValueError(f"{pollutant}: non-country ISO code '{iso}' for {country}")
            if code not in SECTOR_MAP:
                unknown[code] += 1
                continue
            for j, year in years.items():
                value = row[j] if j < len(row) else None
                if value is None or cleaned(value) == "":
                    continue
                if not isinstance(value, (float, int)) or not math.isfinite(float(value)):
                    raise ValueError(f"{pollutant}: nonnumeric value {value!r} ({country}, {year}, {code})")
                if value < 0:
                    raise ValueError(f"{pollutant}: negative emissions ({country}, {year}, {code})")
                outputs.append((country, iso, year, SECTOR_MAP[code], float(value) * 1000))
        if unknown:
            raise ValueError(f"{pollutant}: unrecognized IPCC 2006 codes; refusing partial totals: {dict(unknown)}")
        if not outputs:
            raise ValueError(f"{pollutant}: no annual emissions recognized")
        return outputs
    finally:
        wb.close()

def collect(zip_bytes: bytes, pollutant: str):
    names, rows, hashes = [], [], {}
    for name, binary in workbooks(zip_bytes):
        names.append(name)
        hashes[name] = sha(binary)
        rows.extend(workbook_rows(binary, pollutant))
    # Aggregate only disjoint, validated IPCC 2006 source codes. Never double-count
    # duplicate entries from repeated workbook pages.
    dedup = {}
    for country, iso, year, sector, value in rows:
        # Multiple IPCC subcategories can map to a single high-level sector.
        # Each identical (country,year,sector) is summed but duplicate workbook
        # input names are not accepted, preventing exact duplicate file inflation.
        key = iso, year, sector
        current = dedup.setdefault(key, [country, iso, year, sector, 0.0])
        current[4] += value
    if len(set(names)) != len(names):
        raise ValueError("Duplicate workbook names inside archive")
    results = [v for v in dedup.values() if v[4] > 0]  # positive observations
    if not results:
        raise ValueError(f"{pollutant}: all aggregate values were zero")
    return sorted(results, key=lambda r: (r[2], r[1], r[3])), hashes

def build(output: Path, only: set[str] | None = None):
    output.mkdir(parents=True, exist_ok=True)
    html = fetch(SOURCE_PAGE, is_html=True).decode("utf-8")
    urls = resolve_archives(html)
    old_path = output / "manifest.json"
    previous = json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {}
    entries, any_change = {}, False
    for pollutant in POLLUTANTS:
        if only is not None and pollutant not in only:
            if pollutant in previous.get("pollutants", {}):
                entries[pollutant] = previous["pollutants"][pollutant]
            continue
        archive = fetch(urls[pollutant])
        digest = sha(archive)
        target = output / f"{pollutant}.json"
        prior = previous.get("pollutants", {}).get(pollutant, {})
        if digest == prior.get("archive_sha256") and target.exists():
            entries[pollutant] = prior
            print(f"{pollutant}: unchanged")
            continue
        rows, workbook_hashes = collect(archive, pollutant)
        obj = {
            "schema": 1,
            "inventory": "EDGAR",
            "release": "v8.1",
            "pollutant": pollutant,
            "chemical_note": ("Aggregate, unintentional PCB emissions; NOT PCB-28."
                              if pollutant == "PCB" else "See official EDGAR substance definition."),
            "units": "tonnes/year",
            "field_order": ["country", "iso3", "year", "emission_source", "emissions_tonnes_per_year"],
            "records": rows,
        }
        payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        target.write_text(payload + "\n", encoding="utf-8")
        years = sorted({r[2] for r in rows})
        entries[pollutant] = {
            "path": f"data/edgar/{pollutant}.json",
            "archive_url": urls[pollutant],
            "archive_sha256": digest,
            "workbook_sha256": workbook_hashes,
            "records": len(rows),
            "years": [min(years), max(years)],
            "units": "tonnes/year",
            "note": obj["chemical_note"],
        }
        any_change = True
        print(f"{pollutant}: {len(rows):,} validated records · {min(years)}–{max(years)}")
        time.sleep(1.0)
    if not entries:
        raise ValueError("No archives processed")
    manifest = {
        "schema": 1,
        "inventory": "EDGAR",
        "release": "v8.1",
        "source": SOURCE_PAGE,
        "doi": DOI,
        "citation": "Muntean et al. (2026): EDGAR v8.1 Global Unintentional POPs Emissions, EC JRC.",
        "acknowledgement": "EDGAR website, Muntean et al. (2026, in preparation), and the dataset DOI.",
        "years": [1970, 2024],
        "pollutants": entries,
    }
    # Preserve identical manifests so GitHub actions only commits real release changes.
    rendered = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if not old_path.exists() or old_path.read_text(encoding="utf-8") != rendered:
        old_path.write_text(rendered, encoding="utf-8")
        any_change = True
    print("Complete.", "Changed" if any_change else "No changes")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data/edgar"))
    parser.add_argument("--pollutants", nargs="+", choices=POLLUTANTS)
    args = parser.parse_args()
    build(args.output, set(args.pollutants) if args.pollutants else None)

if __name__ == "__main__":
    main()
