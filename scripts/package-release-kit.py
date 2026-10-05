"""Produce a reviewable offline kit without media or Codex registration."""
from pathlib import Path
import json,zipfile,hashlib
root=Path(__file__).resolve().parent.parent;dist=root/'.local/dist';record=json.loads((dist/'release-package-verification.json').read_text());manifest=Path(record['manifest']);value=json.loads(manifest.read_text());version=record['pluginVersion'];archive=dist/f'Instagram-Ads-Private-Release-Kit-{version}.zip';top=f'Instagram-Ads-Private-Release-Kit-{version}'
readme=f'''# Instagram Ads private release kit {version}

Local installer/updater candidate. This kit has not been installed in Codex or tested on a second Mac. No scenery/music or system Times New Roman is included. Clear media rights and supply an approved asset library before teammate distribution.

Release manifest: {manifest.name}
Trusted manifest SHA-256 for this locally produced kit: {record['manifestSha256']}
Obtain this digest independently through your trusted private maintainer channel; a digest inside an untrusted download is not publisher authentication.

bootstrap/instagram-ads is a standalone source CLI and skill package, not an installed plugin. Read docs/TEAMMATE-QUICKSTART.md and docs/PRIVATE-RELEASES.md first. All commands use its scripts/cli.mjs and accept --state-root. Initialize folders/timezone, check and stage the absolute release manifest, explicitly install pinned engine dependencies, activate after dependency/font/browser/tool preflight, and install/refresh the plugin separately through the supported Codex marketplace flow when authorized. Use the returned marketplaceRoot. A matching source CLI does not prove Codex loaded the installed skill.

The current asset manifest is local-only, not cleared for redistribution. --local-only-assets is for isolated QA and is not authorization to share media. The full team pilot needs approved asset rights/private repository access and another Mac/account.

Installing a plugin does not automatically install the engine, Node packages, browser, FFmpeg/Pillow/Swift, Times New Roman, visualize or Google Drive. Campaigns, outputs and jobs stay outside this kit/versioned code. Updates/rollback retain all old components; old jobs/forms remain pinned. Only a final campaign Start production submission starts a render.
'''
files=[]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr(top+'/README.md',readme);files.append('README.md')
 for file in [manifest,dist/value['engine']['archive'],dist/value['plugin']['archive'],dist/value['assets']['manifest']]:z.write(file,top+'/'+file.name);files.append(file.name)
 for file in sorted((root/'plugins/instagram-ads').rglob('*')):
  if file.is_file():
   assert not file.is_symlink() and file.suffix not in ('.mp4','.mp3','.ttf')
   rel='bootstrap/instagram-ads/'+file.relative_to(root/'plugins/instagram-ads').as_posix();z.write(file,top+'/'+rel);files.append(rel)
 for name in ['PRIVATE-RELEASES.md','TEAMMATE-QUICKSTART.md','SECOND-MAC-ACCEPTANCE.md']:
  rel='docs/'+name;z.writestr(top+'/'+rel,(root/rel).read_text().replace('../plugins/instagram-ads/','../bootstrap/instagram-ads/'));files.append(rel)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None and len(z.namelist())==len(set(z.namelist()))==len(files)
output={'archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':archive.stat().st_size,'entries':len(files),'releaseId':value['releaseId'],'manifestSha256':record['manifestSha256'],'integrity':'passed','mediaIncluded':False,'systemFontIncluded':False,'pluginInstalled':False,'published':False,'teamReady':False}
(dist/'release-kit-verification.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output,indent=2))
