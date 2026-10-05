"""Package the portable local-job engine without dependencies, media or system fonts."""
from pathlib import Path
import hashlib,json,zipfile,shutil
root=Path(__file__).resolve().parent.parent
source=root/'engine';dist=root/'.local/dist';dist.mkdir(exist_ok=True)
version='0.2.0-alpha.1';archive=dist/f'Instagram-Ads-Engine-{version}.zip'
stage=dist/'engine-staging'
if stage.exists():shutil.rmtree(stage)
stage.mkdir()
excluded={'node_modules','work','.remotion','.cache','out','__pycache__'}
legacy={'scripts/campaign-setup.mjs','scripts/smoke-checks.mjs','scripts/generate-instagram-highlights.mjs','README-BASELINE.md'}
for file in source.rglob('*'):
    rel=file.relative_to(source)
    if not file.is_file() or any(p in excluded for p in rel.parts) or rel.as_posix() in legacy or file.name.endswith('.test.mjs'):continue
    assert not file.is_symlink()
    target=stage/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
package=json.loads((stage/'package.json').read_text())
package['scripts']={'check':'tsc --noEmit','doctor':'node scripts/runtime-doctor.mjs','validate':'node scripts/render.mjs --validate','render:job':'node scripts/render.mjs','render:qa':'node scripts/render.mjs --qa-output','render:qa:all':'node scripts/render.mjs --qa-output --all'}
(stage/'package.json').write_text(json.dumps(package,indent=2)+'\n')
music=json.loads((stage/'data/music.json').read_text())
music['tracks']=[{k:v for k,v in track.items() if k!='originalPath'} for track in music['tracks']]
(stage/'data/music.json').write_text(json.dumps(music,indent=2)+'\n')
(stage/'README.md').write_text('''# Instagram Ads portable engine — local jobs

This is the existing shared Remotion engine, adapted to explicit local runtime paths. It permits standalone synthetic QA or production through a validated pinned job specification. The plugin worker owns recovery, QA and complete delivery.

Install pinned dependencies in this separate engine directory with npm ci. No dependencies, render browser, scenery/music library or system Times New Roman font are included. Supply an existing browser executable, a verified local asset bundle/manifest and an installed exact Times New Roman Regular TTF for Style 4. The local runtime JSON selects all writable directories outside this engine and its read-only inputs.

Run node scripts/runtime-doctor.mjs --runtime /absolute/runtime.json, then node scripts/render.mjs --runtime /absolute/runtime.json --all --qa-output --dry-run. Only after preflight, render synthetic fixtures with the same command without --dry-run. Render validation creates stills; dry-run is the no-write check. Output is written only to runtime.outputRoot. A missing runtime never falls back to a personal destination.

Standalone QA runtime JSON version 1 requires mode: qa, assetRoot, assetManifest, campaignDir, workRoot, outputRoot and browserExecutable; use absolute local paths. serifFontFile is required for Style 4. Optional concurrency is 1–16. Read-only roots and writable roots must not overlap; work/output roots must not overlap. The campaign manifest must have qaOnly: true and completed setup matching copy.json. Music remains explicitly selected by the campaign.

All four saved data/design styles, compact layout, local Roboto fonts with license records and existing emoji PNGs are included. Scenery/music licenses and rights are a separate asset-bundle concern. Installed Times New Roman is copied only into local scratch for browser rendering and is never included in this archive. Legacy utilities that write into code are omitted.
''')
sha=lambda file:hashlib.sha256(file.read_bytes()).hexdigest()
files=sorted(p for p in stage.rglob('*') if p.is_file())
entries=[{'path':p.relative_to(stage).as_posix(),'size':p.stat().st_size,'sha256':sha(p)} for p in files]
release={'version':1,'engineVersion':version,'engineId':hashlib.sha256(json.dumps(entries,separators=(',',':')).encode()).hexdigest(),'remotion':'4.0.506','capabilities':{'qaRender':True,'productionJobs':True,'completeDelivery':False},'files':entries,'assetBundleIncluded':False,'systemFontIncluded':False,'dependenciesIncluded':False}
(stage/'engine-release.json').write_text(json.dumps(release,indent=2)+'\n')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(stage.rglob('*')):
        if p.is_file():
            assert p.suffix not in {'.mp3','.mp4'}
            assert p.name!='TimesNewRoman-Installed.ttf'
            z.write(p,Path('instagram-ads-engine')/p.relative_to(stage))
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
record={'archive':str(archive),'sha256':sha(archive),'bytes':archive.stat().st_size,'files':len(entries)+1,'engineId':release['engineId'],'engineVersion':version,'integrity':'passed','mediaIncluded':False,'systemFontsIncluded':False,'pluginInstalled':False}
(dist/'engine-package-verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
