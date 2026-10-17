"""Prepare NILU Breivik Default inventory with the exact POPs Atlas GeoJSON boundaries."""
import argparse,hashlib,json,re,zipfile,csv
from collections import Counter
from pathlib import Path
import numpy as np,pandas as pd
from shapely.geometry import Point,box,shape
from shapely.strtree import STRtree
from shapely.validation import make_valid
EXPECTED='02d821c09c7629d2fd3a83688d58828fe9795636ab3010f0fc517a5cd7d1b29d'
def digest(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()
def save(p,o):p.write_text(json.dumps(o,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
def run(zippath,geopath,out):
 out.mkdir(parents=True,exist_ok=True)
 if digest(zippath)!=EXPECTED:raise ValueError('Unexpected source ZIP SHA256; refuse unverified source')
 geo=json.loads(geopath.read_text(encoding='utf-8'))
 polys=[];isos=[];names=[]
 for f in geo['features']:
  iso=str(f.get('id') or (f.get('properties') or {}).get('ISO_A3') or '').upper()
  if not re.fullmatch('[A-Z]{3}',iso) or f.get('geometry',{}).get('type') not in ('Polygon','MultiPolygon'):continue
  poly=make_valid(shape(f['geometry']))
  if poly.is_empty:continue
  polys.append(poly);isos.append(iso);names.append(str((f.get('properties') or {}).get('name') or iso))
 if len(polys)<150:raise ValueError('Too few countries in POPs Atlas map')
 tree=STRtree(polys)
 with zipfile.ZipFile(zippath) as z:
  files={m.group(1):n for n in z.namelist() if (m:=re.match(r'^(PCB\d+|Sum22)Grid ',n))}
  if len(files)!=23 or 'PCB28' not in files or 'Sum22' not in files:raise ValueError('Unexpected inventory files')
  ref=pd.read_csv(z.open(files['PCB28']));years=[int(x) for x in ref.columns[2:]]
  if years!=list(range(1930,2101)):raise ValueError('Unexpected year range')
  assignments=[];methods=[]
  for lat,lon in ref[['Lat','Long']].itertuples(index=False,name=None):
   pt=Point(float(lon),float(lat));hits=sorted((int(i) for i in tree.query(pt,predicate='intersects')),key=lambda i:isos[i])
   if hits:assignments.append(isos[hits[0]]);methods.append('center_in_polygon');continue
   cell=box(float(lon)-.5,float(lat)-.5,float(lon)+.5,float(lat)+.5)
   candidates=[(polys[int(i)].intersection(cell).area,isos[int(i)]) for i in tree.query(cell,predicate='intersects')]
   candidates=[v for v in candidates if v[0]>1e-12]
   if candidates:
    candidates.sort(key=lambda v:(-v[0],v[1]));assignments.append(candidates[0][1]);methods.append('cell_land_overlap')
   else:assignments.append('ZZZ');methods.append('unassigned')
  assignments=np.array(assignments);codes=sorted(set(assignments));idx={c:np.flatnonzero(assignments==c) for c in codes}
  lookup=dict(zip(isos,names));lookup.update({'USA':'United States','RUS':'Russia','GBR':'United Kingdom','KOR':'South Korea','PRK':'North Korea','CZE':'Czechia','TUR':'Türkiye','VNM':'Vietnam','COD':'Democratic Republic of the Congo','COG':'Republic of the Congo','ZZZ':'Unassigned grid cells'})
  qa=pd.read_csv(z.open('GlobalEmissionsQAQC 12OB 5X.txt')).set_index('Year')
  catalog={'schema':1,'inventory':'Breivik','scenario':'Default','source':'https://projects.nilu.no/globalpcb/','doi':'https://doi.org/10.1021/acs.est.5b04226','source_archive_sha256':EXPECTED,'boundary_sha256':digest(geopath),'years':[1930,2100],'units':'tonnes/year','sector_resolution':False,'country_assignment':'POPs Atlas exact map, center point then greatest intersecting land area; unassigned preserved as ZZZ','pollutants':{}}
  reports=[];totals={};sum22=np.zeros((len(ref),len(years)))
  for key in sorted((k for k in files if k!='Sum22'),key=lambda k:int(k[3:]))+['Sum22']:
   df=ref if key=='PCB28' else pd.read_csv(z.open(files[key]))
   if df.shape!=ref.shape or not np.array_equal(df[['Lat','Long']].to_numpy(),ref[['Lat','Long']].to_numpy()):raise ValueError('Coordinate mismatch '+key)
   values=df.iloc[:,2:].to_numpy(dtype=float)
   if not np.isfinite(values).all() or (values<0).any():raise ValueError('Invalid values '+key)
   if key!='Sum22':sum22+=values
   total=values.sum(axis=0);totals[key]=total;groups={c:values[ix].sum(axis=0) for c,ix in idx.items()}
   if not np.allclose(total,np.stack(list(groups.values())).sum(axis=0),rtol=1e-11,atol=1e-11):raise ValueError('Mass conservation '+key)
   records=[[lookup.get(c,c),c,y,'Not sector-resolved',float(v)] for c in codes for y,v in zip(years,groups[c]) if v>0]
   label='Σ22 PCBs (Breivik)' if key=='Sum22' else 'PCB-'+key[3:]
   save(out/(key+'.json'),{'schema':1,'inventory':'Breivik','scenario':'Default','pollutant':key,'display_name':label,'units':'tonnes/year','years':[1930,2100],'sector_resolution':False,'records':records})
   catalog['pollutants'][key]={'path':'data/breivik/default/'+key+'.json','display_name':label,'records':len(records),'units':'tonnes/year','kind':'sum_of_22_congeners' if key=='Sum22' else 'individual_congener'}
   qkey=key.replace('PCB','PCB-') if key!='Sum22' else key
   for i,y in enumerate(years):
    observed=float(total[i]);source=float(qa.at[y,qkey]);unassigned=float(groups.get('ZZZ',np.zeros(len(years)))[i])
    reports.append([key,y,observed,source,observed-source,unassigned,100*unassigned/observed if observed else 0])
  i=years.index(2016)
  if abs(totals['PCB28'][i]-18.8991789455)>1e-5 or abs(totals['Sum22'][i]-167.392218388)>1e-5:raise ValueError('2016 source QA failed')
  save(out/'manifest.json',catalog)
  with (out/'qa_global_annual.csv').open('w',newline='') as f:
   w=csv.writer(f);w.writerow(['pollutant','year','grid_total_tonnes','source_QA_rounded_tonnes','difference_tonnes','unassigned_tonnes','unassigned_percent']);w.writerows(reports)
  save(out/'qa_metadata.json',{'source_sha256':EXPECTED,'boundary_sha256':digest(geopath),'grid_cells':len(ref),'assignment_methods':dict(Counter(methods)),'country_count':len(codes)-int('ZZZ' in codes),'max_QA_difference_percent':max(100*abs(r[4])/r[2] for r in reports if r[2]>0),'max_Sum22_difference_percent':float(np.max(np.abs(totals['Sum22']-sum22.sum(axis=0))/np.maximum(totals['Sum22'],1e-15))*100),'PCB28_2016_tonnes':float(totals['PCB28'][i]),'Sum22_2016_tonnes':float(totals['Sum22'][i]),'limitations':['Border and coastal grid cells assigned wholly to one country','ZZZ is unassigned, included in global totals only','Breivik provides no sector split','Source includes scenario projections']})
  print('SUCCESS: 23 pollutants; 2016 PCB28',totals['PCB28'][i],'Sum22',totals['Sum22'][i])
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--zip',required=True,type=Path);p.add_argument('--boundaries',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();run(a.zip,a.boundaries,a.out)
