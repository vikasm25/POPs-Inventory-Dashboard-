// Static-only production build. No Python runtime or application server needed.
import { existsSync, cpSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot=resolve(".");
const dist=join(projectRoot,"dist");
const required=[
  "index.html",
  "how-to-use.html",
  "references.html",
  "pages.js",
  "styles.css",
  "app.js",
  "data/boundaries/world_india.geojson",
  "data/edgar/manifest.json",
  "data/country-regions.json",
];
for(const filename of required){
  if(!existsSync(join(projectRoot,filename)))
    throw new Error("Required dashboard asset not found: "+filename);
}
rmSync(dist,{recursive:true,force:true});
mkdirSync(join(dist,"data","edgar"),{recursive:true});
mkdirSync(join(dist,"data","boundaries"),{recursive:true});
for(const filename of ["index.html","how-to-use.html","references.html","pages.js","styles.css","app.js"]){
  copyFileSync(join(projectRoot,filename),join(dist,filename));
}
copyFileSync(join(projectRoot,"data","country-regions.json"),join(dist,"data","country-regions.json"));
copyFileSync(join(projectRoot,"data","boundaries","world_india.geojson"),
             join(dist,"data","boundaries","world_india.geojson"));
const manifest=JSON.parse(await import("node:fs/promises").then(fs=>fs.readFile(join(projectRoot,"data","edgar","manifest.json"),"utf8")));
if(manifest.schema!==1||manifest.inventory!=="EDGAR")
  throw new Error("Invalid EDGAR manifest: refusing incomplete publication");
const items=Object.entries(manifest.pollutants||{});
if(items.length<1)throw new Error("No pollutants in EDGAR manifest");
for(const [pollutant,meta] of items){
  const expected="data/edgar/"+pollutant+".json";
  if(!/^[A-Za-z0-9_]+$/.test(pollutant)||meta.path!==expected)
    throw new Error("Unexpected dataset path in manifest: "+meta.path);
  const source=join(projectRoot,expected);
  if(!existsSync(source)||!statSync(source).size)
    throw new Error("Missing EDGAR JSON: "+expected);
  copyFileSync(source,join(dist,expected));
}
copyFileSync(join(projectRoot,"data","edgar","manifest.json"),
             join(dist,"data","edgar","manifest.json"));
console.log("Static Vercel bundle complete: "+items.length+" EDGAR datasets + world map + dashboard.");
console.log("No Python scripts, caches, licenses from processing ZIPs, or source archives are published.");
