"""Verify the generated kit's extracted bootstrap CLI; no Codex installation."""
from pathlib import Path
import zipfile,json,hashlib,subprocess,shutil
root=Path(__file__).resolve().parent.parent;dist=root/'.local/dist';record=json.loads((dist/'release-kit-verification.json').read_text());archive=Path(record['archive'])
assert hashlib.sha256(archive.read_bytes()).hexdigest()==record['sha256']
base=dist/'kit-verification';base.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 unpack=base/'unpacked'
 if unpack.exists():shutil.rmtree(unpack)
 z.extractall(unpack)
kit=next(unpack.iterdir());cli=kit/'bootstrap/instagram-ads/scripts/cli.mjs';state=base/'state';data=base/'data'
def call(*args):
 result=subprocess.run(['node',str(cli),*map(str,args)],cwd=base,capture_output=True,text=True,check=True);return json.loads(result.stdout)
call('init','--state-root',state,'--data-root',data,'--timezone','UTC')
manifest=next(kit.glob('Instagram-Ads-Release-*.json'));checked=call('release-check','--state-root',state,'--manifest',manifest,'--manifest-sha256',record['manifestSha256'])
assert checked['releaseId']==record['releaseId'] and checked['writesPerformed'] is False
assert call('release-status','--state-root',state)['active'] is None
assert not list((data/'Renders/Ad-Campaigns').iterdir())
output={'status':'passed','kitSha256':record['sha256'],'releaseId':record['releaseId'],'extractedBootstrap':'init/release-check/release-status passed','pluginInstalled':False,'renderStarted':False,'teamAssetDistributionApproved':False}
(root/'.local/evidence/release-kit-smoke.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output,indent=2))
