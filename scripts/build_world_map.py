#!/usr/bin/env python3
"""Build ONE world GeoJSON with India's user-supplied outline integrated.

World geometry: D3 world GeoJSON based on Natural Earth, downloaded once at
build time (not requested by every dashboard visitor). India geometry: source
file in data/boundaries/india.geojson. Explicitly removes the generic India
feature and clips overlapping neighbors to the supplied outline.

This preserves a *visual* India outline; it does NOT independently verify that
the uploaded shapefile is Survey-of-India-authorized or legally redistributable.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import requests
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.validation import explain_validity

WORLD_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
MAX_WORLD_BYTES = 8 * 1024 * 1024


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def polygons_only(geom):
    if geom.is_empty:
        return None
    if isinstance(geom, (Polygon, MultiPolygon)):
        return geom
    if isinstance(geom, GeometryCollection):
        parts = []
        for item in geom.geoms:
            if isinstance(item, Polygon):
                parts.append(item)
            elif isinstance(item, MultiPolygon):
                parts.extend(item.geoms)
        return MultiPolygon(parts) if parts else None
    raise ValueError(f"Unexpected geometry type {geom.geom_type}")


def rounded_coords(value):
    if isinstance(value, (list, tuple)):
        return [rounded_coords(item) for item in value]
    value = round(float(value), 5)
    if not math.isfinite(value):
        raise ValueError("Non-finite coordinate")
    return value


def feature_polygon(geometry):
    obj = mapping(geometry)
    return {
        "type": obj["type"],
        "coordinates": rounded_coords(obj["coordinates"]),
    }


def load_world(path: Path | None) -> tuple[dict, str]:
    if path:
        raw = path.read_bytes()
    else:
        response = requests.get(WORLD_URL, timeout=(25, 120), headers={
            "User-Agent": "POPsAtlas-map-preparation/1.0"})
        response.raise_for_status()
        if not response.url.startswith("https://raw.githubusercontent.com/"):
            raise ValueError(f"Unexpected world geometry redirect: {response.url}")
        raw = response.content
    if len(raw) > MAX_WORLD_BYTES:
        raise ValueError("World basemap exceeds size limit")
    geo = json.loads(raw)
    if geo.get("type") != "FeatureCollection" or len(geo.get("features", [])) < 150:
        raise ValueError("World basemap has an unexpected feature count/type")
    return geo, digest(raw)


def build(world, india_geo):
    features = india_geo.get("features") or []
    if india_geo.get("type") != "FeatureCollection" or len(features) != 1:
        raise ValueError("Expected exactly one India feature in user-supplied GeoJSON")
    india = shape(features[0]["geometry"])
    if india.geom_type not in ("Polygon", "MultiPolygon") or not india.is_valid:
        raise ValueError("India geometry invalid: " + explain_validity(india))
    min_x, min_y, max_x, max_y = india.bounds
    if not (67 <= min_x <= 70 and 6 <= min_y <= 8 and
            96 <= max_x <= 99 and 36 <= max_y <= 39):
        raise ValueError("India geometry extent outside expected range")
    original_parts = len(india.geoms) if isinstance(india, MultiPolygon) else 1
    # Reduce network cost without simplifying away island polygon parts.
    simplified = india.simplify(0.002, preserve_topology=True)
    new_parts = len(simplified.geoms) if isinstance(simplified, MultiPolygon) else 1
    if not simplified.is_valid or original_parts != new_parts:
        raise ValueError("India simplification removed polygons or broke topology")
    if abs(simplified.area / india.area - 1) > 0.00015:
        raise ValueError("India simplification changed polygon area too much")

    results, countries_clipped = [], []
    for f in world["features"]:
        name = str(f.get("properties", {}).get("name", ""))
        iso = str(f.get("id", "")).upper()
        # This is the only India representation in the result.
        if iso == "IND" or name.casefold() == "india":
            continue
        geom = shape(f["geometry"])
        if not geom.is_valid:
            raise ValueError(f"Invalid geometry for basemap country: {name}")
        if geom.intersects(india):
            # Ensure neighboring land does not overlap the provided India outline.
            clipped = polygons_only(geom.difference(india))
            if clipped is None:
                raise ValueError(f"Unexpected country erased by India: {name}")
            if not clipped.is_valid:
                raise ValueError(f"Invalid clipping result for {name}")
            geom = clipped
            countries_clipped.append(name)
        results.append({
            "type": "Feature",
            "id": iso,
            "properties": {"name": name},
            "geometry": feature_polygon(geom),
        })

    # India has one country key; no separate masks, overlays or popup resources.
    results.append({
        "type": "Feature",
        "id": "IND",
        "properties": {
            "name": "India",
            "ISO_A3": "IND",
            "boundary_source": "user-supplied India shapefile; provenance not verified",
        },
        "geometry": feature_polygon(simplified),
    })
    if len(results) < 150:
        raise ValueError("World map unexpectedly small after harmonization")
    if len([f for f in results if f["id"] == "IND"]) != 1:
        raise ValueError("India must appear exactly once")
    result = {"type": "FeatureCollection", "features": results}
    # Validate the rounded output too, not just the input.
    for f in results:
        geom = shape(f["geometry"])
        if not geom.is_valid:
            raise ValueError(f"Rounded geometry invalid: {f['properties']['name']}")
    return result, {
        "feature_count": len(results),
        "india_polygon_parts": original_parts,
        "neighbor_country_geometries_clipped": countries_clipped,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--world-file", type=Path, help="Use a local GeoJSON instead of downloading a public world basemap")
    p.add_argument("--india-file", type=Path, default=Path("data/boundaries/india.geojson"))
    p.add_argument("--output", type=Path, default=Path("data/boundaries/world_india.geojson"))
    args = p.parse_args()

    india_raw = args.india_file.read_bytes()
    if not india_raw:
        raise ValueError("India GeoJSON is empty")
    india_geo = json.loads(india_raw)
    world, world_sha = load_world(args.world_file)
    combined, checks = build(world, india_geo)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(combined, ensure_ascii=False, separators=(",", ":")) + "\n"
    args.output.write_text(payload, encoding="utf-8")
    prov = {
        "map_type": "unified_static_geojson",
        "world_source": str(args.world_file) if args.world_file else WORLD_URL,
        "world_input_sha256": world_sha,
        "india_source": args.india_file.as_posix(),
        "india_input_sha256": digest(india_raw),
        "combined_sha256": digest(payload.encode("utf-8")),
        "coordinate_system": "EPSG:4326",
        "official_india_provenance_verified": False,
        "license_status": "World base and India geometry redistribution rights must be checked separately",
        **checks,
    }
    (args.output.parent / "world_india.provenance.json").write_text(
        json.dumps(prov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Built {args.output}: {len(payload):,} bytes, "
          f"{checks['feature_count']} countries, "
          f"{checks['india_polygon_parts']} India polygon parts, "
          f"{len(checks['neighbor_country_geometries_clipped'])} neighbors clipped")


if __name__ == "__main__":
    main()
