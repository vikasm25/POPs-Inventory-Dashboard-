// Static-only production build. No Python runtime or application server needed.
import { existsSync, cpSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot=resolve(".");
const dist=join(projectRoot,"dist");
const required=[
  "index.html",
  "how-to-use.html",
  "about.html",
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
for(const filename of ["index.html","how-to-use.html","about.html","references.html","pages.js","styles.css","app.js"]){
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
// Publish Breivik only when the entire independently validated catalog is present.
const breivikCatalogPath=join(projectRoot,"data","breivik","default","manifest.json");
if(existsSync(breivikCatalogPath)){
 const catalog=JSON.parse(await import("node:fs/promises").then(fs=>fs.readFile(breivikCatalogPath,"utf8")));
 if(catalog.schema!==1||catalog.inventory!=="Breivik"||catalog.scenario!=="Default"||catalog.units!=="tonnes/year")
  throw new Error("Invalid Breivik Default catalog");
 const files=Object.entries(catalog.pollutants||{});
 if(files.length!==23)throw new Error("Expected 22 Breivik PCB congeners plus Sum22");
 mkdirSync(join(dist,"data","breivik","default"),{recursive:true});
 for(const [key,meta] of files){
  const expected="data/breivik/default/"+key+".json";
  if(!/^(PCB[0-9]+|Sum22)$/.test(key)||meta.path!==expected)throw new Error("Unexpected Breivik dataset: "+key);
  const src=join(projectRoot,expected);
  if(!existsSync(src)||!statSync(src).size)throw new Error("Missing Breivik file: "+expected);
  copyFileSync(src,join(dist,expected));
 }
 copyFileSync(breivikCatalogPath,join(dist,"data","breivik","default","manifest.json"));
 console.log("Breivik Default published: 22 congeners + Sum22 (1930–2100).");
}
console.log("Static Vercel bundle complete: "+items.length+" EDGAR datasets + world map + dashboard.");
console.log("No Python scripts, caches, licenses from processing ZIPs, or source archives are published.");
