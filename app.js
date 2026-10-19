/* POPs Atlas | source-specific country inventory explorer */
(()=>{"use strict";
const $=id=>document.getElementById(id),norm=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,""),fmt=v=>Number.isFinite(v)?v.toLocaleString("en-US",{maximumFractionDigits:v<1?5:2}):"—",esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SECTORS=["Power industry","Oil refineries & Transformation industry","Combustion for manufacturing","Road transportation","Railways, pipelines, off-road transport","Shipping","Energy for buildings","Iron and steel production","Non-ferrous metals production","Agricultural waste burning","Solid waste incineration"],LEGACY_EDGAR_SECTORS=["Power Industry","Industrial combustion","Buildings","Transport","Agriculture","Fuel exploitation","Processes","Waste"],COLORS=["#36a8ff","#ff9d58","#65d5a4","#ecc960","#ad87f9","#eb73ab","#4bc9d3","#fc707a"],REGIONS=["Asia","Europe","Africa","North America","South America","Oceania"];
// Use the official EDGAR v8.1 POPs category names across controls and charts.
const EDGAR_SECTORS=SECTORS, BREIVIK_SECTOR="Not sector-resolved";
const EDGAR_SECTOR_DESCRIPTIONS={
 "Power Industry":"Power and heat generation plants (public and autoproducers)",
 "Industrial combustion":"Combustion for industrial manufacturing",
 "Buildings":"Small-scale non-industrial stationary combustion",
 "Transport":"Mobile combustion (road, rail, ship and aviation)",
 "Agriculture":"Agricultural soils, crop-residue burning, enteric fermentation and manure management",
 "Fuel exploitation":"Production, transformation and refining of fuels",
 "Processes":"Industrial processes including cement, iron and steel, aluminum, chemicals and solvents",
 "Waste":"Solid-waste disposal and wastewater treatment"
};
function edgarSectorLabel(source){return EDGAR_SECTOR_DESCRIPTIONS[source]?source:source;}
const special={unitedstatesofamerica:"unitedstates",russianfederation:"russia",czechia:"czechrepublic",republicofkorea:"southkorea",vietnam:"vietnam"};const canon=s=>special[norm(s)]||norm(s);
const DEMO_COUNTRIES=[["China","CHN","Asia",12100],["United States","USA","North America",8500],["India","IND","Asia",4200],["Russia","RUS","Europe",3500],["Japan","JPN","Asia",2210],["Germany","DEU","Europe",1760],["Brazil","BRA","South America",1310],["United Kingdom","GBR","Europe",1050],["France","FRA","Europe",940],["Canada","CAN","North America",870],["Australia","AUS","Oceania",490],["South Africa","ZAF","Africa",710],["Nigeria","NGA","Africa",460],["Argentina","ARG","South America",280],["Chile","CHL","South America",85],["Iceland","ISL","Europe",.12],["Luxembourg","LUX","Europe",.18],["New Zealand","NZL","Oceania",.25]];
const DEMO_INVENTORIES=["EDGAR","Breivik"];
const S={published:null,publishedCache:new Map(),breivik:null,breivikCache:new Map(),loadSerial:0,activePollutant:"",loadingPollutant:null,sectorLoadError:"",sectorsCleared:false,regionLookup:{},mapTransform:null,mapZoomBehavior:null,scaleCache:null,demo:false,records:[],inventories:new Set(DEMO_INVENTORIES),sectors:new Set(SECTORS),mapInventory:"EDGAR",country:null,world:null,india:null,zoom:1,year:2020,playing:null,hiddenBanner:false,theme:localStorage.getItem("pops-theme")==="light"?"light":"dark"};
function makeDemo(){const a=[];for(const [country,iso,region,base] of DEMO_COUNTRIES){for(let year=1990;year<=2024;year++){for(let si=0;si<SECTORS.length;si++){for(const [i,inv] of DEMO_INVENTORIES.entries()){const factor=1-(year-1990)*.013,shares=[.31,.24,.09,.15,.09,.04,.05,.03];a.push({country,iso,region,year,pollutant:"PCB (illustrative)",inventory:inv,sector:SECTORS[si],emissions:base*Math.max(.1,factor)*shares[si]*(i?0.91:1)*(1+.04*Math.sin(year*.35+si))})}}}}return a}
function data(){return S.demo?makeDemoCached:S.records}const makeDemoCached=makeDemo();
function yearRange(rows){let lo=Infinity,hi=-Infinity;for(const r of rows){if(r.year<lo)lo=r.year;if(r.year>hi)hi=r.year}return{min:Number.isFinite(lo)?lo:2000,max:Number.isFinite(hi)?hi:2024}}
const publishedLabel=code=>code==="PCB"?"PCB (aggregate, unintentional)":code;
const publishedKey=label=>S.published&&Object.keys(S.published.pollutants||{}).find(code=>publishedLabel(code)===label);
const breivikLabel=code=>S.breivik?.pollutants?.[code]?.display_name||code;
const breivikKey=label=>S.breivik&&Object.keys(S.breivik.pollutants||{}).find(code=>breivikLabel(code)===label);
function availableInventories(){return [...new Set([...data().map(r=>r.inventory),...(S.published?["EDGAR"]:[]),...(S.breivik?["Breivik"]:[])])].sort()}
function pollutantsFor(inv){const list=[...new Set(data().filter(r=>r.inventory===inv).map(r=>r.pollutant))];if(inv==="EDGAR"&&S.published)list.push(...Object.keys(S.published.pollutants).map(publishedLabel));
 if(inv==="Breivik"&&S.breivik)list.push(...Object.keys(S.breivik.pollutants).map(breivikLabel));return [...new Set(list)].sort()}
function sourceChoices(){
 if(S.mapInventory==="Breivik"&&S.breivik)return [BREIVIK_SECTOR];
 if(S.mapInventory==="EDGAR"&&S.published){const observed=new Set(data().filter(r=>r.inventory==="EDGAR").map(r=>r.sector));return observed.size&&[...observed].some(v=>LEGACY_EDGAR_SECTORS.includes(v))?LEGACY_EDGAR_SECTORS:[...EDGAR_SECTORS];}
 return [...new Set(data().filter(r=>r.inventory===S.mapInventory&&r.pollutant===S.activePollutant).map(r=>r.sector))].sort();
}
function options(){
 const inv=availableInventories();
 if(!inv.includes(S.mapInventory))S.mapInventory=inv[0]||"";
 S.inventories=new Set(inv);
 const inventory=$("inventorySelect");
 inventory.replaceChildren();
 inv.forEach(name=>inventory.add(new Option(({"EDGAR":"EDGAR v8.1 POPs","Breivik":"Breivik PCBs (2016)"})[name]||name,name)));
 inventory.value=S.mapInventory;inventory.disabled=!inv.length;
 const pols=pollutantsFor(S.mapInventory);
 const current=S.activePollutant;
 S.activePollutant=pols.includes(current)?current:(pols[0]||"");
 const pollutant=$("pollutantSelect");
 pollutant.replaceChildren();
 pols.forEach(name=>pollutant.add(new Option(name,name)));
 pollutant.value=S.activePollutant;pollutant.disabled=!pols.length;
 const sectors=sourceChoices();
 S.sectors=new Set([...S.sectors].filter(v=>sectors.includes(v)));
 if(!S.sectors.size&&!S.sectorsCleared)S.sectors=new Set(sectors);
 const available=new Set(data().filter(r=>r.inventory===S.mapInventory&&r.pollutant===S.activePollutant).map(r=>r.sector));
 const loading=S.mapInventory==="EDGAR"&&S.loadingPollutant!=null;
 const status=$("sourceStatus");
 $("sourceCard").hidden=S.mapInventory==="Breivik";
 if(S.mapInventory==="Breivik")status.textContent="No source-sector categories are provided by Breivik et al. (2016).";
 else if(S.sectorLoadError)status.textContent=S.sectorLoadError;
 else if(loading)status.textContent="Loading EDGAR observations…";
 else if(!sectors.length)status.textContent="No source categories available for this selection.";
 else if(!available.size)status.textContent="Select a pollutant to load its source observations.";
 else status.textContent=available.size+" of "+sectors.length+" categories have reported observations.";
 $("sourceRetry").hidden=!(S.sectorLoadError&&S.mapInventory==="EDGAR");
 const root=$("sectorOptions");root.replaceChildren();
 sectors.forEach(sector=>{
  const label=document.createElement("label");label.className="choice-row";label.title=EDGAR_SECTOR_DESCRIPTIONS[sector]||sector;
  const input=document.createElement("input");input.type="checkbox";input.checked=S.sectors.has(sector);
  if(S.mapInventory==="EDGAR"&&!loading&&!S.sectorLoadError&&available.size&&!available.has(sector))label.classList.add("source-unreported");
  input.addEventListener("change",()=>{input.checked?S.sectors.add(sector):S.sectors.delete(sector);S.sectorsCleared=S.sectors.size===0;S.scaleCache=null;render()});
  label.append(input,document.createTextNode(sector));root.append(label);
 });
 const bounds=S.mapInventory==="Breivik"&&S.breivik?{min:S.breivik.years[0],max:S.breivik.years[1]}:yearRange(data().filter(r=>r.inventory===S.mapInventory&&r.pollutant===S.activePollutant));
 $("yearSlider").min=bounds.min;$("yearSlider").max=bounds.max;
 S.year=Math.max(bounds.min,Math.min(bounds.max,S.year));$("yearSlider").value=S.year;
 $("yearMin").textContent=bounds.min;$("yearMax").textContent=bounds.max;
}
function filter(inv=S.mapInventory,year=S.year,selectedCountry=S.country,ignoreCountry=false,ignoreYear=false){return data().filter(r=>r.pollutant===$("pollutantSelect").value&&S.sectors.has(r.sector)&&r.inventory===inv&&(ignoreYear||r.year===year)&&(ignoreCountry||!selectedCountry||canon(r.country)===canon(selectedCountry)||r.iso===selectedCountry))}
function sum(rows){return rows.reduce((a,r)=>a+r.emissions,0)}
function grouped(rows,field){const m=new Map();for(const r of rows){const k=r[field];if(!m.has(k))m.set(k,{name:k,value:0,rows:[],iso:r.iso});const x=m.get(k);x.value+=r.emissions;x.rows.push(r)}return [...m.values()]}
function byCountry(inv=S.mapInventory){return grouped(filter(inv,S.year,null,true),"country")}
function allInventories(){return [...new Set(data().map(r=>r.inventory))]}
function canvas(){const t=document.documentElement;t.dataset.theme=S.theme;const b=$("themeToggle");b.querySelector(".theme-caption").textContent=S.theme==="dark"?"Dark":"Light";b.setAttribute("aria-label","Switch to "+(S.theme==="dark"?"light":"dark")+" theme");document.querySelector('meta[name="theme-color"]').content=S.theme==="dark"?"#081727":"#f3f7fc"}
function notice(){}
function displayCountryName(name,iso){
 const names={RUS:"Russia",USA:"United States",GBR:"United Kingdom",KOR:"South Korea",PRK:"North Korea",CZE:"Czechia",TUR:"Türkiye",VNM:"Vietnam",LAO:"Laos",BOL:"Bolivia",VEN:"Venezuela",TZA:"Tanzania",COD:"Democratic Republic of the Congo",COG:"Republic of the Congo",IRN:"Iran",SYR:"Syria",MDA:"Moldova",BRN:"Brunei",CPV:"Cabo Verde",SWZ:"Eswatini",MKD:"North Macedonia",CIV:"Côte d’Ivoire"};
 return names[String(iso||"").toUpperCase()]||name;
}
function isCountryRecord(r){const iso=String(r.iso||"").toUpperCase();return REGIONS.includes(S.regionLookup[iso])&&!/^(int[,. ]*shipping|international shipping|international aviation)$/i.test(String(r.name||r.country||""))}
function countryRows(){return byCountry().filter(isCountryRecord)}
function updateYearCaptions(year=S.year){document.querySelectorAll("[data-current-year]").forEach(el=>el.textContent=year)}
function plotTooltip(container,selection,html){
 const tip=document.createElement("div");tip.className="plot-tooltip";tip.hidden=true;container.append(tip);
 const move=(event,d)=>{
  tip.innerHTML=html(d);tip.hidden=false;
  const box=container.getBoundingClientRect();
  tip.style.left=Math.max(6,Math.min(box.width-tip.offsetWidth-6,event.clientX-box.left+14))+"px";
  tip.style.top=Math.max(6,Math.min(box.height-tip.offsetHeight-6,event.clientY-box.top-tip.offsetHeight-12))+"px";
 };
 selection.on("pointerenter.plotTip",move).on("pointermove.plotTip",move).on("pointerleave.plotTip",()=>{tip.hidden=true});
}
function KPIs(){
 const rows=filter(S.mapInventory,S.year,null,true),v=sum(rows),c=countryRows().sort((a,b)=>b.value-a.value),last=filter(S.mapInventory,S.year-1,null,true),prev=sum(last),delta=last.length&&rows.length&&prev?100*(v-prev)/prev:NaN;
 const positive=c.map(r=>r.value).filter(v=>v>0).sort((a,b)=>a-b);
 $("kpiMedian").textContent=positive.length?fmt(d3.median(positive)):"—";
 $("kpiChange").textContent=Number.isFinite(delta)?(delta>=0?"+":"")+fmt(delta)+"%":"—";
 $("kpiCountries").textContent=c.length?c.length:"—";
 $("kpiCountry").textContent=c.length?displayCountryName(c[0].name,c[0].iso):"—";
 $("kpiShare").textContent=c.length&&v?fmt(100*c[0].value/v)+"% of reported global emissions":"share of reported total";
 $("coverageYears").textContent=data().length?yearRange(data()).min+"–"+yearRange(data()).max:"—";
 $("coverageRows").textContent=S.demo?"Illustrative":data().length.toLocaleString();
}
function rankings(){const c=byCountry().sort((a,b)=>b.value-a.value);let top=c.slice(0,3),low=c.slice().reverse().slice(0,3);for(const [id,items,isLow] of [["rankTop",top,false],["rankLow",low,true]]){const root=$(id);root.replaceChildren();if(!items.length){root.innerHTML='<div class="empty-chart">No country data</div>';continue}const max=Math.max(...items.map(a=>a.value),.00001);items.forEach((v,i)=>{const row=document.createElement("div");row.className="rank-row"+(isLow?" low-rank":"");row.innerHTML='<span class="rank-position">'+(i+1)+'</span><span class="rank-name" title="'+esc(v.name)+'">'+esc(v.name)+'</span><div class="rank-track"><div class="rank-fill" style="width:'+Math.max(v.value?3:0,v.value/max*100)+'%"></div></div><b class="rank-value">'+fmt(v.value)+'</b>';row.onclick=()=>{S.country=v.name;render()};row.style.cursor="pointer";root.append(row)})}}
function linePlot(){const root=d3.select("#trendPlot");root.selectAll("*").remove();const leg=$("trendLegend");leg.replaceChildren();const sources=[...S.sectors];let series=sources.map((sector,i)=>({name:sector,color:COLORS[Math.max(0,SECTORS.indexOf(sector))%COLORS.length],points:grouped(filter(S.mapInventory,S.year,S.country,false,true).filter(r=>r.sector===sector),"year").map(v=>({year:+v.name,value:v.value})).sort((a,b)=>a.year-b.year)})).filter(s=>s.points.length);$("trendScope").textContent=S.country||"GLOBAL";$("trendSubtitle").textContent=(S.mapInventory||"No inventory")+" · "+(S.country||"worldwide")+" · tonnes/year";if(!series.length){root.html('<div class="empty-chart">No emissions history for this selection</div>');return}series.forEach(s=>{let el=document.createElement("span");el.className="legend-key";el.innerHTML='<i style="background:'+s.color+'"></i>'+esc(s.name);leg.append(el)});const w=760,h=320,m={top:22,right:20,bottom:49,left:82},ys=series.flatMap(s=>s.points),ext=d3.extent(ys,d=>d.year),x=d3.scaleLinear().domain(ext[0]===ext[1]?[ext[0]-1,ext[1]+1]:ext).range([m.left,w-m.right]),y=d3.scaleLinear().domain([0,d3.max(ys,d=>d.value)||1]).nice().range([h-m.bottom,m.top]),svg=root.append("svg").attr("viewBox","0 0 "+w+" "+h).attr("preserveAspectRatio","xMidYMid meet");svg.selectAll(".grid").data(y.ticks(5)).join("line").attr("x1",m.left).attr("x2",w-m.right).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","var(--line)").attr("opacity",.6);svg.append("g").attr("class","chart-axis").attr("transform","translate(0,"+(h-m.bottom)+")").call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("d")));svg.append("g").attr("class","chart-axis").attr("transform","translate("+m.left+",0)").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));series.forEach(s=>{svg.append("path").datum(s.points).attr("fill","none").attr("stroke",s.color).attr("stroke-width",2.4).attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.value)));const dots=svg.selectAll("circle.c"+norm(s.name)).data(s.points).join("circle").attr("cx",d=>x(d.year)).attr("cy",d=>y(d.value)).attr("r",3.3).attr("fill",s.color).style("cursor","crosshair");plotTooltip(root.node(),dots,d=>"<strong>"+esc(s.name)+" · "+d.year+"</strong><span>"+fmt(d.value)+" tonnes/year</span>")});svg.append("text").attr("class","axis-title").attr("transform","translate(20,"+((m.top+h-m.bottom)/2)+") rotate(-90)").attr("text-anchor","middle").text("Emissions (tonnes/year)");svg.append("line").attr("x1",x(S.year)).attr("x2",x(S.year)).attr("y1",m.top).attr("y2",h-m.bottom).attr("stroke","var(--muted)").attr("stroke-dasharray","4 4").attr("opacity",.8)}
function donut(){const root=d3.select("#sectorDonut");root.selectAll("*").remove();const list=$("sectorLegend");list.replaceChildren();if(S.mapInventory==="Breivik"){root.html('<div class="empty-chart">Source-sector breakdown not available in the Breivik inventory.</div>');return}const items=grouped(filter(S.mapInventory,S.year,null,true),"sector").sort((a,b)=>b.value-a.value),total=sum(items.map(v=>({emissions:v.value})));if(!total){root.html('<div class="empty-chart">No sector breakdown</div>');return}const w=240,h=220,r=88,g=root.append("svg").attr("viewBox","0 0 "+w+" "+h).append("g").attr("transform","translate(120,110)"),pie=d3.pie().sort(null).value(d=>d.value);const slices=g.selectAll("path").data(pie(items)).join("path").attr("d",d3.arc().innerRadius(58).outerRadius(r)).attr("fill",d=>COLORS[SECTORS.indexOf(d.data.name)%COLORS.length]).attr("stroke","var(--panel)").attr("stroke-width",2).style("cursor","crosshair");plotTooltip(root.node(),slices,d=>"<strong>"+esc(d.data.name)+"</strong><span>"+fmt(d.data.value)+" tonnes/year · "+fmt(100*d.data.value/total)+"%</span>");g.append("text").attr("text-anchor","middle").attr("y",0).attr("fill","var(--text)").attr("font-size",23).attr("font-weight",700).text(fmt(total));g.append("text").attr("text-anchor","middle").attr("y",18).attr("fill","var(--muted)").attr("font-size",10).text("tonnes/year");items.forEach(v=>{const color=COLORS[SECTORS.indexOf(v.name)%COLORS.length],div=document.createElement("div");div.className="donut-item";div.innerHTML='<span><i style="background:'+color+'"></i>'+esc(v.name)+'</span><b>'+fmt(v.value/total*100)+'%<span class="donut-sub">'+fmt(v.value)+' t/yr</span></b>';list.append(div)})}
function region(){
 const root=d3.select("#regionalChart");root.selectAll("*").remove();
 const rows=filter(S.mapInventory,S.year,null,true).filter(isCountryRecord).map(r=>({...r,region:S.regionLookup[r.iso]}));
 const entries=grouped(rows,"region").sort((a,b)=>b.value-a.value);
 if(!entries.length){root.html('<div class="empty-chart">No continent-level country observations available</div>');return}
 const w=790,h=370,m={t:46,r:23,b:76,l:93};
 const x=d3.scaleBand().domain(entries.map(d=>d.name)).range([m.l,w-m.r]).padding(.32);
 const y=d3.scaleLinear().domain([0,d3.max(entries,d=>d.value)||1]).nice().range([h-m.b,m.t]);
 const svg=root.append("svg").attr("viewBox","0 0 "+w+" "+h).attr("preserveAspectRatio","xMidYMid meet");
 svg.append("g").attr("class","chart-axis").attr("transform","translate("+m.l+",0)").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("~s")));
 svg.append("g").attr("class","chart-axis").attr("transform","translate(0,"+(h-m.b)+")").call(d3.axisBottom(x).tickSize(0).tickPadding(18)).selectAll("text").style("font-size","13px");
 svg.append("text").attr("class","axis-title").attr("transform","translate(23,"+((m.t+h-m.b)/2)+") rotate(-90)").attr("text-anchor","middle").text("Emissions (tonnes/year)");
 const bars=svg.selectAll("rect.bar").data(entries).join("rect").attr("class","bar").attr("x",d=>x(d.name)).attr("y",d=>y(d.value)).attr("width",x.bandwidth()).attr("height",d=>Math.max(0,y(0)-y(d.value))).attr("rx",5).attr("fill",(d,i)=>COLORS[i%COLORS.length]);
 svg.selectAll("text.value").data(entries).join("text").attr("x",d=>x(d.name)+x.bandwidth()/2).attr("y",d=>y(d.value)-10).attr("text-anchor","middle").attr("font-size",13).attr("font-weight",700).attr("fill","var(--text)").text(d=>fmt(d.value));
 plotTooltip(root.node(),bars,d=>'<strong>'+esc(d.name)+'</strong><span>'+fmt(d.value)+' tonnes/year</span>');
}
function insights(){
 const c=countryRows().sort((a,b)=>b.value-a.value),global=sum(filter(S.mapInventory,S.year,null,true)),top3=c.slice(0,3).reduce((v,r)=>v+r.value,0);
 $("insightTop3").textContent=global?fmt(top3/global*100)+"%":"—";
 $("insightPositive").textContent=String(c.filter(r=>r.value>0).length);
 const sec=grouped(filter(S.mapInventory,S.year,null,true),"sector").sort((a,b)=>b.value-a.value);
 $("insightSector").textContent=S.mapInventory==="Breivik"?"Not available":sec[0]?.name||"—";
 $("insightSectorShare").textContent=S.mapInventory==="Breivik"?"No sector-level estimates":global&&sec.length?fmt(sec[0].value/global*100)+"% of global emissions":"No observations";
 const firstYear=yearRange(filter(S.mapInventory,S.year,null,true,true)).min,first=sum(filter(S.mapInventory,firstYear,null,true));
 $("insightLongChange").textContent=first?(global>=first?"+":"")+fmt((global/first-1)*100)+"%":"—";
 $("insightPeriod").textContent=firstYear+"–"+S.year+" · against first reported year";
}
function topPolluters(){
 const root=$("topPolluters");root.replaceChildren();
 const countries=countryRows().filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
 const top=countries.slice(0,7),total=sum(filter(S.mapInventory,S.year,null,true));
 if(!top.length){root.innerHTML='<div class="empty-chart">No country observations for this selection</div>';return}
 top.forEach((r,i)=>{
  const share=total?100*r.value/total:0;
  const button=document.createElement("button");button.type="button";button.className="top-country-row";
  const name=displayCountryName(r.name,r.iso);
  button.title=name+" · "+fmt(r.value)+" tonnes/year · "+fmt(share)+"% of reported global emissions. Click to select.";
  button.innerHTML='<span class="top-country-rank">'+(i+1)+'</span><span class="top-country-main"><span class="top-country-head"><b>'+esc(name)+'</b><span>'+fmt(r.value)+' t/yr · '+fmt(share)+'%</span></span><span class="top-country-track"><span></span></span></span>';
  button.querySelector(".top-country-track span").style.width=(top[0].value?100*r.value/top[0].value:0)+"%";
  button.onclick=()=>{S.country=r.iso||r.name;render()};
  root.append(button);
 });
}
const INDIA_BOUNDS={west:67,east:98,north:38,south:6},projection=d3.geoEquirectangular().scale(148).translate([500,232]),geoPath=d3.geoPath(projection);
function protectedRegion(f){const b=d3.geoBounds(f);return b[0][0]<INDIA_BOUNDS.east&&b[1][0]>INDIA_BOUNDS.west&&b[0][1]<INDIA_BOUNDS.north&&b[1][1]>INDIA_BOUNDS.south}
const MAP_COLORS=["#275d9a","#36bfd0","#6ed393","#f4dd57","#f68e45","#c63856"];
function mapScale(){
 const key=[S.mapInventory,$("pollutantSelect").value,[...S.sectors].sort().join("|"),S.records.length].join("~");
 if(S.scaleCache?.key===key)return S.scaleCache;
 const totals=new Map();for(const r of data()){if(r.iso==="ZZZ"||r.inventory!==S.mapInventory||r.pollutant!==$("pollutantSelect").value||!S.sectors.has(r.sector))continue;const key=r.iso+"|"+r.year;totals.set(key,(totals.get(key)||0)+r.emissions)}
 const vals=[...totals.values()].filter(v=>v>0).sort((a,b)=>a-b),upper=vals.length?vals[Math.floor((vals.length-1)*.98)]:1,lower=vals.length?Math.max(vals[0],upper/10000):1e-6;
 S.scaleCache={key,upper,lower,scale:d3.scaleSequentialLog(d3.interpolateRgbBasis(MAP_COLORS)).domain([lower,Math.max(lower*1.001,upper)]).clamp(true)};return S.scaleCache;
}
function countryValue(feature){
 const iso=String(feature.id||feature.properties?.ISO_A3||"").toUpperCase();
 return S.mapValuesISO?.get(iso)??S.mapValuesName?.get(canon(feature.properties?.name));
}
function updateMapYear(){
 if(!S.world||!S.mapZoomBehavior)return;
 const rows=byCountry();
 S.mapValuesISO=new Map();S.mapValuesName=new Map();
 for(const c of rows){if(c.iso)S.mapValuesISO.set(c.iso,c.value);S.mapValuesName.set(canon(c.name),c.value)}
 const {lower,upper,scale}=mapScale();
 $("legendMax").textContent=fmt(upper);$("legendMid").textContent=fmt(Math.sqrt(lower*upper));$("legendMin").textContent=fmt(lower);
 $("mapSubtitle").textContent=(S.activePollutant||"No pollutant")+" · "+(S.mapInventory||"No inventory")+" · t/year";
 d3.select("#worldMap").selectAll("path.map-country").attr("fill",f=>{
  const v=countryValue(f);return v===undefined?"#344b60":v===0?"#eef1f3":scale(Math.max(v,lower));
 });
 $("mapCount").textContent=countryRows().length+" countries with observations";
}
function updateLocationSummary(){const rows=byCountry(),selected=S.country?rows.find(r=>canon(r.name)===canon(S.country)||r.iso===S.country):null;$("countryName").textContent=selected?displayCountryName(selected.name,selected.iso):S.country||"Global";$("countryEmission").textContent=selected?fmt(selected.value):S.country?"No observation":fmt(rows.reduce((v,r)=>v+r.value,0));$("countryDetail").textContent=S.mapInventory+" · "+S.year+" · tonnes/year";$("closeCountry").hidden=!S.country}
function drawMap(){
 const svg=d3.select("#worldMap");svg.selectAll("*").remove();
 svg.append("rect").attr("class","ocean").attr("width",1000).attr("height",465);
 if(!S.world)return;
 const countries=svg.append("g").attr("class","map-contents");
 countries.selectAll("path.map-country").data(S.world.features).join("path")
  .attr("class","map-country").attr("d",geoPath)
  .on("click",(e,f)=>{if(e.defaultPrevented)return;S.country=f.id||f.properties?.name||null;render()})
  .on("mousemove",(e,f)=>{
   const v=countryValue(f),tip=$("mapTooltip"),box=$("mapFrame").getBoundingClientRect();
   tip.style.display="block";
   tip.style.left=Math.min(box.width-190,Math.max(4,e.clientX-box.left+12))+"px";
   tip.style.top=Math.max(4,e.clientY-box.top-35)+"px";
   tip.textContent=displayCountryName(f.properties?.name||"Country",f.id)+" · "+(v===undefined?"No observation":fmt(v)+" t/year");
  })
  .on("mouseleave",()=>{$("mapTooltip").style.display="none"});
 // Positions verified against the current world GeoJSON: text spans stay over water.
 const oceanLabels=[
  ["NORTH PACIFIC OCEAN",-142,32],["SOUTH PACIFIC OCEAN",-125,-27],
  ["NORTH ATLANTIC OCEAN",-36,34],["SOUTH ATLANTIC OCEAN",-24,-30],
  ["INDIAN OCEAN",78,-26],["ARCTIC OCEAN",-155,79],["SOUTHERN OCEAN",0,-57]
 ];
 countries.append("g").attr("class","ocean-labels").selectAll("text").data(oceanLabels).join("text")
  .attr("x",d=>projection([d[1],d[2]])[0]).attr("y",d=>projection([d[1],d[2]])[1])
  .attr("text-anchor","middle").text(d=>d[0]);
 if(!S.mapZoomBehavior)S.mapZoomBehavior=d3.zoom().filter(e=>e.type==="wheel"?!e.ctrlKey:e.type==="touchstart"?e.touches.length>1:!e.button).scaleExtent([1,8]).translateExtent([[0,0],[1000,465]]).extent([[0,0],[1000,465]]).on("zoom",e=>{S.mapTransform=e.transform;svg.select(".map-contents").attr("transform",e.transform)});
 svg.call(S.mapZoomBehavior).on("dblclick.zoom",null);svg.call(S.mapZoomBehavior.transform,S.mapTransform||d3.zoomIdentity);
 $("legendScale").style.background="linear-gradient(to top,"+MAP_COLORS.join(",")+")";
 $("legendScale").title="Logarithmic scale fixed across years; upper bound at the 98th percentile of positive country-year totals";
 updateMapYear();
 updateLocationSummary();
}
function dataTable(){const rows=byCountry().sort((a,b)=>b.value-a.value),root=$("tableBody");root.replaceChildren();rows.forEach(r=>{const tr=document.createElement("tr");tr.innerHTML="<td>"+esc(r.name)+"</td><td>"+esc(r.iso||r.rows[0]?.iso||"—")+"</td><td>"+fmt(r.value)+"</td>";tr.style.cursor="pointer";tr.onclick=()=>{S.country=r.name;render()};root.append(tr)})}
function render(){notice();updateYearCaptions();$("yearNumber").textContent=S.year;$("mapYearBadge").textContent=S.year;KPIs();linePlot();donut();region();topPolluters();insights();dataTable();if(S.world&&d3.select("#worldMap").select(".map-contents").size())updateMapYear();else drawMap();updateLocationSummary()}
function parseRecord(o,i){const get=(...aliases)=>{const k=Object.keys(o).find(k=>aliases.some(a=>norm(a)===norm(k)));return k==null?"":String(o[k]??"").trim()};const country=get("country","country_name"),iso=get("iso3","iso_a3","country_code").toUpperCase(),year=Number(get("year")),pollutant=get("pollutant","substance","chemical"),inventory=get("inventory","dataset"),sector=get("emission_source","source_category","sector","source"),region=get("region","continent")||"Unclassified",raw=get("emissions_tonnes_per_year","emissions","value"),unit=norm(get("unit","units")||"tonnes_per_year"),factor={tonnesperyear:1,tonnesyear:1,tyear:1,tyr:1,kgperyear:.001,kgyear:.001,kgyr:.001,gperyear:1e-6,gyear:1e-6,gyr:1e-6}[unit];if(!country&&!iso)throw Error("Row "+i+": country or ISO3 is required");if(!Number.isInteger(year)||year<1800||year>2200)throw Error("Row "+i+": invalid year");if(!pollutant||!inventory||!sector)throw Error("Row "+i+": pollutant, inventory and emission source are required");if(raw===""||!Number.isFinite(+raw)||+raw<0)throw Error("Row "+i+": invalid emissions");if(factor===undefined)throw Error("Row "+i+": unsupported unit "+unit);return{country:country||iso,iso,year,pollutant,inventory,sector,region,emissions:+raw*factor}}
async function importFiles(files){try{let incoming=[];for(const f of files){const rows=d3.csvParse(await f.text());if(!rows.length)throw Error(f.name+": empty CSV");incoming.push(...rows.map((r,i)=>parseRecord(r,i+2)))}let m=new Map(S.records.map(r=>[recordKey(r),r]));for(const r of incoming)m.set(recordKey(r),r);S.records=[...m.values()];S.demo=false;S.country=null;S.year=yearRange(S.records).max;S.inventories=new Set(S.records.map(r=>r.inventory));S.sectors=new Set(S.records.map(r=>r.sector));S.mapInventory=[...S.inventories][0]||"";options();render();$("uploadMessage").textContent=incoming.length+" records imported, "+S.records.length+" unique observations retained"}catch(e){$("uploadMessage").textContent="Import error: "+e.message}}
function recordKey(r){return[r.iso||canon(r.country),r.year,r.pollutant,r.inventory,r.sector].join("|")}
async function importBoundary(file){try{const geo=JSON.parse(await file.text());const features=geo.type==="FeatureCollection"?geo.features:geo.type==="Feature"?[geo]:["Polygon","MultiPolygon"].includes(geo.type)?[{type:"Feature",properties:{name:"India"},geometry:geo}]:[];if(!features.length||features.some(f=>!["Polygon","MultiPolygon"].includes(f.geometry?.type)))throw Error("Polygon/MultiPolygon GeoJSON required");const b=d3.geoBounds({type:"FeatureCollection",features});if(b[0][0]<60||b[1][0]>105||b[0][1]<0||b[1][1]>42)throw Error("Unexpected geometry extent");S.india={type:"FeatureCollection",features};$("boundaryStatus").textContent="Outline loaded; verify official provenance and license";render()}catch(e){$("boundaryStatus").textContent="Boundary rejected: "+e.message}}
function exportData(){let rows=filter(S.mapInventory,S.year,S.country);if(!rows.length){alert("No observations in selected view");return}const keys=["country","iso3","region","year","pollutant","inventory","emission_source","emissions_tonnes_per_year"],s=[keys.join(","),...rows.map(r=>[r.country,r.iso,r.region,r.year,r.pollutant,r.inventory,r.sector,r.emissions].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))].join("\n"),url=URL.createObjectURL(new Blob([s],{type:"text/csv"})),a=document.createElement("a");a.href=url;a.download="pops-emissions-"+S.year+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function stopPlayback(redraw=true){if(S.playing){clearInterval(S.playing);S.playing=null;$("playButton").textContent="▶";if(redraw)render()}}
function setup(){canvas();options();
$("themeToggle").onclick=()=>{S.theme=S.theme==="dark"?"light":"dark";localStorage.setItem("pops-theme",S.theme);canvas();render()};
$("pollutantSelect").onchange=()=>{stopPlayback(false);S.activePollutant=$("pollutantSelect").value;S.sectors=new Set();S.sectorsCleared=false;S.scaleCache=null;const key=publishedKey(S.activePollutant),bk=breivikKey(S.activePollutant);if(bk&&S.mapInventory==="Breivik")loadOneBreivikPollutant(bk);else if(key&&S.mapInventory==="EDGAR"&&!S.demo)loadOnePublishedPollutant(key);else{options();render()}};
$("inventorySelect").onchange=e=>{stopPlayback(false);++S.loadSerial;S.loadingPollutant=null;S.sectorLoadError="";S.mapInventory=e.target.value;S.activePollutant="";S.sectors=new Set();S.sectorsCleared=false;S.scaleCache=null;if(S.mapInventory==="Breivik")S.year=2016;options();const key=publishedKey(S.activePollutant),bk=breivikKey(S.activePollutant);if(bk&&S.mapInventory==="Breivik")loadOneBreivikPollutant(bk);else if(key&&S.mapInventory==="EDGAR"&&!S.demo)loadOnePublishedPollutant(key);else render()};
let yearFrame=0,yearPending=null;
$("yearSlider").oninput=e=>{
 stopPlayback(false);yearPending=+e.target.value;
 $("yearNumber").textContent=yearPending;$("mapYearBadge").textContent=yearPending;
 if(yearFrame)return;
 yearFrame=requestAnimationFrame(()=>{yearFrame=0;if(yearPending===null)return;S.year=yearPending;yearPending=null;updateYearCaptions();updateMapYear();updateLocationSummary()});
};
$("yearSlider").onchange=()=>{if(yearFrame){cancelAnimationFrame(yearFrame);yearFrame=0}S.year=+$("yearSlider").value;yearPending=null;render()};;$("resetCountry").onclick=$("closeCountry").onclick=()=>{S.country=null;render()};$("zoomIn").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.scaleBy,1.4);$("zoomOut").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.scaleBy,1/1.4);$("zoomReset").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.transform,d3.zoomIdentity);$("mapTab").onclick=()=>{ $("mapFrame").hidden=false;$("tableWrap").hidden=true;$("mapTab").classList.add("active");$("tableTab").classList.remove("active");$("mapTab").setAttribute("aria-pressed","true");$("tableTab").setAttribute("aria-pressed","false")};$("tableTab").onclick=()=>{$("mapFrame").hidden=true;$("tableWrap").hidden=false;$("tableTab").classList.add("active");$("mapTab").classList.remove("active");$("tableTab").setAttribute("aria-pressed","true");$("mapTab").setAttribute("aria-pressed","false")};$("csvUpload").onchange=e=>importFiles(e.target.files);$("boundaryUpload").onchange=e=>importBoundary(e.target.files[0]);$("exportButton").onclick=exportData;$("clearImports").onclick=()=>{if(!confirm("Clear imported records?"))return;S.records=[];S.demo=false;S.inventories.clear();S.sectors.clear();S.country=null;S.mapInventory="";options();render();$("uploadMessage").textContent="Imported records cleared"};$("playButton").onclick=()=>{if(S.playing){stopPlayback();return}const max=+$("yearSlider").max;if(S.year>=max)S.year=+$("yearSlider").min;S.playing=setInterval(()=>{S.year++;updateYearCaptions();$("yearSlider").value=S.year;$("yearNumber").textContent=S.year;$("mapYearBadge").textContent=S.year;updateMapYear();if(S.year>=max)stopPlayback()},650);$("playButton").textContent="Ⅱ"};
$("sourceRetry").onclick=()=>{const code=publishedKey(S.activePollutant);if(code)loadOnePublishedPollutant(code)};$("sourcesAll").onclick=()=>{S.sectors=new Set(sourceChoices());S.sectorsCleared=false;S.scaleCache=null;options();render()};$("sourcesNone").onclick=()=>{S.sectors.clear();S.sectorsCleared=true;S.scaleCache=null;options();render()};render();
fetch("./data/boundaries/world_india.geojson").then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(g=>{if(g.type!=="FeatureCollection")throw Error("Unexpected GeoJSON");S.world=g;S.unifiedMap=true;render()}).catch(e=>{$("mapCount").textContent="Basemap unavailable · "+e.message;d3.select("#worldMap").append("text").attr("x",500).attr("y",200).attr("fill","#c1d8e7").attr("text-anchor","middle").text("Map unavailable; internet required")})}
if(!window.d3){document.body.insertAdjacentHTML("afterbegin",'<div style="padding:20px;background:#612;color:#fff">Could not load D3. Please check network access.</div>');return}setup();

/* EDGAR catalog: only fetch the selected pollutant (cache other selections).
   Never combine unintentional aggregate PCB with PCB-28. */
async function loadPublishedEDGAR() {
  try {
    const response=await fetch("./data/edgar/manifest.json",{cache:"no-cache"});
    if(!response.ok)throw Error("EDGAR manifest returned HTTP "+response.status);
    const manifest=await response.json();
    if(manifest.schema!==1||manifest.inventory!=="EDGAR"||!manifest.pollutants||!Object.keys(manifest.pollutants).length)
      throw Error("Invalid EDGAR manifest");
    S.published=manifest;
    options();
    await loadOnePublishedPollutant(manifest.pollutants.PCB?"PCB":Object.keys(manifest.pollutants)[0]);
  }catch(e){
    console.error("EDGAR catalog could not load",e);
    $("uploadMessage").textContent="EDGAR not loaded: "+e.message;
  }
}
async function loadOnePublishedPollutant(code){
  const info=S.published?.pollutants?.[code];
  if(!info)return;
  const serial=++S.loadSerial;
  S.loadingPollutant=code;S.sectorLoadError="";S.activePollutant=publishedLabel(code);
  $("pollutantSelect").value=S.activePollutant;
  $("sourceStatus").textContent="Loading EDGAR observations…";
  $("sourceRetry").hidden=true;
  $("uploadMessage").textContent="Loading EDGAR "+publishedLabel(code)+"…";
  try {
    let rows=S.publishedCache.get(code);
    if(!rows){
      if(info.path!=="data/edgar/"+code+".json"||!/^[A-Za-z0-9_]+$/.test(code))
        throw Error("Unexpected dataset path");
      const response=await fetch("./"+info.path+"?v="+String(info.archive_sha256||"").slice(0,12));
      if(!response.ok)throw Error(info.path+" returned HTTP "+response.status);
      const payload=await response.json();
      if(payload.schema!==1||payload.inventory!=="EDGAR"||payload.pollutant!==code||payload.units!=="tonnes/year"||!Array.isArray(payload.records))
        throw Error("Invalid EDGAR data file: "+code);
      rows=payload.records.map((item,index)=>{
        if(!Array.isArray(item)||item.length!==5)throw Error("Invalid record "+index);
        const [country,iso,year,sector,emissions]=item;
        if(typeof country!=="string"||typeof iso!=="string"||!Number.isInteger(year)||!Number.isFinite(emissions)||emissions<0)
          throw Error("Invalid emissions record "+index);
        return{country,iso,year,sector:edgarSectorLabel(sector),emissions,pollutant:publishedLabel(code),inventory:"EDGAR",region:"Unclassified"};
      });
      if(!rows.length)throw Error("Empty EDGAR dataset: "+code);
      S.publishedCache.set(code,rows);
    }
    if(serial!==S.loadSerial)return;
    const existing=S.records.filter(r=>r.inventory!=="EDGAR");
    S.records=[...existing,...rows];S.scaleCache=null;
    S.demo=false;
    S.country=null;
    S.inventories=new Set(["EDGAR",...existing.map(r=>r.inventory)]);
    if(!S.sectors.size&&!S.sectorsCleared)S.sectors=new Set(EDGAR_SECTORS);
    S.mapInventory="EDGAR";
    S.year=yearRange(rows).max;
    S.loadingPollutant=null;S.activePollutant=publishedLabel(code);
    $("pollutantSelect").value=S.activePollutant;
    options();
    render();
    $("uploadMessage").textContent="EDGAR "+publishedLabel(code)+" loaded: "+rows.length.toLocaleString()+" observations.";
  }catch(e){
    if(serial!==S.loadSerial)return;
    console.error("EDGAR load failed for "+code,e);
    S.loadingPollutant=null;
    S.sectorLoadError="EDGAR observations unavailable: "+e.message;
    $("sourceStatus").textContent=S.sectorLoadError;
    $("sourceRetry").hidden=false;
    $("uploadMessage").textContent="EDGAR "+publishedLabel(code)+" unavailable: "+e.message;
  }
}

/* Load the supplied India shapefile after it has been converted to local GeoJSON.
   The user-provided archive has no independently verified official provenance.
   Keep the generic world map masked if the boundary is missing or invalid. */
async function loadLocalIndiaBoundary() {
  try {
    const response = await fetch("./data/boundaries/india.geojson", {cache:"force-cache"});
    if (!response.ok) {
      $("boundaryStatus").textContent = "India boundary not installed; upload GeoJSON or add data/boundaries/india.geojson.";
      return;
    }
    const geo = await response.json();
    if (geo.type !== "FeatureCollection" || geo.features?.length !== 1) {
      throw Error("Expected one India feature in GeoJSON");
    }
    const f = geo.features[0];
    if (!["Polygon","MultiPolygon"].includes(f.geometry?.type)) {
      throw Error("India geometry must be polygonal");
    }
    const bounds = d3.geoBounds(geo);
    if (bounds[0][0]<60 || bounds[1][0]>105 || bounds[0][1]<0 || bounds[1][1]>42) {
      throw Error("India boundary coordinates are outside the expected geographic range");
    }
    if (S.unifiedMap) return;
    S.india = geo;
    $("boundaryStatus").textContent = "";
    render();
  } catch (e) {
    $("boundaryStatus").textContent = "India boundary unavailable: "+e.message;
    console.warn("India boundary load failed", e);
  }
}
loadLocalIndiaBoundary();

fetch("./data/country-regions.json").then(r=>r.ok?r.json():Promise.reject(Error("Regional lookup missing"))).then(x=>{S.regionLookup=x.regions||{};for(const r of S.records)if(!r.region||r.region==="Unclassified")r.region=S.regionLookup[r.iso]||r.region;render()}).catch(e=>console.warn("Region lookup",e));
loadPublishedEDGAR();
loadPublishedBreivik();

/* Breivik 2016 is independent of EDGAR. One congener is loaded on demand.
   ZZZ preserves offshore emissions in global totals, never in country rankings. */
async function loadPublishedBreivik(){
 try{
  const response=await fetch("./data/breivik/default/manifest.json",{cache:"no-cache"});
  if(!response.ok){if(response.status!==404)console.warn("Breivik manifest HTTP "+response.status);return}
  const manifest=await response.json();
  if(manifest.schema!==1||manifest.inventory!=="Breivik"||manifest.scenario!=="Default"||manifest.units!=="tonnes/year"||Object.keys(manifest.pollutants||{}).length!==23)throw Error("Invalid Breivik manifest");
  S.breivik=manifest;options();render();
 }catch(e){console.error("Breivik catalog could not load",e)}
}
async function loadOneBreivikPollutant(code){
 const info=S.breivik?.pollutants?.[code];if(!info)return;
 const serial=++S.loadSerial;
 S.loadingPollutant=code;S.sectorLoadError="";S.activePollutant=breivikLabel(code);
 $("mapCount").textContent="Loading Breivik "+S.activePollutant+"…";
 try{
  let rows=S.breivikCache.get(code);
  if(!rows){
   if(!/^(PCB[0-9]+|Sum22)$/.test(code)||info.path!=="data/breivik/default/"+code+".json")throw Error("Unexpected Breivik data path");
   const response=await fetch("./"+info.path+"?v="+String(S.breivik.source_archive_sha256||"").slice(0,12));
   if(!response.ok)throw Error(info.path+" returned HTTP "+response.status);
   const payload=await response.json();
   if(payload.schema!==1||payload.inventory!=="Breivik"||payload.scenario!=="Default"||payload.pollutant!==code||payload.units!=="tonnes/year"||!Array.isArray(payload.records))throw Error("Invalid Breivik file: "+code);
   rows=payload.records.map((item,index)=>{
    if(!Array.isArray(item)||item.length!==5)throw Error("Invalid Breivik row "+index);
    const [country,iso,year,sector,emissions]=item;
    if(typeof country!=="string"||typeof iso!=="string"||!Number.isInteger(year)||year<1930||year>2100||sector!==BREIVIK_SECTOR||!Number.isFinite(emissions)||emissions<0)throw Error("Invalid Breivik value "+index);
    return {country,iso,year,sector,emissions,pollutant:breivikLabel(code),inventory:"Breivik",region:S.regionLookup[iso]||"Unclassified"};
   });
   if(!rows.length)throw Error("Empty Breivik data file: "+code);
   S.breivikCache.set(code,rows);
  }
  if(serial!==S.loadSerial||S.mapInventory!=="Breivik")return;
  S.records=[...S.records.filter(r=>r.inventory!=="Breivik"),...rows];
  S.demo=false;S.country=null;S.scaleCache=null;S.loadingPollutant=null;S.activePollutant=breivikLabel(code);
  options();render();
 }catch(e){
  if(serial!==S.loadSerial)return;
  S.loadingPollutant=null;S.sectorLoadError="Breivik observations unavailable: "+e.message;
  $("mapCount").textContent=S.sectorLoadError;console.error(S.sectorLoadError,e);
 }
}
})();