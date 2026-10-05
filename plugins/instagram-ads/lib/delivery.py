"""Package an already technically verified and visually reviewed local job."""
from pathlib import Path
import sys,json,hashlib,zipfile,shutil,uuid,math
from PIL import Image,ImageDraw,ImageFont

directory=Path(sys.argv[1]).resolve()
load=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
spec=load(directory/'spec.json');progress=load(directory/'progress.json')
assert sha(directory/'spec.json')==load(directory/'job.json')['specSha256']
inputs=Path(spec['inputs']);copy=load(inputs/'copy.json');manifest=load(inputs/'manifest.json')
metadata=load(inputs/'source-metadata.json');titles={ad['id']:ad.get('title',ad['id']) for ad in metadata['ads']}
destination=Path(spec['deliveryRoot'])/(spec['campaign']+'-'+spec['jobId'][:8])
def verify_zip(file):
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None
        names=archive.namelist();assert len(names)==len(set(names))
        return len(names)
def verify_existing():
    record=load(destination/'delivery-manifest.json')
    assert record['jobId']==spec['jobId'] and record['specSha256']==sha(directory/'spec.json')
    for entry in record['files']:assert sha(destination/entry['path'])==entry['sha256']
    for name in ['Reusable-Source.zip','Complete-Delivery.zip']:verify_zip(destination/name)
    return record['result']
if destination.exists():
    print(json.dumps(verify_existing()));sys.exit()
stage=destination.parent/('.stage-'+str(uuid.uuid4()));stage.mkdir(parents=True)
def cp(source,target):
    assert source.is_file() and not source.is_symlink();target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target);assert sha(source)==sha(target)
def write(name,value):
    (stage/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
verified=[];failures=[]
for number,ad in enumerate(copy['ads'],1):
    entry=progress['ads'].get(ad['id'],{})
    if entry.get('status')!='rendered':failures.append({'id':ad['id'],'status':entry.get('status','missing'),'reason':entry.get('reason','No verified output')});continue
    assert ad['id'] in progress['reviews']
    output=Path(entry['output']);assert sha(output)==entry['sha256']
    label=''.join(c if c.isalnum() or c in '-_' else '-' for c in titles[ad['id']]).strip('-')[:80] or ad['id']
    name=f'{number:02d}-{ad["id"]}-{label}.mp4';cp(output,stage/name)
    for frame,file in zip([0,150,299],entry['stills']):cp(Path(file),stage/'QA'/f'{number:02d}-{ad["id"]}-{frame}.png')
    cp(Path(entry['resolvedFile']),stage/'QA'/f'{ad["id"]}-resolved.json')
    cp(Path(entry['reportFile']),stage/'Reports'/f'{ad["id"]}-{Path(entry["reportFile"]).parent.name}.json')
    verified.append({'id':ad['id'],'number':number,'title':titles[ad['id']],'deliveryFilename':name,'canonicalPath':entry['output'],'sha256':entry['sha256'],'technical':entry['metadata'],'music':entry.get('music',False),'fullMetadata':entry['fullMetadata'],'qa':progress['reviews'][ad['id']],'stills':entry['stills']})
for file in inputs.iterdir():cp(file,stage/'Campaign'/file.name)
cp(directory/'spec.json',stage/'Campaign/job-spec.json');cp(directory/'asset-manifest.json',stage/'Campaign/asset-manifest.json')
cp(Path(spec['workflowRoot'])/'distribution/instructions/AGENTS.md',stage/'Campaign/AGENTS.md')
font=ImageFont.load_default(size=18)
def sheet(name,ads,frames):
    cols=len(frames) if len(frames)>1 else min(4,len(ads));rows=math.ceil(len(ads)*len(frames)/cols)
    image=Image.new('RGB',(cols*270,rows*516),(245,245,245));draw=ImageDraw.Draw(image)
    for n,(ad,frame) in enumerate((a,f) for a in ads for f in frames):
        x=(n%cols)*270;y=(n//cols)*516
        with Image.open(ad['stills'][[0,150,299].index(frame)]) as source: image.paste(source.convert('RGB').resize((270,480)),(x,y+36))
        draw.text((x+5,y+5),f'{ad["number"]:02d}  {ad["id"]}  frame {frame}',font=font,fill='black')
    image.save(stage/name)
sheet('Contact-Sheet.png',verified,[150])
for index in range(0,len(verified),8):sheet(f'Inspection-Sheet-{index//8+1:02d}.png',verified[index:index+8],[0,150,299])
write('Verification.json',{'version':1,'jobId':spec['jobId'],'complete':not failures,'syntheticQa':spec['syntheticQa'],'sourceAudit':load(inputs/'source-audit.json'),'versions':{'workflowId':spec['workflowId'],'engineId':spec['engine']['engineId'],'engineVersion':spec['engine']['engineVersion'],'assetVersion':spec['engine']['assetVersion'],'assetManifestSha256':spec['engine']['assetManifestSha256']},'expectedCount':len(copy['ads']),'deliveredCount':len(verified),'ads':verified,'failures':failures})
(stage/'README.md').write_text(f'''# Instagram Ads campaign: {spec['campaign']}

Status: {'PARTIAL — see failures in Verification.json' if failures else 'Complete verified delivery'}. {'Synthetic development QA campaign.' if spec['syntheticQa'] else ''}
Delivered {len(verified)} of {len(copy['ads'])} supplied ads. Each MP4 is H.264/yuv420p, 1080×1920, 30 fps, 300 frames and 10 seconds; audio follows explicit per-ad choices. Full decoding and canonical/delivery checksums passed. Visual and motion QA records are in Verification.json.

Canonical output folder: {spec['outputRoot']}
Archived inputs: {spec['inputs']}
Job records: {directory}

Contact-Sheet.png covers every delivered ad. Inspection sheets label frames 0, 150 and 299. Campaign retains exact original source, optional complete Google Doc snapshot/URL, exact copy, layout, settings, audit and pinned versions. Reports retain representative and remaining ad renders; no overwritten latest-report is used as campaign evidence.

Reusable-Source.zip contains the pinned shared engine, compatible package lock, all four saved styles/design references, compact-spacing policy, local fonts/emoji and license records, verified scenery/music bundle, campaign inputs and plugin workflow. It excludes node_modules, scratch work and the installed Times New Roman system font. It is a local source package; media redistribution rights have not been established for publication. Install exact dependencies in its isolated engine, supply your own browser and installed Times New Roman, and configure the local paths on the destination Mac. Engine refresh does not migrate active jobs.

Use node <installed-plugin>/scripts/cli.mjs job-status --state-root <local-state> --campaign {spec['campaign']} --chat-id <trusted-chat> to inspect, or resume with the same association to finish missing work. Every attempt/runtime under the job directory records its exact single-ad render command inputs. Direct single rendering uses node <pinned-engine>/scripts/render.mjs --runtime <attempt/runtime.json> --campaign {spec['campaign']} --id <ad-id>; a batch uses --all, with --exclude <already-verified-ids>. The pinned job contract rejects global style/music overrides. Use the worker for reconciliation and delivery rather than creating duplicate canonical outputs manually.
''')
def add(archive,source,name):assert not source.is_symlink();archive.write(source,name)
with zipfile.ZipFile(stage/'Reusable-Source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    engine=Path(spec['engine']['root']);release=load(engine/'engine-release.json')
    for entry in release['files']:
        source=engine/entry['path'];assert sha(source)==entry['sha256'];add(archive,source,'engine/'+entry['path'])
    add(archive,engine/'engine-release.json','engine/engine-release.json')
    assets=load(Path(spec['engine']['assetManifest']))
    for entry in assets['files']:
        source=Path(spec['engine']['assetRoot'])/entry['path'];assert sha(source)==entry['sha256'];add(archive,source,'assets/'+entry['path'])
    add(archive,Path(spec['engine']['assetManifest']),'asset-manifest.json')
    workflow=Path(spec['workflowRoot']);release=load(workflow/'release.json')
    for entry in release['files']:
        source=workflow/entry['path'];assert sha(source)==entry['sha256'];add(archive,source,'plugin/resources/'+entry['path'])
        if entry['path'].startswith('distribution/'):add(archive,source,'plugin/'+entry['path'][len('distribution/'):])
    add(archive,workflow/'release.json','plugin/resources/release.json')
    for source in inputs.iterdir():add(archive,source,'campaign/'+source.name)
    add(archive,stage/'README.md','README.md')
    add(archive,Path(spec['workflowRoot'])/'distribution/instructions/AGENTS.md','AGENTS.md')
source_count=verify_zip(stage/'Reusable-Source.zip')
write('Checksums.json',[{'path':file.relative_to(stage).as_posix(),'sha256':sha(file)} for file in sorted(stage.rglob('*')) if file.is_file()])
with zipfile.ZipFile(stage/'Complete-Delivery.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(stage.rglob('*')):
        if file.is_file() and file.name!='Complete-Delivery.zip':add(archive,file,file.relative_to(stage).as_posix())
complete_count=verify_zip(stage/'Complete-Delivery.zip')
result={'directory':str(destination),'contactSheet':str(destination/'Contact-Sheet.png'),'completeZip':str(destination/'Complete-Delivery.zip'),'sourceZip':str(destination/'Reusable-Source.zip'),'deliveredCount':len(verified),'expectedCount':len(copy['ads']),'complete':not failures,'completeZipSha256':sha(stage/'Complete-Delivery.zip'),'sourceZipEntries':source_count,'completeZipEntries':complete_count}
write('delivery-manifest.json',{'version':1,'jobId':spec['jobId'],'specSha256':sha(directory/'spec.json'),'files':[{'path':file.relative_to(stage).as_posix(),'sha256':sha(file)} for file in sorted(stage.rglob('*')) if file.is_file()],'result':result})
stage.rename(destination)
print(json.dumps(result))
