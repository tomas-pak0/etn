from pathlib import Path
import hashlib,json,os,shutil,subprocess,time,urllib.request,zipfile
import bsdiff4

stage=Path(__file__).resolve().parent
manifest=json.loads((stage/'manifest.json').read_text())
repo='tomas-pak0/etn';version=manifest['version'];commit=manifest['sourceCommit'];run_id=manifest['buildRunId']
assert version=='0.7.2' and len(commit)==40
def sha(data):return hashlib.sha256(data).hexdigest()
def gh(*args):return subprocess.check_output(['gh',*args],text=True)
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
def download(url,path):
    with urllib.request.urlopen(url,timeout=90) as source,path.open('wb') as f:
        shutil.copyfileobj(source,f);f.flush();os.fsync(f.fileno())

# Release only the exact source revision that passed the Android job.
for attempt in range(60):
    run=json.loads(gh('api',f'repos/{repo}/actions/runs/{run_id}'))
    assert run['head_sha']==commit,'Verification belongs to another revision'
    if run['status']=='completed':
        assert run['conclusion']=='success','Android verification did not pass'
        break
    time.sleep(15)
else:raise RuntimeError('Android verification is still pending')

work=Path('release-work');work.mkdir(exist_ok=True)
out=Path('release-files');out.mkdir(exist_ok=True)
for item in manifest['payloads']:
    for part in item['parts']:assert sha((stage/part['path']).read_bytes())==part['sha256'],part['path']
    data=b''.join((stage/part['path']).read_bytes() for part in item['parts'])
    assert sha(data)==item['sha256'],item['name']
    write(work/item['name'],data)
with zipfile.ZipFile(work/'support.zip') as z:z.extractall(out)
for item in manifest['binaries']:
    baseline=work/item['baseline'];download(item['baselineUrl'],baseline)
    old=baseline.read_bytes();assert sha(old)==item['baselineSha256']
    patch=(work/item['patch']).read_bytes();assert sha(patch)==item['patchSha256']
    data=bsdiff4.patch(old,patch);assert len(data)==item['size'] and sha(data)==item['sha256']
    write(out/item['name'],data)

apk=out/f'ETN-{version}.apk';bundle=out/f'ETN-{version}-play.aab'
sdk=Path(os.environ.get('ANDROID_HOME','/usr/local/lib/android/sdk'))
signers=sorted(sdk.glob('build-tools/*/lib/apksigner.jar'))
assert signers,'Android APK verifier unavailable'
verified=subprocess.check_output(['java','-jar',str(signers[-1]),'verify','--verbose','--print-certs',str(apk)],text=True)
assert 'a68cd0b8f2b8cfbe1af4ae7f5aa4cd57055e31dd3d2220ad1aa4b0d6ef371a94' in verified
(out/'verification/published-apk-signature.txt').write_text(verified)
subprocess.run(['jarsigner','-verify',str(bundle)],check=True)
with zipfile.ZipFile(apk) as z:
    for p in Path('ETN').rglob('*'):
        if p.is_file():assert z.read('assets/'+p.relative_to('ETN').as_posix())==p.read_bytes(),str(p)
assert (out/'verification/android-source-commit.txt').read_text().strip()==commit
performance=json.loads((out/'verification/android-dense-history-performance.json').read_text())
assert performance['samples']==10000 and performance['frames']==180
assert performance['mainPixelReadbacks']==0 and performance['fogAfter']['paints']==performance['fogBefore']['paints']
notes=out/'ATNAUJINIMAS-LT.txt'
release_notes=f'''ETN {version} · Android versionCode 39

Pasaulio krypčių padalos eina per esamos vietos žymeklį, taip pat pastūmus ar pasukus žemėlapį. Pašalinta 50 % rūko atidengimo taisyklė. Optimizuoti rūko foniniai procesai Android WebView, žemėlapio judėjimas ir GPS žymeklio animacija.

APK pasirašytas tuo pačiu raktu kaip ankstesni naujiniai. AAB skirtas Google Play. ZIP yra AAB, šaltinio kodas ir patikrų rezultatai.

Android 15 emuliatoriaus patikros praėjo: {run['html_url']}
Šaltinio versija: {commit}
'''
(work/'release-notes.md').write_text(release_notes)
source=out/f'source/ETN-{version}-source.zip'
checksum=lambda p:sha(p.read_bytes())
archive=out/manifest['releaseArchive']['name']
with archive.open('wb') as f:
    with zipfile.ZipFile(f,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for row in manifest['releaseArchive']['entries']:
            info=zipfile.ZipInfo(row['filename'],tuple(row['date_time']))
            for key,value in row.items():
                if key not in ['filename','date_time']:setattr(info,key,bytes.fromhex(value) if key in ['comment','extra'] else value)
            z.writestr(info,(out/info.filename).read_bytes(),compresslevel=manifest['releaseArchive']['compressionLevel'])
    f.flush();os.fsync(f.fileno())
assert checksum(archive)==manifest['releaseArchive']['sha256'],'Release ZIP differs from the reviewed download'
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
(out/'SHA256SUMS.txt').write_text(''.join(checksum(p)+'  '+p.name+'\n' for p in [apk,bundle,archive,source]))
tag='v'+version
existing=subprocess.run(['gh','release','view',tag,'--repo',repo],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
assert existing.returncode!=0,'Release already exists; refusing to overwrite it'
assets=[apk,bundle,archive,out/'SHA256SUMS.txt']
subprocess.run(['gh','release','create',tag,'--repo',repo,'--target',commit,'--title','ETN '+version,'--draft','--notes-file',str(work/'release-notes.md'),*[str(p) for p in assets]],check=True)
draft=json.loads(gh('api',f'repos/{repo}/releases/tags/{tag}'))
assert draft['draft'] and draft['target_commitish']==commit
uploaded={item['name']:item['size'] for item in draft['assets']}
assert all(uploaded.get(p.name)==p.stat().st_size for p in assets),'Incomplete release uploads'
subprocess.run(['gh','release','edit',tag,'--repo',repo,'--draft=false','--latest'],check=True)
print('Published signed ETN release '+tag)
