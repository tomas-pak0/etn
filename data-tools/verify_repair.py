import collections,gzip,json,pathlib,zipfile
root=pathlib.Path(__file__).parent
out=(root.parent/'ETN' if (root.parent/'ETN').is_dir() else root.parent/'etn-064'/'ETN')/'data'
excluded={'PPLCH','PPLH','PPLQ','PPLW','PPLX'}
def rows():
 with zipfile.ZipFile(root/'allCountries.zip').open('allCountries.txt') as src:
  for line in src:
   cols=line.decode('utf-8').rstrip('\n').split('\t')
   if len(cols)<15 or cols[6]!='P' or cols[7] in excluded or not cols[8] or not cols[1]:continue
   try:lat,lon=float(cols[4]),float(cols[5]);ident=int(cols[0]);pop=int(cols[14] or 0)
   except ValueError:continue
   code=cols[8]
   if len(code)!=2 or not code.isalpha():continue
   tile=f'{min(89,max(0,int((lat+90)//2))):02d}-{min(179,max(0,int((lon+180)//2))):03d}'
   yield tile,[ident,cols[1],round(lat,5),round(lon,5),code,cols[7],cols[10],cols[11],pop]
expected=collections.Counter(tile for tile,_ in rows())
actual={p.stem:len(json.load(gzip.open(p,'rt'))) for p in (out/'places').glob('*.bin')}
bad={tile for tile,n in expected.items() if actual.get(tile)!=n}
print('Mismatched tiles',len(bad),'missing records',sum(expected[t]-actual.get(t,0) for t in bad),flush=True)
if bad:
 fixed={tile:[] for tile in bad}
 for tile,row in rows():
  if tile in fixed:fixed[tile].append(row)
 for tile,records in fixed.items():
  with gzip.open(out/'places'/(tile+'.bin'),'wt',encoding='utf-8',compresslevel=6) as dst:
   json.dump(records,dst,ensure_ascii=False,separators=(',',':'))
  assert len(records)==expected[tile]
print('Verified records',sum(expected.values()),flush=True)
