/* POPs Atlas | source-specific country inventory explorer */
(()=>{"use strict";
const $=id=>document.getElementById(id),norm=s=>String(s??"").toLowerCase().replace(/[^a-z0-9]/g,""),fmt=v=>Number.isFinite(v)?v.toLocaleString("en-US",{maximumFractionDigits:v<1?5:2}):"—",esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SECTORS=["Power Industry","Industrial combustion","Buildings","Transport","Agriculture","Fuel exploitation","Processes","Waste"],COLORS=["#67d7ff","#ffb36b","#78e0b0","#f7d86c","#b9a7ff","#ff86b9","#63e6e2","#ff8b98"],REGIONS=["Asia","Europe","Africa","North America","South America","Oceania"],COLOR_BY_SECTOR=Object.fromEntries(SECTORS.map((sector,i)=>[sector,COLORS[i]]));
// Use the official EDGAR v8.1 POPs category names across controls and charts.
const EDGAR_SECTORS=SECTORS, BREIVIK_SECTOR="Not sector-resolved";
function edgarSectorLabel(source){return({"Industrial Combustion":"Industrial combustion","Fuel Exploitation":"Fuel exploitation"})[source]||source;}
const special={unitedstatesofamerica:"unitedstates",russianfederation:"russia",czechia:"czechrepublic",republicofkorea:"southkorea",vietnam:"vietnam"};const canon=s=>special[norm(s)]||norm(s);
const DEMO_COUNTRIES=[["China","CHN","Asia",12100],["United States","USA","North America",8500],["India","IND","Asia",4200],["Russia","RUS","Europe",3500],["Japan","JPN","Asia",2210],["Germany","DEU","Europe",1760],["Brazil","BRA","South America",1310],["United Kingdom","GBR","Europe",1050],["France","FRA","Europe",940],["Canada","CAN","North America",870],["Australia","AUS","Oceania",490],["South Africa","ZAF","Africa",710],["Nigeria","NGA","Africa",460],["Argentina","ARG","South America",280],["Chile","CHL","South America",85],["Iceland","ISL","Europe",.12],["Luxembourg","LUX","Europe",.18],["New Zealand","NZL","Oceania",.25]];
const DEMO_INVENTORIES=["EDGAR","Breivik"];
const S={published:null,publishedCache:new Map(),breivik:null,breivikCatalogs:new Map(),breivikCache:new Map(),breivikScenario:"Default",loadSerial:0,activePollutant:"",loadingPollutant:null,sectorLoadError:"",sectorsCleared:false,regionLookup:{},mapTransform:null,mapZoomBehavior:null,scaleCache:null,demo:false,records:[],inventories:new Set(DEMO_INVENTORIES),sectors:new Set(SECTORS),mapInventory:"EDGAR",country:null,world:null,india:null,zoom:1,year:2020,playing:null,hiddenBanner:false,theme:localStorage.getItem("pops-theme")==="light"?"light":"dark",analysis:{mode:"pollutant-compare",inventory:"",pollutant:"",scenario:"Default",sources:[...EDGAR_SECTORS],year:null,compareYear:null,series:[],seriesUserEdited:false},analysisCache:new Map(),analysisSerial:0};
function makeDemo(){const a=[];for(const [country,iso,region,base] of DEMO_COUNTRIES){for(let year=1990;year<=2024;year++){for(let si=0;si<SECTORS.length;si++){for(const [i,inv] of DEMO_INVENTORIES.entries()){const factor=1-(year-1990)*.013,shares=[.31,.24,.09,.15,.09,.04,.05,.03];a.push({country,iso,region,year,pollutant:"PCB (illustrative)",inventory:inv,sector:SECTORS[si],emissions:base*Math.max(.1,factor)*shares[si]*(i?0.91:1)*(1+.04*Math.sin(year*.35+si))})}}}}return a}
function data(){return S.demo?makeDemoCached:S.records}const makeDemoCached=makeDemo();
function yearRange(rows){let lo=Infinity,hi=-Infinity;for(const r of rows){if(r.year<lo)lo=r.year;if(r.year>hi)hi=r.year}return{min:Number.isFinite(lo)?lo:2000,max:Number.isFinite(hi)?hi:2024}}
const publishedLabel=code=>code==="PCB"?"PCB (aggregate, unintentional)":code;
const publishedKey=label=>S.published&&Object.keys(S.published.pollutants||{}).find(code=>publishedLabel(code)===label);
const breivikCatalog=(scenario=S.breivikScenario)=>S.breivikCatalogs.get(scenario)||S.breivik;
const breivikLabelFor=(code,scenario=S.breivikScenario)=>breivikCatalog(scenario)?.pollutants?.[code]?.display_name||code;
const breivikKeyFor=(label,scenario=S.breivikScenario)=>{const catalog=breivikCatalog(scenario);return catalog&&Object.keys(catalog.pollutants||{}).find(code=>breivikLabelFor(code,scenario)===label)};
const breivikLabel=code=>breivikLabelFor(code,S.breivikScenario);
const breivikKey=label=>breivikKeyFor(label,S.breivikScenario);
const BREIVIK_SCENARIOS=["Baseline","Default","Worst-case"],BREIVIK_SCENARIO_LABEL={Baseline:"Baseline",Default:"Default","Worst-case":"Worst case"},BREIVIK_SCENARIO_PATH={Baseline:"baseline",Default:"default","Worst-case":"worst-case"};
function availableInventories(){return [...new Set([...data().map(r=>r.inventory),...(S.published?["EDGAR"]:[]),...(S.breivik?["Breivik"]:[])])].sort()}
function pollutantsFor(inv){const list=[...new Set(data().filter(r=>r.inventory===inv).map(r=>r.pollutant))];if(inv==="EDGAR"&&S.published)list.push(...Object.keys(S.published.pollutants).map(publishedLabel));
 if(inv==="Breivik"&&S.breivik)list.push(...Object.keys(S.breivik.pollutants).map(breivikLabel));return [...new Set(list)].sort()}
function sourceChoices(){
 if(S.mapInventory==="Breivik"&&S.breivik)return [BREIVIK_SECTOR];
 if(S.mapInventory==="EDGAR"&&S.published)return [...EDGAR_SECTORS];
 return [...new Set(data().filter(r=>r.inventory===S.mapInventory&&r.pollutant===S.activePollutant).map(r=>r.sector))].sort();
}
function options(){
 const inv=availableInventories();
 if(!inv.includes(S.mapInventory))S.mapInventory=inv[0]||"";
 if(S.mapInventory==="Breivik"&&S.breivikCatalogs.size)S.breivik=S.breivikCatalogs.get(S.breivikScenario)||S.breivikCatalogs.get("Default")||[...S.breivikCatalogs.values()][0];
 S.inventories=new Set(inv);
 const inventory=$("inventorySelect");
 inventory.replaceChildren();
 inv.forEach(name=>inventory.add(new Option(({"EDGAR":"EDGAR v8.1 POPs","Breivik":"Breivik PCBs (2016)"})[name]||name,name)));
 inventory.value=S.mapInventory;inventory.disabled=!inv.length;
 const scenarioField=$("scenarioField"),scenarioSelect=$("scenarioSelect"),showScenario=S.mapInventory==="Breivik"&&S.breivikCatalogs.size>0;
 $("filterStrip").classList.toggle("has-scenario",showScenario);scenarioField.hidden=!showScenario;
 if(showScenario){scenarioSelect.replaceChildren();BREIVIK_SCENARIOS.filter(name=>S.breivikCatalogs.has(name)).forEach(name=>scenarioSelect.add(new Option(BREIVIK_SCENARIO_LABEL[name]+" scenario",name)));scenarioSelect.value=S.breivikScenario;}
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
  const label=document.createElement("label");label.className="choice-row";label.title=sector;
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
function canvas(){const t=document.documentElement;t.dataset.theme=S.theme;const b=$("themeToggle");b.querySelector(".theme-caption").textContent=S.theme==="dark"?"Dark":"Light";b.setAttribute("aria-label","Switch to "+(S.theme==="dark"?"light":"dark")+" theme");document.querySelector('meta[name="theme-color"]').content=S.theme==="dark"?"#081727":"#f3f7fc"}
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
function linePlot(){
 const root=d3.select("#trendPlot");root.attr("class","plot-wrap").style("position","relative").selectAll("*").remove();
 const leg=$("trendLegend");leg.replaceChildren();
 const sources=[...S.sectors];
 const series=sources.map(sector=>({name:sector,color:COLOR_BY_SECTOR[sector]||COLORS[0],points:grouped(filter(S.mapInventory,S.year,S.country,false,true).filter(r=>r.sector===sector),"year").map(v=>({year:+v.name,value:v.value})).sort((a,b)=>a.year-b.year)})).filter(s=>s.points.length);
 $("trendScope").textContent=S.country||"GLOBAL";
 $("trendSubtitle").textContent=(S.mapInventory||"No inventory")+" · "+(S.country||"worldwide")+" · tonnes/year";
 if(!series.length){root.html('<div class="empty-chart">No emissions history for this selection</div>');return}
 series.forEach(s=>{const el=document.createElement("span");el.className="legend-key";el.innerHTML='<i style="background:'+esc(s.color)+'"></i>'+esc(s.name);leg.append(el)});
 const compact=window.matchMedia("(max-width:700px)").matches,w=compact?360:760,h=compact?280:320,m=compact?{top:18,right:10,bottom:42,left:56}:{top:22,right:20,bottom:49,left:82},ys=series.flatMap(s=>s.points),ext=d3.extent(ys,d=>d.year);
 const x=d3.scaleLinear().domain(ext[0]===ext[1]?[ext[0]-1,ext[1]+1]:ext).range([m.left,w-m.right]),y=d3.scaleLinear().domain([0,d3.max(ys,d=>d.value)||1]).nice().range([h-m.bottom,m.top]),svg=root.append("svg").attr("viewBox","0 0 "+w+" "+h).attr("preserveAspectRatio","xMidYMid meet");
 svg.selectAll(".trend-grid").data(y.ticks(5)).join("line").attr("class","trend-grid").attr("x1",m.left).attr("x2",w-m.right).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","var(--line)").attr("opacity",.7);
 svg.append("g").attr("class","chart-axis").attr("transform","translate(0,"+(h-m.bottom)+")").call(d3.axisBottom(x).ticks(compact?4:7).tickFormat(d3.format("d")));
 svg.append("g").attr("class","chart-axis").attr("transform","translate("+m.left+",0)").call(d3.axisLeft(y).ticks(compact?4:5).tickFormat(d3.format("~s")));
 series.forEach(s=>{svg.append("path").datum(s.points).attr("fill","none").attr("stroke",s.color).style("stroke",s.color).attr("stroke-width",2.6).attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.value)));svg.selectAll("circle.c"+norm(s.name)).data(s.points).join("circle").attr("cx",d=>x(d.year)).attr("cy",d=>y(d.value)).attr("r",3.3).attr("fill",s.color).style("fill",s.color).style("pointer-events","none")});
 svg.append("text").attr("class","axis-title").attr("transform","translate("+(compact?15:20)+","+((m.top+h-m.bottom)/2)+") rotate(-90)").attr("text-anchor","middle").text("Emissions (tonnes/year)");
 svg.append("line").attr("class","trend-current-year").attr("x1",x(S.year)).attr("x2",x(S.year)).attr("y1",m.top).attr("y2",h-m.bottom).attr("stroke","var(--muted)").attr("stroke-dasharray","4 4").attr("opacity",.75);
 const years=[...new Set(ys.map(point=>point.year))].sort((a,b)=>a-b),guide=svg.append("line").attr("class","trend-hover-guide").attr("y1",m.top).attr("y2",h-m.bottom).attr("stroke","var(--text)").attr("stroke-dasharray","3 3").attr("opacity",.85).style("display","none"),tip=document.createElement("div");tip.className="plot-tooltip analysis-shared-tooltip";tip.hidden=true;root.node().append(tip);
 const nearest=raw=>years.reduce((best,value)=>Math.abs(value-raw)<Math.abs(best-raw)?value:best,years[0]),show=event=>{const [mx]=d3.pointer(event,svg.node()),selectedYear=nearest(x.invert(mx)),values=series.map(s=>({...s,point:s.points.find(point=>point.year===selectedYear)}));guide.attr("x1",x(selectedYear)).attr("x2",x(selectedYear)).style("display",null);tip.innerHTML="<strong>Year: "+selectedYear+"</strong>"+values.map(item=>'<span><i style="background:'+esc(item.color)+'"></i><b>'+esc(item.name)+"</b><br>Emissions: "+(item.point?fmt(item.point.value):"—")+" tonnes/year</span>").join("");tip.hidden=false;const box=root.node().getBoundingClientRect();tip.style.left=Math.max(6,Math.min(box.width-tip.offsetWidth-6,event.clientX-box.left+14))+"px";tip.style.top=Math.max(6,Math.min(box.height-tip.offsetHeight-6,event.clientY-box.top-tip.offsetHeight-10))+"px"};
 svg.append("rect").attr("class","trend-hover-overlay").attr("x",m.left).attr("y",m.top).attr("width",w-m.left-m.right).attr("height",h-m.top-m.bottom).attr("fill","transparent").style("cursor","crosshair").on("pointermove",show).on("pointerleave",()=>{guide.style("display","none");tip.hidden=true});
}
function donut(){const root=d3.select("#sectorDonut");root.selectAll("*").remove();const list=$("sectorLegend");list.replaceChildren();if(S.mapInventory==="Breivik"){root.html('<div class="empty-chart">Source-sector breakdown not available in the Breivik inventory.</div>');return}const items=grouped(filter(S.mapInventory,S.year,null,true),"sector").sort((a,b)=>b.value-a.value),total=sum(items.map(v=>({emissions:v.value})));if(!total){root.html('<div class="empty-chart">No sector breakdown</div>');return}const w=240,h=220,r=88,g=root.append("svg").attr("viewBox","0 0 "+w+" "+h).append("g").attr("transform","translate(120,110)"),pie=d3.pie().sort(null).value(d=>d.value);const slices=g.selectAll("path").data(pie(items)).join("path").attr("d",d3.arc().innerRadius(58).outerRadius(r)).attr("fill",d=>COLOR_BY_SECTOR[d.data.name]||COLORS[0]).style("fill",d=>COLOR_BY_SECTOR[d.data.name]||COLORS[0]).attr("stroke","var(--panel)").attr("stroke-width",2).style("cursor","crosshair");plotTooltip(root.node(),slices,d=>"<strong>"+esc(d.data.name)+"</strong><span>"+fmt(d.data.value)+" tonnes/year · "+fmt(100*d.data.value/total)+"%</span>");g.append("text").attr("text-anchor","middle").attr("y",0).attr("fill","var(--text)").attr("font-size",23).attr("font-weight",700).text(fmt(total));g.append("text").attr("text-anchor","middle").attr("y",18).attr("fill","var(--muted)").attr("font-size",10).text("tonnes/year");items.forEach(v=>{const color=COLOR_BY_SECTOR[v.name]||COLORS[0],div=document.createElement("div");div.className="donut-item";div.innerHTML='<span><i style="background:'+color+'"></i>'+esc(v.name)+'</span><b>'+fmt(v.value/total*100)+'%<span class="donut-sub">'+fmt(v.value)+' t/yr</span></b>';list.append(div)})}
function region(){
 const root=d3.select("#regionalChart");root.selectAll("*").remove();
 const rows=filter(S.mapInventory,S.year,null,true).filter(isCountryRecord).map(r=>({...r,region:S.regionLookup[r.iso]}));
 const entries=grouped(rows,"region").sort((a,b)=>b.value-a.value);
 if(!entries.length){root.html('<div class="empty-chart">No continent-level country observations available</div>');return}
 const compact=window.matchMedia("(max-width:700px)").matches,w=compact?360:790,h=compact?320:370,m=compact?{t:40,r:10,b:66,l:54}:{t:46,r:23,b:76,l:93};
 const x=d3.scaleBand().domain(entries.map(d=>d.name)).range([m.l,w-m.r]).padding(.32);
 const y=d3.scaleLinear().domain([0,d3.max(entries,d=>d.value)||1]).nice().range([h-m.b,m.t]);
 const svg=root.append("svg").attr("viewBox","0 0 "+w+" "+h).attr("preserveAspectRatio","xMidYMid meet");
 svg.append("g").attr("class","chart-axis").attr("transform","translate("+m.l+",0)").call(d3.axisLeft(y).ticks(compact?4:6).tickFormat(d3.format("~s")));
 const xAxis=d3.axisBottom(x).tickSize(0).tickPadding(compact?11:18);if(compact)xAxis.tickFormat(d=>d.replace("North ","N. ").replace("South ","S. "));
 svg.append("g").attr("class","chart-axis").attr("transform","translate(0,"+(h-m.b)+")").call(xAxis).selectAll("text").style("font-size",compact?"10px":"13px");
 svg.append("text").attr("class","axis-title").attr("transform","translate("+(compact?15:23)+","+((m.t+h-m.b)/2)+") rotate(-90)").attr("text-anchor","middle").text("Emissions (tonnes/year)");
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
const projection=d3.geoEquirectangular().scale(148).translate([500,232]),geoPath=d3.geoPath(projection);
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
function updateLocationSummary(){const rows=byCountry(),selected=S.country?rows.find(r=>canon(r.name)===canon(S.country)||r.iso===S.country):null;$("countryName").textContent=selected?displayCountryName(selected.name,selected.iso):S.country||"Global";$("countryEmission").textContent=selected?fmt(selected.value):S.country?"No observation":fmt(rows.reduce((v,r)=>v+r.value,0));$("countryDetail").textContent=S.mapInventory+(S.mapInventory==="Breivik"?" · "+BREIVIK_SCENARIO_LABEL[S.breivikScenario]:"")+" · "+S.year+" · tonnes/year";$("closeCountry").hidden=!S.country}
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
 // Keep labels centered over open water and wrap them so they do not compete with country plots.
 const oceanLabels=[
  {lines:["NORTH PACIFIC","OCEAN"],lon:-142,lat:32},{lines:["SOUTH PACIFIC","OCEAN"],lon:-136,lat:-29},
  {lines:["NORTH ATLANTIC","OCEAN"],lon:-36,lat:34},{lines:["SOUTH ATLANTIC","OCEAN"],lon:-24,lat:-30},
  {lines:["INDIAN","OCEAN"],lon:78,lat:-26},{lines:["ARCTIC","OCEAN"],lon:-155,lat:79},{lines:["SOUTHERN","OCEAN"],lon:0,lat:-57}
 ];
 countries.append("g").attr("class","ocean-labels").selectAll("text").data(oceanLabels).join("text")
  .attr("x",d=>projection([d.lon,d.lat])[0]).attr("y",d=>projection([d.lon,d.lat])[1]-4)
  .attr("text-anchor","middle").each(function(d){d3.select(this).selectAll("tspan").data(d.lines).join("tspan").attr("x",projection([d.lon,d.lat])[0]).attr("dy",(_,i)=>i?"1.12em":0).text(v=>v)});
 const revealMapZoom=()=>$("mapFrame")?.classList.add("map-interacted");
 svg.on("pointerdown.mapControls",revealMapZoom).on("wheel.mapControls",revealMapZoom).on("touchstart.mapControls",revealMapZoom);
 if(!S.mapZoomBehavior)S.mapZoomBehavior=d3.zoom().filter(e=>e.type==="wheel"?!e.ctrlKey:e.type==="touchstart"?e.touches.length>1:!e.button).scaleExtent([1,8]).translateExtent([[0,0],[1000,465]]).extent([[0,0],[1000,465]]).on("zoom",e=>{if(e.sourceEvent)revealMapZoom();S.mapTransform=e.transform;svg.select(".map-contents").attr("transform",e.transform)});
 svg.call(S.mapZoomBehavior).on("dblclick.zoom",null);svg.call(S.mapZoomBehavior.transform,S.mapTransform||d3.zoomIdentity);
 $("legendScale").style.background="linear-gradient("+(window.matchMedia("(max-width:700px)").matches?"to right":"to top")+","+MAP_COLORS.join(",")+")";
 $("legendScale").title="Logarithmic scale fixed across years; upper bound at the 98th percentile of positive country-year totals";
 updateMapYear();
 updateLocationSummary();
}
function dataTable(){const rows=countryRows().sort((a,b)=>b.value-a.value),root=$("tableBody");root.replaceChildren();rows.forEach(r=>{const tr=document.createElement("tr");tr.innerHTML="<td>"+esc(r.name)+"</td><td>"+esc(r.iso||r.rows[0]?.iso||"—")+"</td><td>"+fmt(r.value)+"</td>";tr.style.cursor="pointer";tr.onclick=()=>{S.country=r.name;render()};root.append(tr)})}
const ANALYSIS_CONFIG={
 "pollutant-compare":{label:"Compare pollutants",description:"Compare pollutant definitions across their shared years. Add up to six series; the controls wrap three series per row. Choose one Breivik scenario per line, or combine EDGAR source categories.",fields:["series"],lead:"Choose up to six clear pollutant definitions: Breivik uses one scenario per line, while EDGAR can sum the source categories you select. Move across the chart by year to compare them together."},
 "peak-cumulative":{label:"Find the peak year",description:"See the annual trajectory, the highest reported year, and the selected year for one pollutant definition.",fields:["inventory","context","pollutant","year"],lead:"Choose one Breivik scenario or an EDGAR source total. The peak is marked on the line; hover across the series to inspect every annual total."},
 "change-map":{label:"Spatial year comparison",description:"Map the percentage change from a reference year to a target year for every observed country and selected source or scenario.",fields:["inventory","context","pollutant","compareYear","year"],lead:"Choose one Breivik scenario or an EDGAR source total. Hover over a country to see its percentage change, reference value, and target value. Blue means a decrease; red means an increase."}
};
const ANALYSIS_MODES=Object.entries(ANALYSIS_CONFIG).map(([value,config])=>[value,config.label]);
const ANALYSIS_FIELD_IDS={inventory:"analysisInventory",context:"analysisContextField",pollutant:"analysisPollutant",year:"analysisYear",compareYear:"analysisCompareYearField",series:"analysisSeriesField"};
const ANALYSIS_MAX_SERIES=6;
const ANALYSIS_LINE_COLORS=["#67d7ff","#ffb36b","#b9a7ff","#78e0b0","#f7d86c","#ff86b9"];
const ANALYSIS_NO_DATA_COLOR="#526579";
const ANALYSIS_MAP_COLORS=["#275d9a","#36bfd0","#6ed393","#eef1f3","#f4dd57","#f68e45","#c63856"];
function analysisInventoryLabels(inv,scenario=S.breivikScenario){
 const catalog=inv==="EDGAR"?S.published:inv==="Breivik"?breivikCatalog(scenario):null;
 const labels=catalog?Object.keys(catalog.pollutants||{}).map(code=>inv==="EDGAR"?publishedLabel(code):breivikLabelFor(code,scenario)):[...new Set(data().filter(r=>r.inventory===inv).map(r=>r.pollutant))];
 return [...new Set(labels)].sort((a,b)=>a.localeCompare(b));
}
function analysisInfo(inv,label,scenario=S.breivikScenario){
 if(inv==="EDGAR"){const code=publishedKey(label);return code?{code,info:S.published?.pollutants?.[code]}:null}
 if(inv==="Breivik"){const code=breivikKeyFor(label,scenario);const catalog=breivikCatalog(scenario);return code?{code,info:catalog?.pollutants?.[code]}:null}
 return null;
}
function analysisBounds(inv,label,scenario=S.breivikScenario){
 const i=analysisInfo(inv,label,scenario),catalog=inv==="Breivik"?breivikCatalog(scenario):null;
 if(inv==="EDGAR"&&i?.info?.years)return{min:+i.info.years[0],max:+i.info.years[1]};
 if(inv==="Breivik"&&catalog?.years)return{min:+catalog.years[0],max:+catalog.years[1]};
 const rows=data().filter(r=>r.inventory===inv&&(!label||r.pollutant===label));return yearRange(rows);
}
function analysisYears(inv,label,scenario=S.breivikScenario){const b=analysisBounds(inv,label,scenario),out=[];for(let y=b.min;y<=b.max;y++)out.push(y);return out}
function analysisRegion(r){return REGIONS.includes(S.regionLookup[r.iso])?S.regionLookup[r.iso]:REGIONS.includes(r.region)?r.region:""}
function analysisIsCountry(r){const name=String(r.country||r.name||"");return r.iso!=="ZZZ"&&analysisRegion(r)&&!/^(int[,. ]*shipping|international shipping|international aviation)$/i.test(name)}
function analysisYearRows(rows,year){return rows.filter(r=>r.year===year)}
function analysisCountryRows(rows,year){const map=new Map();for(const r of analysisYearRows(rows,year)){if(!analysisIsCountry(r))continue;const key=r.iso||canon(r.country);if(!map.has(key))map.set(key,{name:r.country,iso:r.iso,value:0});map.get(key).value+=r.emissions}return[...map.values()]}
function analysisGlobal(rows,year){return sum(analysisYearRows(rows,year))}
function analysisTotalsByYear(rows){const map=new Map();for(const r of rows)map.set(r.year,(map.get(r.year)||0)+r.emissions);return[...map.entries()].map(([year,value])=>({year:+year,value})).sort((a,b)=>a.year-b.year)}
function analysisFmtPct(v){return Number.isFinite(v)?(v>=0?"+":"")+fmt(v)+"%":"—"}
function analysisFmtSigned(v){return Number.isFinite(v)?(v>=0?"+":"")+fmt(v):"—"}
function analysisSetOptions(select,values,value){if(!select)return;const current=value&&values.includes(value)?value:values[0]||"";select.replaceChildren(...values.map(v=>new Option(v,v)));select.value=current;return current}
function analysisSetYearOptions(select,values,value){const current=values.includes(+value)?+value:values[values.length-1];select.replaceChildren(...values.map(v=>new Option(String(v),String(v))));if(Number.isFinite(current))select.value=String(current);return current}
function analysisSourceSummary(sources){const selected=EDGAR_SECTORS.filter(source=>sources?.includes(source));if(selected.length===EDGAR_SECTORS.length)return"All sources";if(selected.length===1)return selected[0];return selected.length+" sources"}
function analysisSeriesLabel(item){const pollutant=item.pollutant||"Pollutant";if(item.inventory==="Breivik")return"Breivik · "+(BREIVIK_SCENARIO_LABEL[item.scenario]||item.scenario||"Default")+" · "+pollutant;return item.inventory+" · "+pollutant+" · "+analysisSourceSummary(item.sources)}
function analysisBuildSourcePicker(entry,index,onChange,ariaLabel="EDGAR sources for pollutant "+(index+1)){
 const picker=document.createElement("div");picker.className="analysis-source-picker";
 const trigger=document.createElement("button");trigger.type="button";trigger.className="analysis-source-trigger";trigger.setAttribute("aria-label",ariaLabel);trigger.setAttribute("aria-expanded","false");trigger.textContent=analysisSourceSummary(entry.sources);
 const menu=document.createElement("div");menu.className="analysis-source-menu";menu.hidden=true;menu.setAttribute("role","menu");
 const actions=document.createElement("div");actions.className="analysis-source-actions";
 const all=document.createElement("button");all.type="button";all.textContent="All";const none=document.createElement("button");none.type="button";none.textContent="None";
 all.onclick=event=>{event.preventDefault();event.stopPropagation();entry.sources=[...EDGAR_SECTORS];onChange()};
 none.onclick=event=>{event.preventDefault();event.stopPropagation();entry.sources=[];onChange()};actions.append(all,none);
 const sourceOptions=document.createElement("div");sourceOptions.className="analysis-source-options";
 EDGAR_SECTORS.forEach(source=>{const sourceLabel=document.createElement("label");sourceLabel.className="analysis-source-option";const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=entry.sources.includes(source);checkbox.onchange=()=>{entry.sources=EDGAR_SECTORS.filter(value=>value===source?checkbox.checked:entry.sources.includes(value));onChange()};sourceLabel.append(checkbox,document.createTextNode(source));sourceOptions.append(sourceLabel)});
 menu.append(actions,sourceOptions);trigger.onclick=event=>{event.preventDefault();event.stopPropagation();menu.hidden=!menu.hidden;trigger.setAttribute("aria-expanded",String(!menu.hidden))};picker.append(trigger,menu);return picker;
}
function analysisRenderSeriesControls(){
 const root=$("analysisSeriesRows"),add=$("analysisAddSeries"),a=S.analysis,invs=availableInventories();
 if(!root)return;
 const primary=a.inventory&&invs.includes(a.inventory)?a.inventory:invs[0]||"",secondary=invs.find(value=>value!==primary)||primary;
 const duplicateDefault=!a.seriesUserEdited&&Array.isArray(a.series)&&a.series.length===2&&invs.length>1&&(a.series.every(item=>item.inventory===primary)||a.series.every(item=>item.inventory===secondary));
 const needsDefaultSeries=!Array.isArray(a.series)||a.series.length<2||(!a.seriesUserEdited&&(a.series.some(item=>!invs.includes(item.inventory))||duplicateDefault));
 if(needsDefaultSeries)
  a.series=[{inventory:primary,scenario:primary==="Breivik"?S.breivikScenario:"",pollutant:a.pollutant||"",sources:primary==="EDGAR"?[...EDGAR_SECTORS]:[]},{inventory:secondary,scenario:secondary==="Breivik"?S.breivikScenario:"",pollutant:"",sources:secondary==="EDGAR"?[...EDGAR_SECTORS]:[]}];
 if(a.series.length>ANALYSIS_MAX_SERIES)a.series=a.series.slice(0,ANALYSIS_MAX_SERIES);
 root.replaceChildren();
 a.series.forEach((entry,index)=>{
  const row=document.createElement("div");row.className="analysis-series-row";
  entry.inventory=invs.includes(entry.inventory)?entry.inventory:(index?secondary:primary);
  if(entry.inventory==="Breivik"){
   const availableScenarios=BREIVIK_SCENARIOS.filter(name=>S.breivikCatalogs.has(name));
   entry.scenario=availableScenarios.includes(entry.scenario)?entry.scenario:(availableScenarios.includes(S.breivikScenario)?S.breivikScenario:availableScenarios[0]||S.breivikScenario);
   entry.sources=[];
  }else{
   entry.scenario="";
   entry.sources=EDGAR_SECTORS.filter(source=>Array.isArray(entry.sources)?entry.sources.includes(source):true);
  }
  const invField=document.createElement("div");invField.className="analysis-series-control";
  const invLabel=document.createElement("label");invLabel.textContent="Inventory";invField.append(invLabel);
  const invSelect=document.createElement("select");invSelect.className="analysis-series-inventory";invSelect.setAttribute("aria-label","Inventory "+(index+1));invs.forEach(value=>invSelect.add(new Option(value,value)));invSelect.value=entry.inventory;invField.append(invSelect);

  const contextField=document.createElement("div");contextField.className="analysis-series-control analysis-series-context";
  const contextLabel=document.createElement("label");contextLabel.textContent=entry.inventory==="Breivik"?"Scenario":"Sources";contextField.append(contextLabel);
  if(entry.inventory==="Breivik"){
   const scenarioSelect=document.createElement("select");scenarioSelect.className="analysis-series-scenario";scenarioSelect.setAttribute("aria-label","Breivik scenario for pollutant "+(index+1));BREIVIK_SCENARIOS.filter(name=>S.breivikCatalogs.has(name)).forEach(value=>scenarioSelect.add(new Option(BREIVIK_SCENARIO_LABEL[value]+" scenario",value)));scenarioSelect.value=entry.scenario;contextField.append(scenarioSelect);
   scenarioSelect.onchange=()=>{a.seriesUserEdited=true;entry.scenario=scenarioSelect.value;const labels=analysisInventoryLabels(entry.inventory,entry.scenario);if(!labels.includes(entry.pollutant))entry.pollutant=labels[0]||"";renderAnalysis()};
  }else{
   contextField.append(analysisBuildSourcePicker(entry,index,()=>{a.seriesUserEdited=true;renderAnalysis()}));
  }

  const polField=document.createElement("div");polField.className="analysis-series-control";
  const polLabel=document.createElement("label");polLabel.textContent="Pollutant";polField.append(polLabel);
  const labels=analysisInventoryLabels(entry.inventory,entry.scenario);entry.pollutant=labels.includes(entry.pollutant)?entry.pollutant:labels[0]||"";
  const polSelect=document.createElement("select");polSelect.className="analysis-series-pollutant";polSelect.setAttribute("aria-label","Pollutant "+(index+1));labels.forEach(value=>polSelect.add(new Option(value,value)));polSelect.value=entry.pollutant;polField.append(polSelect);
  row.append(invField,contextField,polField);
  if(a.series.length>2){const remove=document.createElement("button");remove.type="button";remove.className="analysis-series-remove";remove.setAttribute("aria-label","Remove pollutant series "+(index+1));remove.textContent="×";remove.onclick=()=>{a.seriesUserEdited=true;a.series.splice(index,1);renderAnalysis()};row.append(remove)}
  invSelect.onchange=()=>{a.seriesUserEdited=true;entry.inventory=invSelect.value;entry.scenario=entry.inventory==="Breivik"?S.breivikScenario:"";entry.sources=entry.inventory==="EDGAR"?[...EDGAR_SECTORS]:[];entry.pollutant=analysisInventoryLabels(entry.inventory,entry.scenario)[0]||"";renderAnalysis()};
  polSelect.onchange=()=>{a.seriesUserEdited=true;entry.pollutant=polSelect.value;renderAnalysis()};
  root.append(row);
 });
 if(add){const canAdd=a.series.length<ANALYSIS_MAX_SERIES;add.disabled=!canAdd;add.textContent=canAdd?"+ Add pollutant series":"Maximum 6 pollutant series";add.title=canAdd?"Add another pollutant series":"The comparison is limited to six pollutant series"}
}

function analysisRenderContextControl(){
 const field=$("analysisContextField"),label=$("analysisContextLabel"),root=$("analysisContextControl"),a=S.analysis;
 if(!field||!label||!root)return;
 root.replaceChildren();
 if(a.inventory==="Breivik"){
  label.textContent="Scenario";const availableScenarios=BREIVIK_SCENARIOS.filter(name=>S.breivikCatalogs.has(name)),scenarios=availableScenarios.length?availableScenarios:[S.breivikScenario];a.scenario=scenarios.includes(a.scenario)?a.scenario:(scenarios.includes(S.breivikScenario)?S.breivikScenario:scenarios[0]);
  const wrap=document.createElement("div");wrap.className="select-wrap";const select=document.createElement("select");select.setAttribute("aria-label","Select Breivik scenario");scenarios.forEach(value=>select.add(new Option(BREIVIK_SCENARIO_LABEL[value]+" scenario",value)));select.value=a.scenario;select.onchange=()=>{a.scenario=select.value;a.year=null;a.compareYear=null;renderAnalysis()};wrap.append(select,document.createElement("span"));wrap.lastChild.className="chevron";wrap.lastChild.setAttribute("aria-hidden","true");wrap.lastChild.textContent="⌄";root.append(wrap);field.hidden=false;return;
 }
 if(a.inventory==="EDGAR"){
  label.textContent="Sources";a.sources=EDGAR_SECTORS.filter(source=>Array.isArray(a.sources)?a.sources.includes(source):true);const entry={sources:[...a.sources]};root.append(analysisBuildSourcePicker(entry,0,()=>{a.sources=[...entry.sources];a.year=null;a.compareYear=null;renderAnalysis()},"EDGAR sources for focused analysis"));field.hidden=false;return;
 }
 field.hidden=true;
}

function analysisSyncControls(){
 const a=S.analysis,mode=$("analysisMode"),inv=$("analysisInventory"),pol=$("analysisPollutant"),year=$("analysisYear"),compareYear=$("analysisCompareYear");
 analysisSetOptions(mode,ANALYSIS_MODES.map(x=>x[0]),a.mode);mode.querySelectorAll("option").forEach(o=>{const item=ANALYSIS_MODES.find(x=>x[0]===o.value);if(item)o.textContent=item[1]});a.mode=mode.value;
 const config=ANALYSIS_CONFIG[a.mode]||ANALYSIS_CONFIG["pollutant-compare"];
 $("analysisDescription").textContent=config.description;
 $("analysisControls").dataset.analysisMode=a.mode;
 const invs=availableInventories();a.inventory=analysisSetOptions(inv,invs,a.inventory||S.mapInventory)||"";
 const labels=analysisInventoryLabels(a.inventory,a.scenario);a.pollutant=analysisSetOptions(pol,labels,a.pollutant||((a.inventory===S.mapInventory)?S.activePollutant:""))||"";
 analysisRenderContextControl();
 const years=analysisYears(a.inventory,a.pollutant,a.scenario);a.year=analysisSetYearOptions(year,years,a.year??S.year);
 const compareDefault=a.mode==="change-map"?(years.filter(y=>y<a.year).at(-1)??years[0]):years[0],compareYears=years;
 a.compareYear=analysisSetYearOptions(compareYear,compareYears,a.compareYear??compareDefault);
 if(a.mode==="pollutant-compare")analysisRenderSeriesControls();
 Object.entries(ANALYSIS_FIELD_IDS).forEach(([name,id])=>{const node=$(id),field=node?.classList.contains("analysis-field")?node:node?.closest(".analysis-field");if(field)field.hidden=!config.fields.includes(name)||(name==="context"&&!['EDGAR','Breivik'].includes(a.inventory))});
 const labelsByMode=a.mode==="change-map"?{analysisInventory:"Inventory",analysisPollutant:"Pollutant",analysisCompareYear:"Reference year",analysisYear:"Target year"}:{analysisInventory:"Inventory",analysisPollutant:"Pollutant",analysisYear:"Year"};
 Object.entries(labelsByMode).forEach(([id,text])=>{const field=$(id)?.closest(".analysis-field");const label=field?.querySelector("label");if(label)label.textContent=text});
}
async function analysisRows(inv,label,options={}){
 const scenario=inv==="Breivik"?(options.scenario||S.breivikScenario):"",sourceFilter=inv==="EDGAR"&&Array.isArray(options.sources)?EDGAR_SECTORS.filter(source=>options.sources.includes(source)):null,key=[inv,scenario,label].join("|");
 let rows=S.analysisCache.get(key);
 if(!rows){
  if(inv!=="EDGAR"&&inv!=="Breivik"){
   rows=data().filter(r=>r.inventory===inv&&r.pollutant===label);S.analysisCache.set(key,rows);
  }else{
   const i=analysisInfo(inv,label,scenario);if(!i?.info)throw Error("The selected inventory catalog is still loading");
   const expected=inv==="EDGAR"?"data/edgar/"+i.code+".json":"data/breivik/"+BREIVIK_SCENARIO_PATH[scenario]+"/"+i.code+".json";
   if(i.info.path!==expected)throw Error("Unexpected dataset path");
   const cached=inv==="EDGAR"?S.publishedCache.get(i.code):S.breivikCache.get(scenario+":"+i.code);
   if(cached)rows=cached;
   else{
    const catalog=inv==="EDGAR"?S.published:breivikCatalog(scenario),archiveHash=inv==="EDGAR"?catalog?.archive_sha256:catalog?.source_archive_sha256;
    const response=await fetch("./"+i.info.path+"?v="+String(archiveHash||"").slice(0,12));if(!response.ok)throw Error(i.info.path+" returned HTTP "+response.status);const payload=await response.json();
    if(payload.schema!==1||payload.inventory!==inv||payload.pollutant!==i.code||payload.units!=="tonnes/year"||!Array.isArray(payload.records))throw Error("Invalid "+inv+" data file: "+i.code);
    rows=payload.records.map((item,index)=>{if(!Array.isArray(item)||item.length!==5)throw Error("Invalid record "+index);const[country,iso,year,sector,emissions]=item;if(typeof country!=="string"||typeof iso!=="string"||!Number.isInteger(year)||!Number.isFinite(emissions)||emissions<0)throw Error("Invalid emissions record "+index);return{country,iso,year,sector:inv==="EDGAR"?edgarSectorLabel(sector):sector,emissions,pollutant:inv==="EDGAR"?publishedLabel(i.code):breivikLabelFor(i.code,scenario),inventory:inv,region:S.regionLookup[iso]||"Unclassified"}});
    if(inv==="Breivik"&&payload.scenario!==scenario)throw Error("Breivik scenario mismatch");
    if(inv==="EDGAR")S.publishedCache.set(i.code,rows);else S.breivikCache.set(scenario+":"+i.code,rows);
   }
   S.analysisCache.set(key,rows);
  }
 }
 return sourceFilter?rows.filter(row=>sourceFilter.includes(row.sector)):rows;
}
function analysisLead(text){const root=$("analysisLead");root.hidden=!text;root.textContent=text||""}
function analysisSummary(items){const root=$("analysisSummary");root.innerHTML=items.map(item=>'<div class="analysis-stat"><small>'+esc(item.label)+'</small><strong>'+esc(item.value==null?"—":String(item.value))+'</strong>'+(item.detail?'<span>'+esc(item.detail)+'</span>':"")+'</div>').join("")}
function analysisEmpty(message){$("analysisChart").innerHTML='<div class="analysis-empty">'+esc(message)+"</div>"}
function analysisLineChart(series,markers=[]){
 const root=d3.select("#analysisChart");root.attr("class","analysis-chart analysis-line-chart").style("position","relative").selectAll("*").remove();
 const points=series.flatMap(s=>s.points),ext=d3.extent(points,d=>d.year);if(!points.length){analysisEmpty("No annual values are available for this selection.");return}
 const legend=document.createElement("div");legend.className="analysis-line-legend";legend.innerHTML=series.map(s=>'<span><i style="background:'+esc(s.color)+'"></i>'+esc(s.name)+"</span>").join("");root.node().append(legend);
 const compact=window.matchMedia("(max-width:700px)").matches,w=compact?360:920,h=compact?270:330,m=compact?{top:24,right:12,bottom:43,left:58}:{top:26,right:24,bottom:50,left:78},x=d3.scaleLinear().domain(ext[0]===ext[1]?[ext[0]-1,ext[1]+1]:ext).range([m.left,w-m.right]),y=d3.scaleLinear().domain([0,d3.max(points,d=>d.value)||1]).nice().range([h-m.bottom,m.top]),svg=root.append("svg").attr("viewBox","0 0 "+w+" "+h).attr("preserveAspectRatio","xMidYMid meet");
 svg.selectAll(".analysis-grid").data(y.ticks(5)).join("line").attr("class","analysis-grid").attr("x1",m.left).attr("x2",w-m.right).attr("y1",d=>y(d)).attr("y2",d=>y(d)).attr("stroke","var(--line)").attr("opacity",.7);
 svg.append("g").attr("class","chart-axis").attr("transform","translate(0,"+(h-m.bottom)+")").call(d3.axisBottom(x).ticks(compact?4:8).tickFormat(d3.format("d")));
 svg.append("g").attr("class","chart-axis").attr("transform","translate("+m.left+",0)").call(d3.axisLeft(y).ticks(compact?4:5).tickFormat(d3.format("~s")));
 series.forEach(s=>{svg.append("path").datum(s.points).attr("fill","none").attr("stroke",s.color).attr("stroke-width",3).attr("d",d3.line().x(d=>x(d.year)).y(d=>y(d.value)));svg.selectAll(".analysis-dot-"+norm(s.name)).data(s.points).join("circle").attr("class","analysis-dot-"+norm(s.name)).attr("cx",d=>x(d.year)).attr("cy",d=>y(d.value)).attr("r",compact?3.4:4).attr("fill",s.color).style("fill",s.color).style("pointer-events","none")});
 markers.forEach(marker=>{svg.append("line").attr("x1",x(marker.year)).attr("x2",x(marker.year)).attr("y1",m.top).attr("y2",h-m.bottom).attr("stroke",marker.color||"var(--muted)").attr("stroke-dasharray","5 4").attr("opacity",.9);svg.append("text").attr("x",Math.min(w-m.right-4,Math.max(m.left+4,x(marker.year)+5)).toString()).attr("y",m.top-8).attr("fill",marker.color||"var(--muted)").attr("font-size",compact?10:11).text(marker.label||marker.year)});
 svg.append("text").attr("class","axis-title").attr("transform","translate("+(compact?16:22)+","+((m.top+h-m.bottom)/2)+") rotate(-90)").attr("text-anchor","middle").text("Emissions (tonnes/year)");
 const years=[...new Set(points.map(point=>point.year))].sort((a,b)=>a-b),guide=svg.append("line").attr("y1",m.top).attr("y2",h-m.bottom).attr("stroke","var(--muted)").attr("stroke-dasharray","4 4").attr("opacity",.9).style("display","none"),tip=document.createElement("div");tip.className="plot-tooltip analysis-shared-tooltip";tip.hidden=true;root.node().append(tip);
 const nearest=raw=>years.reduce((best,value)=>Math.abs(value-raw)<Math.abs(best-raw)?value:best,years[0]),show=(event)=>{const [mx]=d3.pointer(event,svg.node()),selectedYear=nearest(x.invert(mx)),values=series.map(s=>{const point=s.points.reduce((best,value)=>Math.abs(value.year-selectedYear)<Math.abs(best.year-selectedYear)?value:best,s.points[0]);return{...s,point}});guide.attr("x1",x(selectedYear)).attr("x2",x(selectedYear)).style("display",null);tip.innerHTML="<strong>Year: "+selectedYear+"</strong>"+values.map(item=>'<span><i style="background:'+esc(item.color)+'"></i><b>'+esc(item.name)+"</b><br>Emissions: "+fmt(item.point.value)+" tonnes/year</span>").join("");tip.hidden=false;const box=root.node().getBoundingClientRect();tip.style.left=Math.max(6,Math.min(box.width-tip.offsetWidth-6,event.clientX-box.left+14))+"px";tip.style.top=Math.max(6,event.clientY-box.top-tip.offsetHeight-10)+"px"};
 svg.append("rect").attr("x",m.left).attr("y",m.top).attr("width",w-m.left-m.right).attr("height",h-m.top-m.bottom).attr("fill","transparent").style("cursor","crosshair").on("pointermove",show).on("pointerleave",()=>{guide.style("display","none");tip.hidden=true});
}
function analysisRenderMap(deltas){
 const root=$("analysisChart");root.className="analysis-chart analysis-map-wrap";root.style.position="relative";if(!S.world){analysisEmpty("Basemap is still loading; no spatial comparison is available yet.");return}
 const values=deltas.map(d=>d.pct).filter(Number.isFinite),minPct=values.length?d3.min(values):0,maxPct=values.length?d3.max(values):0,mixed=minPct<0&&maxPct>0,zeroPct=mixed?50:maxPct>0?0:100,zeroLabelPct=mixed?50:zeroPct,interpolator=d3.piecewise(d3.interpolateRgb,ANALYSIS_MAP_COLORS),gradientFor=colors=>"linear-gradient(90deg,"+colors.map((color,index)=>color+" "+(index*100/(colors.length-1))+"%").join(",")+")",zeroMarkup=mixed?'<b class="analysis-map-legend-zero-marker" style="left:'+zeroPct+'%"></b><span class="analysis-map-legend-zero" style="left:'+zeroLabelPct+'%">0%</span>':"";
 let scale,gradient;
 if(mixed){scale=d3.scaleDiverging(interpolator).domain([minPct,0,maxPct]).clamp(true);gradient=gradientFor(ANALYSIS_MAP_COLORS)}
 else if(maxPct>0){const colors=ANALYSIS_MAP_COLORS.slice(3);scale=d3.scaleSequential(d3.piecewise(d3.interpolateRgb,colors)).domain([minPct,maxPct||1]).clamp(true);gradient=gradientFor(colors)}
 else {const colors=ANALYSIS_MAP_COLORS.slice(0,4);scale=d3.scaleSequential(d3.piecewise(d3.interpolateRgb,colors)).domain([minPct||-1,maxPct]).clamp(true);gradient=gradientFor(colors)}
 const byISO=new Map(deltas.map(d=>[String(d.iso||"").toUpperCase(),d])),svg=d3.create("svg").attr("viewBox","0 0 1000 465").attr("preserveAspectRatio","xMidYMid meet");
 svg.append("rect").attr("class","ocean").attr("width",1000).attr("height",465);
 const paths=svg.append("g").attr("class","map-contents").selectAll("path.map-country").data(S.world.features).join("path").attr("class","map-country").attr("d",geoPath).attr("fill",feature=>{const iso=String(feature.id||feature.properties?.ISO_A3||"").toUpperCase(),item=byISO.get(iso);return item?scale(item.pct):ANALYSIS_NO_DATA_COLOR}).attr("stroke","var(--panel)").attr("stroke-width",.7).style("cursor","help");
 const oceanLabels=[{lines:["NORTH PACIFIC","OCEAN"],lon:-142,lat:32},{lines:["SOUTH PACIFIC","OCEAN"],lon:-136,lat:-29},{lines:["NORTH ATLANTIC","OCEAN"],lon:-36,lat:34},{lines:["SOUTH ATLANTIC","OCEAN"],lon:-24,lat:-30},{lines:["INDIAN","OCEAN"],lon:78,lat:-26},{lines:["ARCTIC","OCEAN"],lon:-155,lat:79},{lines:["SOUTHERN","OCEAN"],lon:0,lat:-57}];
 svg.append("g").attr("class","ocean-labels").selectAll("text").data(oceanLabels).join("text").attr("x",d=>projection([d.lon,d.lat])[0]).attr("y",d=>projection([d.lon,d.lat])[1]-4).attr("text-anchor","middle").each(function(d){d3.select(this).selectAll("tspan").data(d.lines).join("tspan").attr("x",projection([d.lon,d.lat])[0]).attr("dy",(_,i)=>i?"1.12em":0).text(v=>v)});
 paths.append("title").text(feature=>{const iso=String(feature.id||feature.properties?.ISO_A3||"").toUpperCase(),item=byISO.get(iso);return item?displayCountryName(item.name,item.iso)+" · "+analysisFmtPct(item.pct)+" · "+item.referenceYear+" → "+item.targetYear:"No observation"});
 root.replaceChildren(svg.node());plotTooltip(root,paths,feature=>{const iso=String(feature.id||feature.properties?.ISO_A3||"").toUpperCase(),item=byISO.get(iso);return item?"<strong>"+esc(displayCountryName(item.name,item.iso))+"</strong><span>Percentage change: "+analysisFmtPct(item.pct)+"</span><span>Reference year ("+item.referenceYear+"): "+fmt(item.old)+" tonnes/year</span><span>Target year ("+item.targetYear+"): "+fmt(item.now)+" tonnes/year</span>":"<strong>No observation</strong>"});const legend=document.createElement("div");legend.className="analysis-map-legend";legend.innerHTML='<strong>Percentage change</strong><div class="analysis-map-legend-track"><i style="background:'+gradient+'"></i><span class="analysis-map-legend-min">'+analysisFmtPct(minPct)+'</span>'+zeroMarkup+'<span class="analysis-map-legend-max">'+analysisFmtPct(maxPct)+'</span></div><small>Reference year → Target year</small><span class="analysis-map-legend-no-data"><i style="background:'+ANALYSIS_NO_DATA_COLOR+'"></i>No observation</span>';root.append(legend);
}
async function analysisCompute(a,serial){
 const inv=a.inventory,label=a.pollutant,context={inventory:inv,pollutant:label,scenario:a.scenario,sources:a.sources},contextLabel=analysisSeriesLabel(context);
 if(a.mode==="pollutant-compare"){
  const selections=(a.series||[]).filter(item=>item?.inventory&&item?.pollutant);
  if(selections.length<2)throw Error("Select at least two pollutants to compare.");
  const missingSources=selections.find(item=>item.inventory==="EDGAR"&&!Array.isArray(item.sources)?true:item.inventory==="EDGAR"&&!item.sources.length);
  if(missingSources)throw Error("Select at least one EDGAR source for every EDGAR series.");
  const datasets=await Promise.all(selections.map(item=>analysisRows(item.inventory,item.pollutant,{scenario:item.scenario,sources:item.sources})));if(serial!==S.analysisSerial)return;const totals=datasets.map(rows=>analysisTotalsByYear(rows));
  const commonYears=totals.reduce((shared,current)=>{const years=new Set(current.map(point=>point.year));return shared.filter(year=>years.has(year))},totals[0].map(point=>point.year)).sort((x,y)=>x-y);
  if(!commonYears.length)throw Error("These pollutants do not share a common year.");
  const series=totals.map((points,index)=>({name:analysisSeriesLabel(selections[index]),color:ANALYSIS_LINE_COLORS[index%ANALYSIS_LINE_COLORS.length],points:points.filter(point=>commonYears.includes(point.year))}));
  const peaks=series.map(item=>item.points.reduce((best,point)=>point.value>best.value?point:best,item.points[0])),highest=peaks.reduce((best,peak,index)=>peak.value>best.value?{...peak,name:series[index].name}:best,{value:-Infinity});
  analysisSummary([{label:"Common timeframe",value:commonYears[0]+"–"+commonYears.at(-1),detail:commonYears.length+" shared years"},{label:"Pollutants compared",value:series.length,detail:"one line per selected definition"},{label:"Highest peak",value:fmt(highest.value),detail:highest.name+" · "+highest.year},{label:"Latest plotted year",value:commonYears.at(-1),detail:series.length+" values available"}]);
  analysisLineChart(series);
  $("analysisNote").textContent="Each line uses its selected context: one Breivik scenario, or the sum of the chosen EDGAR source categories. Hover across the plot by year to compare every line.";
  return;
 }
 if(!inv||!label)throw Error("Choose an inventory and pollutant");
 const rows=await analysisRows(inv,label,{scenario:a.scenario,sources:a.sources});if(serial!==S.analysisSerial)return;const year=a.year,years=analysisTotalsByYear(rows);
 if(a.mode==="peak-cumulative"){
  const peak=years.reduce((x,y)=>y.value>x.value?y:x,years[0]||{year,value:0}),selected=analysisGlobal(rows,year);
  analysisSummary([{label:"Peak year",value:peak.year,detail:fmt(peak.value)+" tonnes/year"},{label:"Peak total",value:fmt(peak.value),detail:"annual emissions"},{label:"Selected year",value:year,detail:fmt(selected)+" tonnes/year"},{label:"Selected vs peak",value:peak.value?fmt(selected/peak.value*100)+"%":"—",detail:"of peak annual total"}]);
  analysisLineChart([{name:contextLabel,color:ANALYSIS_LINE_COLORS[0],points:years}],[{year:peak.year,color:"var(--orange)",label:"Peak"},{year:year,color:"var(--blue)",label:"Selected"}]);
  $("analysisNote").textContent="Move across the chart by year to inspect the selected pollutant total. The selected year and peak year are marked. The line uses "+contextLabel+".";
  return;
 }
 if(a.mode==="change-map"){
  const compare=a.compareYear??analysisYears(inv,label,a.scenario)[0],old=analysisCountryRows(rows,compare),now=analysisCountryRows(rows,year),om=new Map(old.map(x=>[x.iso||canon(x.name),x])),nm=new Map(now.map(x=>[x.iso||canon(x.name),x]));
  const deltas=[...om.keys()].filter(k=>nm.has(k)).map(k=>{const x=om.get(k),y=nm.get(k),oldValue=x.value,nowValue=y.value,raw=oldValue>0?(nowValue-oldValue)/oldValue*100:nowValue>0?100:0;return{name:y.name,iso:y.iso,delta:nowValue-oldValue,pct:raw,old:oldValue,now:nowValue,referenceYear:compare,targetYear:year}});
  const globalOld=analysisGlobal(rows,compare),globalNow=analysisGlobal(rows,year),globalPct=globalOld?((globalNow-globalOld)/globalOld*100):NaN,inc=deltas.filter(x=>x.pct>0).sort((x,y)=>y.pct-x.pct),dec=deltas.filter(x=>x.pct<0).sort((x,y)=>x.pct-y.pct);
  analysisSummary([{label:"Overall change",value:analysisFmtPct(globalPct),detail:contextLabel+" · "+compare+" → "+year},{label:"Countries increasing",value:inc.length,detail:deltas.length+" countries compared"},{label:"Largest increase",value:inc[0]?displayCountryName(inc[0].name,inc[0].iso):"—",detail:inc[0]?analysisFmtPct(inc[0].pct):""},{label:"Largest decrease",value:dec[0]?displayCountryName(dec[0].name,dec[0].iso):"—",detail:dec[0]?analysisFmtPct(dec[0].pct):""}]);
  analysisRenderMap(deltas);
  $("analysisNote").textContent="The map compares countries observed in both selected years. Countries missing either year are shown as No observation and excluded from percentage calculations.";
  return;
 }
 throw Error("Choose one of the available analysis questions.");
}
function renderAnalysis(){
 const serial=++S.analysisSerial;analysisSyncControls();analysisLead(ANALYSIS_CONFIG[S.analysis.mode]?.lead||"");$("analysisStatus").className="analysis-status loading";$("analysisStatus").textContent="Calculating analysis…";$("analysisSummary").innerHTML="";$("analysisChart").className="analysis-chart";$("analysisChart").innerHTML="";$("analysisNote").textContent="";
 const snapshot={...S.analysis,series:Array.isArray(S.analysis.series)?S.analysis.series.map(item=>({...item})):[]};analysisCompute(snapshot,serial).then(()=>{if(serial!==S.analysisSerial)return;$("analysisStatus").className="analysis-status";$("analysisStatus").textContent=S.analysis.mode==="pollutant-compare"?"Updated for "+S.analysis.series.length+" selected pollutants":"Updated for "+S.analysis.inventory+" · "+S.analysis.pollutant+" · "+S.analysis.year}).catch(e=>{if(serial!==S.analysisSerial)return;$("analysisStatus").className="analysis-status error";$("analysisStatus").textContent=e.message;analysisEmpty("Analysis unavailable for this selection.")});
}
function render(){updateYearCaptions();$("yearNumber").textContent=S.year;$("mapYearBadge").textContent=S.year;KPIs();linePlot();donut();region();topPolluters();insights();dataTable();if(S.world&&d3.select("#worldMap").select(".map-contents").size())updateMapYear();else drawMap();updateLocationSummary();renderAnalysis()}
function exportData(){let rows=filter(S.mapInventory,S.year,S.country);if(!rows.length){alert("No observations in selected view");return}const keys=["country","iso3","region","year","pollutant","inventory","emission_source","emissions_tonnes_per_year","unit"],s=[keys.join(","),...rows.map(r=>[r.country,r.iso,r.region,r.year,r.pollutant,r.inventory,r.sector,r.emissions,"tonnes/year"].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))].join("\n"),url=URL.createObjectURL(new Blob([s],{type:"text/csv"})),a=document.createElement("a");a.href=url;a.download="pops-emissions-"+S.year+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function stopPlayback(redraw=true){if(S.playing){clearInterval(S.playing);S.playing=null;$("playButton").textContent="▶";if(redraw)render()}}
function setup(){canvas();options();
$("themeToggle").onclick=()=>{S.theme=S.theme==="dark"?"light":"dark";localStorage.setItem("pops-theme",S.theme);canvas();render()};
$("pollutantSelect").onchange=()=>{stopPlayback(false);S.activePollutant=$("pollutantSelect").value;if(S.analysis.inventory===S.mapInventory)S.analysis.pollutant=S.activePollutant;S.sectors=new Set();S.sectorsCleared=false;S.scaleCache=null;const key=publishedKey(S.activePollutant),bk=breivikKey(S.activePollutant);if(bk&&S.mapInventory==="Breivik")loadOneBreivikPollutant(bk);else if(key&&S.mapInventory==="EDGAR"&&!S.demo)loadOnePublishedPollutant(key);else{options();render()}};
$("scenarioSelect").onchange=e=>{if(S.mapInventory!=="Breivik"||!S.breivikCatalogs.has(e.target.value))return;stopPlayback(false);++S.loadSerial;S.breivikScenario=e.target.value;S.breivik=S.breivikCatalogs.get(S.breivikScenario);S.breivikCache.clear();S.loadingPollutant=null;S.sectorLoadError="";S.sectors=new Set();S.sectorsCleared=false;S.scaleCache=null;S.country=null;S.year=2016;options();const bk=breivikKey(S.activePollutant);if(bk)loadOneBreivikPollutant(bk);else render()};
$("inventorySelect").onchange=e=>{stopPlayback(false);++S.loadSerial;S.loadingPollutant=null;S.sectorLoadError="";S.mapInventory=e.target.value;S.analysis.inventory=S.mapInventory;S.analysis.pollutant="";S.analysis.year=null;S.activePollutant="";S.sectors=new Set();S.sectorsCleared=false;S.scaleCache=null;if(S.mapInventory==="Breivik"){S.breivik=S.breivikCatalogs.get(S.breivikScenario)||S.breivikCatalogs.get("Default");S.year=2016}options();const key=publishedKey(S.activePollutant),bk=breivikKey(S.activePollutant);if(bk&&S.mapInventory==="Breivik")loadOneBreivikPollutant(bk);else if(key&&S.mapInventory==="EDGAR"&&!S.demo)loadOnePublishedPollutant(key);else render()};
let yearFrame=0,yearPending=null;
$("yearSlider").oninput=e=>{
 stopPlayback(false);yearPending=+e.target.value;
 $("yearNumber").textContent=yearPending;$("mapYearBadge").textContent=yearPending;if(S.analysis.inventory===S.mapInventory)S.analysis.year=yearPending;
 if(yearFrame)return;
 yearFrame=requestAnimationFrame(()=>{yearFrame=0;if(yearPending===null)return;S.year=yearPending;yearPending=null;updateYearCaptions();updateMapYear();updateLocationSummary()});
};
$("yearSlider").onchange=()=>{if(yearFrame){cancelAnimationFrame(yearFrame);yearFrame=0}S.year=+$("yearSlider").value;if(S.analysis.inventory===S.mapInventory)S.analysis.year=S.year;yearPending=null;render()};;$("resetCountry").onclick=$("closeCountry").onclick=()=>{S.country=null;render()};$("zoomIn").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.scaleBy,1.4);$("zoomOut").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.scaleBy,1/1.4);$("zoomReset").onclick=()=>d3.select("#worldMap").call(S.mapZoomBehavior.transform,d3.zoomIdentity);$("mapTab").onclick=()=>{ $("mapFrame").hidden=false;$("tableWrap").hidden=true;$("mapTab").classList.add("active");$("tableTab").classList.remove("active");$("mapTab").setAttribute("aria-pressed","true");$("tableTab").setAttribute("aria-pressed","false")};$("tableTab").onclick=()=>{$("mapFrame").hidden=true;$("tableWrap").hidden=false;$("tableTab").classList.add("active");$("mapTab").classList.remove("active");$("tableTab").setAttribute("aria-pressed","true");$("mapTab").setAttribute("aria-pressed","false")};$("exportButton").onclick=exportData;$("playButton").onclick=()=>{if(S.playing){stopPlayback();return}const max=+$("yearSlider").max;if(S.year>=max)S.year=+$("yearSlider").min;S.playing=setInterval(()=>{S.year++;updateYearCaptions();$("yearSlider").value=S.year;$("yearNumber").textContent=S.year;$("mapYearBadge").textContent=S.year;updateMapYear();if(S.year>=max)stopPlayback()},650);$("playButton").textContent="Ⅱ"};
$("analysisMode").onchange=e=>{S.analysis.mode=e.target.value;if(S.analysis.mode==="change-map")S.analysis.compareYear=null;renderAnalysis()};
$("analysisInventory").onchange=e=>{S.analysis.inventory=e.target.value;S.analysis.pollutant="";S.analysis.scenario=S.analysis.inventory==="Breivik"?S.breivikScenario:"";S.analysis.sources=S.analysis.inventory==="EDGAR"?[...EDGAR_SECTORS]:[];S.analysis.year=null;S.analysis.compareYear=null;renderAnalysis()};
$("analysisPollutant").onchange=e=>{S.analysis.pollutant=e.target.value;S.analysis.year=null;renderAnalysis()};
$("analysisYear").onchange=e=>{S.analysis.year=+e.target.value;renderAnalysis()};
$("analysisCompareYear").onchange=e=>{S.analysis.compareYear=+e.target.value;renderAnalysis()};
$('analysisAddSeries').onclick=()=>{if(S.analysis.series?.length>=ANALYSIS_MAX_SERIES)return;const invs=availableInventories(),last=S.analysis.series?.at(-1),inventory=invs.find(x=>x!==last?.inventory)||invs[0]||"",scenario=inventory==="Breivik"?S.breivikScenario:"",pollutant=analysisInventoryLabels(inventory,scenario)[0]||"",sources=inventory==="EDGAR"?[...EDGAR_SECTORS]:[];S.analysis.seriesUserEdited=true;S.analysis.series=[...(S.analysis.series||[]),{inventory,scenario,pollutant,sources}];renderAnalysis()};
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
    S.analysis.inventory="EDGAR";S.analysis.pollutant=publishedLabel(code);S.analysis.year=S.year;S.analysis.compareYear=S.year;
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
  const loaded=await Promise.all(BREIVIK_SCENARIOS.map(async scenario=>{
   const response=await fetch("./data/breivik/"+BREIVIK_SCENARIO_PATH[scenario]+"/manifest.json",{cache:"no-cache"});
   if(!response.ok)throw Error("Breivik "+scenario+" manifest HTTP "+response.status);
   const manifest=await response.json();
   if(manifest.schema!==1||manifest.inventory!=="Breivik"||manifest.scenario!==scenario||manifest.units!=="tonnes/year"||Object.keys(manifest.pollutants||{}).length!==23)throw Error("Invalid Breivik "+scenario+" manifest");
   return[scenario,manifest];
  }));
  S.breivikCatalogs=new Map(loaded);S.breivik=S.breivikCatalogs.get(S.breivikScenario)||S.breivikCatalogs.get("Default");options();render();
 }catch(e){console.error("Breivik catalog could not load",e)}
}
async function loadOneBreivikPollutant(code){
 const info=S.breivik?.pollutants?.[code];if(!info)return;
 const serial=++S.loadSerial;
 S.loadingPollutant=code;S.sectorLoadError="";S.activePollutant=breivikLabel(code);
 $("mapCount").textContent="Loading Breivik "+S.activePollutant+"…";
 try{
  const cacheKey=S.breivikScenario+":"+code;let rows=S.breivikCache.get(cacheKey);
  if(!rows){
   const scenarioPath=BREIVIK_SCENARIO_PATH[S.breivikScenario];
   if(!/^(PCB[0-9]+|Sum22)$/.test(code)||info.path!=="data/breivik/"+scenarioPath+"/"+code+".json")throw Error("Unexpected Breivik data path");
   const response=await fetch("./"+info.path+"?v="+String(S.breivik.source_archive_sha256||"").slice(0,12));
   if(!response.ok)throw Error(info.path+" returned HTTP "+response.status);
   const payload=await response.json();
   if(payload.schema!==1||payload.inventory!=="Breivik"||payload.scenario!==S.breivikScenario||payload.pollutant!==code||payload.units!=="tonnes/year"||!Array.isArray(payload.records))throw Error("Invalid Breivik file: "+code);
   rows=payload.records.map((item,index)=>{
    if(!Array.isArray(item)||item.length!==5)throw Error("Invalid Breivik row "+index);
    const [country,iso,year,sector,emissions]=item;
    if(typeof country!=="string"||typeof iso!=="string"||!Number.isInteger(year)||year<1930||year>2100||sector!==BREIVIK_SECTOR||!Number.isFinite(emissions)||emissions<0)throw Error("Invalid Breivik value "+index);
    return {country,iso,year,sector,emissions,pollutant:breivikLabel(code),inventory:"Breivik",region:S.regionLookup[iso]||"Unclassified"};
   });
   if(!rows.length)throw Error("Empty Breivik data file: "+code);
   S.breivikCache.set(cacheKey,rows);
  }
  if(serial!==S.loadSerial||S.mapInventory!=="Breivik")return;
  S.records=[...S.records.filter(r=>r.inventory!=="Breivik"),...rows];
  S.demo=false;S.country=null;S.scaleCache=null;S.loadingPollutant=null;S.activePollutant=breivikLabel(code);S.analysis.inventory="Breivik";S.analysis.pollutant=breivikLabel(code);S.analysis.year=S.year;S.analysis.compareYear=S.year;
  options();render();
 }catch(e){
  if(serial!==S.loadSerial)return;
  S.loadingPollutant=null;S.sectorLoadError="Breivik observations unavailable: "+e.message;
  $("mapCount").textContent=S.sectorLoadError;console.error(S.sectorLoadError,e);
 }
}
let compactChartLayout=window.matchMedia("(max-width:700px)").matches;
window.addEventListener("resize",()=>{
 const nextCompactLayout=window.matchMedia("(max-width:700px)").matches;
 if(nextCompactLayout===compactChartLayout)return;
 compactChartLayout=nextCompactLayout;
 $("legendScale").style.background="linear-gradient("+(compactChartLayout?"to right":"to top")+","+MAP_COLORS.join(",")+")";
 if(!S.records.length)return;
 linePlot();
 region();
});
})();
