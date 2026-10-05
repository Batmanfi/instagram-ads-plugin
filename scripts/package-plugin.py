"""Build/test a self-contained local alpha archive; no marketplace registration."""
from pathlib import Path
import hashlib,json,subprocess,zipfile,shutil,os
root=Path(__file__).resolve().parent.parent
plugin=root/'plugins/instagram-ads'
version=json.loads((plugin/'plugin.json').read_text())['version']
dist=root/'.local/dist';dist.mkdir(parents=True,exist_ok=True)
archive=dist/f'Instagram-Ads-Plugin-{version}.zip'
files=sorted(p for p in plugin.rglob('*') if p.is_file())
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:
        assert not p.is_symlink()
        z.write(p,Path('instagram-ads')/p.relative_to(plugin))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    extracted=dist/'verification-unpacked'
    if extracted.exists():shutil.rmtree(extracted)
    z.extractall(extracted)
cli=extracted/'instagram-ads/scripts/cli.mjs'
owned=dist/'verification-workspace';owned.mkdir(exist_ok=True)
state=owned/'state';data=owned/'data'
node=shutil.which('node');assert node
def call(*args):
    result=subprocess.run([node,str(cli),*map(str,args)],cwd=owned,capture_output=True,text=True,check=True)
    return json.loads(result.stdout)
initialized=call('init','--state-root',state,'--data-root',data,'--timezone','Asia/Kolkata')
source=owned/'synthetic.md';source.write_bytes(b'# Synthetic fixture\r\n\r\nQA only.\r\n')
parsed=owned/'parsed.json';parsed.write_text(json.dumps({'version':1,'ads':[{'id':'qa-1','title':'Synthetic fixture','blocks':[{'id':'hook','text':'QA only.','role':'hook'}]}]}))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
audit=owned/'audit.json';audit.write_text(json.dumps({'version':1,'status':'passed','method':'independent-source-word-audit','sourceSha256':sha(source),'parsedSha256':sha(parsed),'reviewedAdIds':['qa-1'],'reviewedBlockIds':{'qa-1':['hook']},'findings':[]}))
prepared=call('prepare','--state-root',state,'--source',source,'--copy',parsed,'--audit',audit,'--brand','Package QA','--chat-id','archive-fixture')
lock=json.loads((Path(prepared['directory'])/'campaign-lock.json').read_text())
choices=owned/'choices.json';choices.write_text(json.dumps({'kind':'instagram-ad-campaign-setup','version':1,'demo':False,'campaign':prepared['campaign'],'requestId':lock['requestId'],'copySha256':lock['copySha256'],'adCount':1,'adIds':['qa-1'],'style':'style-4','musicScope':'none','musicAdIds':[],'trackSelection':'random-balanced','audio':{'startTime':0,'volume':.25,'fadeInSeconds':8/30,'fadeOutSeconds':.5},'overrides':[]}))
applied=call('apply','--state-root',state,'--campaign',prepared['campaign'],'--choices',choices,'--chat-id','archive-fixture')
assert applied['selections'][0]['style']=='style-4'
assert applied['selections'][0]['music'] is False
assert applied['productionAvailable'] is False
assert (Path(prepared['directory'])/'Original-Ad-Copy.md').read_bytes()==source.read_bytes()
assert not any((data/'Renders/Ad-Campaigns').iterdir())
record={'version':1,'archive':str(archive),'sha256':sha(archive),'files':len(files),'bytes':archive.stat().st_size,'integrity':'passed','extractedCliWorkflow':'init/prepare/apply passed without engine repository or external Node modules','pluginInstalled':False,'renderStarted':False,'workflowId':initialized['workflowId']}
(dist/'package-verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
