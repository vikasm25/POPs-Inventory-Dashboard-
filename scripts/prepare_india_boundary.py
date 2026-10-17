"""Convert the user's India shapefile ZIP into web-ready GeoJSON.

This preserves every polygon/island and topology, and simplifies only for
rendering at global-map scale. It does NOT certify that the source is an
official Survey of India border. Requirements: geopandas, shapely.

Usage:
 python scripts/prepare_india_boundary.py "Shape Files India.zip"
"""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
from shapely.geometry import mapping
import argparse
import geopandas as gpd
import json
import tempfile
import zipfile

TOLERANCE_DEGREES = 0.0005  # Display geometry, NOT a new legal border.

def to_five_decimals(value):
    if isinstance(value, (tuple, list)):
        return [to_five_decimals(item) for item in value]
    return round(float(value), 5)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("zipfile", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/boundaries"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.zipfile) as archive, tempfile.TemporaryDirectory() as directory:
        expected = {"India_Boundary.shp", "India_Boundary.shx", "India_Boundary.dbf", "India_Boundary.prj"}
        if not expected.issubset(set(archive.namelist())):
            raise ValueError("Expected India_Boundary shapefile components not found")
        for item in archive.infolist():
            if item.is_dir():
                continue
            if Path(item.filename).name != item.filename:
                raise ValueError("Unexpected nested or unsafe ZIP path")
            (Path(directory) / item.filename).write_bytes(archive.read(item.filename))
        gdf = gpd.read_file(Path(directory) / "India_Boundary.shp")
    if len(gdf) != 1 or gdf.crs is None:
        raise ValueError("Expected exactly one boundary feature with a declared CRS")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)
    original = gdf.geometry.iloc[0]
    if original.geom_type != "MultiPolygon" or not original.is_valid:
        raise ValueError("Unexpected India geometry or invalid source")
    display = original.simplify(TOLERANCE_DEGREES, preserve_topology=True)
    if not display.is_valid or len(display.geoms) != len(original.geoms):
        raise ValueError("Simplification altered islands or validity")
    area_diff = abs(display.area - original.area) / original.area
    if area_diff > 0.0001:
        raise ValueError(f"Excessive simplification area difference: {area_diff}")
    bounds = [round(float(x), 6) for x in original.bounds]
    if not (67 < bounds[0] < 70 and 6 < bounds[1] < 8 and 96 < bounds[2] < 99 and 36 < bounds[3] < 39):
        raise ValueError(f"Unexpected geographic extent: {bounds}")
    geometry = mapping(display)
    feature = {"type": "FeatureCollection", "features": [{"type": "Feature",
        "properties": {"name": "India", "source": "User-supplied India_Boundary.shp", "simplified": True},
        "geometry": {"type": geometry["type"], "coordinates": to_five_decimals(geometry["coordinates"])}}]}
    out = args.output / "india.geojson"
    out.write_text(json.dumps(feature, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    meta = {
        "label": "User-supplied boundary; official provenance not independently verified",
        "source_zip_name": args.zipfile.name,
        "source_zip_sha256": sha256(args.zipfile.read_bytes()).hexdigest(),
        "original_geometry_type": original.geom_type,
        "crs": "EPSG:4326",
        "original_bounds_lonlat": bounds,
        "multipolygon_parts": len(original.geoms),
        "valid_original": original.is_valid,
        "valid_display": display.is_valid,
        "display_simplification_tolerance_degrees": TOLERANCE_DEGREES,
        "relative_area_change": area_diff,
        "web_geometry_sha256": sha256(out.read_bytes()).hexdigest(),
        "web_geometry_bytes": out.stat().st_size,
        "licensing": "Not supplied in the source ZIP; verify before public redistribution.",
    }
    metaout = args.output / "india.provenance.json"
    metaout.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size:,} bytes), {len(original.geoms)} parts")
    print(f"Source zip SHA256: {meta['source_zip_sha256']}")
    print(f"Area difference: {area_diff*100:.6f}%")

if __name__ == "__main__":
    main()
