"""Convert the user-provided India_Boundary shapefile ZIP to web GeoJSON.
Install: pip install geopandas shapely
Run: python scripts/prepare_india_boundary.py "Shape Files India.zip"
This does not authenticate the geographic or legal provenance of the source.
"""
import argparse, hashlib, json, tempfile, zipfile
from pathlib import Path
import geopandas as gpd
from shapely.geometry import mapping

def round_coords(value):
    if isinstance(value,(tuple,list)):
        return [round_coords(x) for x in value]
    return round(float(value),5)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("archive",type=Path)
    parser.add_argument("--output",type=Path,default=Path("data/boundaries"))
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as temp,zipfile.ZipFile(args.archive) as z:
        needed={"India_Boundary.shp","India_Boundary.shx","India_Boundary.dbf","India_Boundary.prj"}
        if not needed.issubset(z.namelist()):
            raise ValueError("India_Boundary shapefile components missing")
        for item in z.infolist():
            if item.is_dir(): continue
            if item.filename != Path(item.filename).name: raise ValueError("Unexpected nested ZIP member")
            (Path(temp)/item.filename).write_bytes(z.read(item.filename))
        gdf=gpd.read_file(Path(temp)/"India_Boundary.shp")
    if len(gdf)!=1 or gdf.crs is None: raise ValueError("Expected a single feature and a valid CRS")
    gdf=gdf.to_crs("EPSG:4326")
    original=gdf.geometry.iloc[0]
    if original.geom_type!="MultiPolygon" or not original.is_valid: raise ValueError("Unexpected or invalid geometry")
    simplified=original.simplify(0.0005,preserve_topology=True)
    if not simplified.is_valid or len(simplified.geoms)!=len(original.geoms): raise ValueError("Invalid simplification")
    delta=abs(simplified.area-original.area)/original.area
    if delta>0.0001:raise ValueError("Area deviation too large")
    bounds=list(original.bounds)
    if not (67<bounds[0]<70 and 6<bounds[1]<8 and 96<bounds[2]<99 and 36<bounds[3]<39):raise ValueError("Unexpected bounds")
    geom=mapping(simplified)
    obj={"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"India","source":"User-supplied shapefile; official provenance unverified"},"geometry":{"type":geom["type"],"coordinates":round_coords(geom["coordinates"])}}]}
    out=args.output/"india.geojson"
    out.write_text(json.dumps(obj,separators=(",",":"))+"\n",encoding="utf-8")
    provenance={"source_zip_sha256":hashlib.sha256(args.archive.read_bytes()).hexdigest(),"web_geojson_sha256":hashlib.sha256(out.read_bytes()).hexdigest(),"crs":"EPSG:4326","original_bounds_lonlat":bounds,"polygon_parts":len(original.geoms),"geometry_valid":True,"relative_simplified_area_difference":delta,"official_source_verified":False,"license":"Not provided with uploaded archive"}
    (args.output/"india.provenance.json").write_text(json.dumps(provenance,indent=2)+"\n",encoding="utf-8")
    print("Created",out,"bytes",out.stat().st_size,"polygon parts",len(original.geoms))

if __name__=="__main__":main()
