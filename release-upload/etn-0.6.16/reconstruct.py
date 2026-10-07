from pathlib import Path
import base64,gzip,hashlib,json,struct,zipfile,zlib
here=Path(__file__).resolve().parent
patch=b''.join(path.read_bytes() for path in sorted(here.glob('etn-0.6.16.delta.part-*')))
recipe=json.loads(gzip.decompress(patch))
base=Path('release-base');output=Path('release');output.mkdir(exist_ok=True)
sources={key:base/value['name'] for key,value in recipe['sources'].items()}
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for data in iter(lambda:f.read(1024*1024),b''):h.update(data)
 return h.hexdigest()
for key,path in sources.items():assert sha(path)==recipe['sources'][key]['sha256'],'Base release SHA256 mismatch'
archives={key:zipfile.ZipFile(path) for key,path in sources.items()}
built={}
def compressed(content):
 compressor=zlib.compressobj(6,zlib.DEFLATED,-15)
 return compressor.compress(content)+compressor.flush()
for item in recipe['artifacts']:
 dest=output/item['name']
 with dest.open('wb') as target:
  for op in item['ops']:
   if 'literal' in op:target.write(base64.b64decode(op['literal'],validate=True))
   elif 'range' in op:
    with sources[op['range']].open('rb') as original:
     original.seek(op['offset']);target.write(original.read(op['length']))
   elif 'entry' in op:
    data=archives[op['entry']].read(op['name'])
    target.write(compressed(data) if op['deflate'] else data)
   elif 'artifact' in op:
    data=built[op['artifact']].read_bytes()
    target.write(compressed(data) if op['deflate'] else data)
   else:raise ValueError('Unsupported reconstruction operation')
 assert dest.stat().st_size==item['bytes'] and sha(dest)==item['sha256'],'Reconstructed release does not match the signed original'
 built[item['id']]=dest
 print(f"Restored exact original: {dest.name} {item['sha256']}",flush=True)
for archive in archives.values():archive.close()
with zipfile.ZipFile(built['apk']) as archive,built['apk'].open('rb') as raw:
 entry=archive.getinfo('resources.arsc');assert entry.compress_type==zipfile.ZIP_STORED
 raw.seek(entry.header_offset+26);name_len,extra_len=struct.unpack('<HH',raw.read(4))
 assert (entry.header_offset+30+name_len+extra_len)%4==0
with zipfile.ZipFile(built['play']) as package:
 assert not any('private-signing' in n or 'password' in n or n.endswith('.p12') for n in package.namelist())
(output/'SHA256SUMS.txt').write_text('\n'.join(item['sha256']+'  '+item['name'] for item in recipe['artifacts'])+'\n')
