"""Create a portable, clearly synthetic installation kit; no remote publish."""
from pathlib import Path
import json,hashlib,zipfile,shutil,datetime
root=Path(__file__).resolve().parent.parent;dist=root/'.local/dist';version=json.loads((root/'plugins/instagram-ads/plugin.json').read_text())['version']
base=dist/('synthetic-pilot-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f'));assert not base.exists(),'Use a fresh unselected staging directory'
base.mkdir();baseline=json.loads(Path(json.loads((dist/'release-package-verification.json').read_text())['manifest']).read_text());body={k:v for k,v in baseline.items() if k!='releaseId'}
sha=lambda data:hashlib.sha256(data).hexdigest()
assets=root/'asset-manifests/synthetic-pilot-v1.json';av=json.loads(assets.read_text());shutil.copyfile(assets,base/assets.name)
body['label']=version+'-synthetic-pilot';body['notes']='Synthetic installation pilot: mathematical moving test patterns and sine-wave chords only. No supplied production scenery/music redistributed. Original filenames/track IDs are compatibility keys. Actual installed second-Mac/Drive/native callback and original production-media acceptance remain pending.'
body['assets']={'version':av['id'],'manifest':assets.name,'sha256':sha(assets.read_bytes()),'distribution':'approved-private-distribution'};body['releaseId']=sha(json.dumps(body,separators=(',',':'),ensure_ascii=False).encode())
manifest=base/f'Instagram-Ads-Synthetic-Pilot-{version}.json';manifest.write_text(json.dumps(body,indent=2,ensure_ascii=False)+'\n')
for kind in ['plugin','engine']:shutil.copyfile(dist/body[kind]['archive'],base/body[kind]['archive'])
shutil.copytree(root/'plugins/instagram-ads',base/'bootstrap/instagram-ads');shutil.copytree(root/'.local/pilot-assets/synthetic-pilot-v1',base/'synthetic-assets');shutil.copytree(root/'fixtures/pilot',base/'fixtures');shutil.copyfile(root/'scripts/pilot.mjs',base/'pilot.mjs')
index={'version':1,'synthetic':True,'manifest':manifest.name,'manifestSha256':sha(manifest.read_bytes()),'releaseId':body['releaseId'],'productionMediaIncluded':False,'codexInstallationPerformed':False,'secondMacVerified':False};(base/'pilot.json').write_text(json.dumps(index,indent=2)+'\n')
readme=f'''# Instagram Ads synthetic installation pilot

The engine/plugin is the retained {version} candidate. Background clips and music are generated test patterns/chords. Original inventory names and music IDs are compatibility keys, not the original recordings. Never use these fixtures for a real campaign or call them scenic footage/music quality acceptance.

Trusted release-manifest SHA-256: {index['manifestSha256']}
Obtain this digest through your trusted private maintainer/release channel. Its presence here alone does not authenticate a download.

Prerequisites: macOS arm64, Node 22–26 (local verification Node24), npm, FFmpeg/ffprobe, Python+Pillow, Swift command-line tools, existing render browser, and installed exact Times New Roman Regular. This kit contains local Roboto/emoji/license records but no system Times New Roman.

After extracting the ZIP, run from its root with your actual paths:

```sh
node pilot.mjs doctor --kit "$PWD" --manifest-sha256 {index['manifestSha256']}
node pilot.mjs setup --kit "$PWD" --manifest-sha256 {index['manifestSha256']} --browser "/absolute/path/to/browser" --serif-font "/absolute/path/to/Times New Roman.ttf"
```

Use --state-root/--data-root for separate pilot folders. setup creates local settings and imports verified synthetic assets, explicitly installs pinned engine packages, probes dependencies/fonts/media and atomically activates the release. It never installs/registers a Codex plugin, changes Codex settings, authenticates Drive, publishes or starts a render. Missing prerequisites fail visibly.

When authorized on the teammate Mac, add the returned marketplaceRoot with `codex plugin marketplace add /absolute/returned/marketplaceRoot`, install Instagram Ads through the supported client and follow its restart/refresh instructions. Then verify release-status through the actual installed setup-instagram-ads skill and run the harmless native compatibility form.

Submit fixtures/SYNTHETIC-COPY.md in the installed local Workspace. The agent must inspect every actual source paragraph before parsing/auditing and show the real inline form. Music starts off; intermediate controls must not render. For the full four-style/audio test, select Mix, set each ad's corresponding Style 1–4 override, music on for ads 2–4, silence for ad1, and the three concrete track IDs in order. These play generated chords in this kit. Only the final Start production starts the campaign. The agent completes actual representative/full QA and verified complete delivery.

After complete delivery, test interruption/restart, update/rollback/skipped version and preserved old jobs. Record the actual second Mac/account/native callback/Drive/full relevant tabs and maintainer-Mac-offline results in SECOND-MAC-ACCEPTANCE.md. A full original-media production test remains separate and requires cleared assets.

No teammate invitation or installed second-Mac verification has happened merely because this kit was created. Read the included RIGHTS-AND-SCOPE.md and acceptance guide.
'''
(base/'START-HERE.md').write_text(readme.replace('SECOND-MAC-ACCEPTANCE.md','docs/SECOND-MAC-ACCEPTANCE.md'));(base/'docs').mkdir()
for name in ['SECOND-MAC-ACCEPTANCE.md','TEAMMATE-QUICKSTART.md','PRIVATE-RELEASES.md','GITHUB-HANDOFF.md']:
 (base/'docs'/name).write_text((root/'docs'/name).read_text().replace('../plugins/instagram-ads/','../bootstrap/instagram-ads/'))
archive=dist/f'Instagram-Ads-Synthetic-Pilot-{version}.zip';top=archive.stem
files=sorted(p for p in base.rglob('*') if p.is_file())
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for file in files:
  assert not file.is_symlink();z.write(file,top+'/'+file.relative_to(base).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None and len(z.namelist())==len(set(z.namelist()))==len(files)
record={**index,'directory':str(base),'archive':str(archive),'sha256':sha(archive.read_bytes()),'bytes':archive.stat().st_size,'entries':len(files),'integrity':'passed','suppliedProductionMediaReadOrIncluded':False};(dist/'synthetic-pilot-verification.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
