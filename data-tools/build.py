"""Build offline GeoNames settlement tiles and a country denominator snapshot."""
import collections, gzip, json, pathlib, zipfile
from functools import lru_cache

root=pathlib.Path(__file__).parent
out=(root.parent/'ETN' if (root.parent/'ETN').is_dir() else root.parent/'etn-064'/'ETN')/'data'
shards=out/'places'
shards.mkdir(parents=True,exist_ok=True)
tmp=root/'tiles';tmp.mkdir(exist_ok=True)
excluded={'PPLCH','PPLH','PPLQ','PPLW','PPLX'}
counts=collections.Counter()
tiles=collections.Counter()
@lru_cache(maxsize=96)
def writer(tile):
    # Unbuffered output avoids losing the last rows when the LRU closes handles.
    return (tmp/(tile+'.txt')).open('ab',buffering=0)
with zipfile.ZipFile(root/'allCountries.zip').open('allCountries.txt') as src:
    for line in src:
        cols=line.decode('utf-8').rstrip('\n').split('\t')
        if len(cols)<15 or cols[6]!='P' or cols[7] in excluded or not cols[8] or not cols[1]:continue
        try:
            lat,lon=float(cols[4]),float(cols[5]);ident=int(cols[0]);pop=int(cols[14] or 0)
        except ValueError:continue
        code=cols[8]
        if len(code)!=2 or not code.isalpha():continue
        tile=f'{min(89,max(0,int((lat+90)//2))):02d}-{min(179,max(0,int((lon+180)//2))):03d}'
        record=[ident,cols[1],round(lat,5),round(lon,5),code,cols[7],cols[10],cols[11],pop]
        writer(tile).write((json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n').encode())
        counts[code]+=1;tiles[tile]+=1
writer.cache_clear()
print('Records',sum(counts.values()),'tiles',len(tiles),'LT',counts['LT'],flush=True)
for i,(tile,amount) in enumerate(tiles.items()):
    target=shards/(tile+'.bin')
    with (tmp/(tile+'.txt')).open('rb') as src,gzip.open(target,'wb',compresslevel=6) as dst:
        dst.write(b'[')
        first=True
        for row in src:
            if not first:dst.write(b',')
            dst.write(row.strip());first=False
        dst.write(b']')
    (tmp/(tile+'.txt')).unlink()
    if i%1000==0:print('Packed',i,'/',len(tiles),flush=True)

admin1={}
admin2={}
for filename,dest in [('admin1CodesASCII.txt',admin1),('admin2Codes.txt',admin2)]:
    with (root/filename).open(encoding='utf-8') as src:
        for line in src:
            row=line.rstrip('\n').split('\t')
            if len(row)>1:dest[row[0]]=row[1]
info={}
with (root/'countryInfo.txt').open(encoding='utf-8') as src:
    for line in src:
        if line.startswith('#'):continue
        row=line.rstrip('\n').split('\t')
        if len(row)<17:continue
        info[row[0]]={'name':row[4],'capital':row[5],'population':int(row[7] or 0),
          'currency':row[10],'languages':row[15].split(',')[:4]}
metadata={'snapshot':'2026-09-29','source':'GeoNames CC BY 4.0','counts':counts,'countries':info,'tiles':sorted(tiles)}
with gzip.open(out/'places-index.bin','wt',encoding='utf-8',compresslevel=9) as dst:
    json.dump(metadata,dst,ensure_ascii=False,separators=(',',':'))
for name,content in [('admin1.bin',admin1),('admin2.bin',admin2)]:
    with gzip.open(out/name,'wt',encoding='utf-8',compresslevel=9) as dst:
        json.dump(content,dst,ensure_ascii=False,separators=(',',':'))
print('Total compressed MB',round(sum(p.stat().st_size for p in out.rglob('*.bin'))/1048576,1),flush=True)
