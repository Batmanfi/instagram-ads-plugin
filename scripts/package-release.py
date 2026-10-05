"""Create an offline private-release descriptor; never register or publish it."""
from pathlib import Path
import json,hashlib,zipfile,shutil
root=Path(__file__).resolve().parent.parent;dist=root/'.local/dist'
plugin_record=json.loads((dist/'package-verification.json').read_text());engine_record=json.loads((dist/'engine-package-verification.json').read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
def component(record,top,key,version):
    archive=Path(record['archive']);assert sha(archive.read_bytes())==record['sha256']
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        files=[{'path':p.filename[len(top)+1:],'size':p.file_size,'sha256':sha(z.read(p))} for p in z.infolist()]
        assert all(p.filename.startswith(top+'/') for p in z.infolist())
    return {'version':version,'archive':archive.name,'sha256':record['sha256'],key:record[key],'files':files}
version=json.loads((root/'plugins/instagram-ads/plugin.json').read_text())['version']
assets=root/'asset-manifests/source-v1.json';shutil.copyfile(assets,dist/assets.name)
body={'version':1,'product':'instagram-ads','label':version,'notes':'Private local release manager: verified staging, explicit dependency setup, atomic activation, rollback, retained jobs and pending forms. Local-only asset import; no approved team media distribution or installed second-Mac pilot yet.',
      'compatibility':{'platform':'darwin','architectures':['arm64'],'minNodeMajor':22,'maxNodeMajor':26,'workflowSchema':1,'engineApi':1,'jobSchema':1},
      'plugin':component(plugin_record,'instagram-ads','workflowId',version),
      'engine':component(engine_record,'instagram-ads-engine','engineId',engine_record['engineVersion']),
      'assets':{'version':json.loads(assets.read_text())['id'],'manifest':assets.name,'sha256':sha(assets.read_bytes()),'distribution':'local-only'}}
body['releaseId']=sha(json.dumps(body,separators=(',',':'),ensure_ascii=False).encode())
file=dist/f'Instagram-Ads-Release-{version}.json';file.write_text(json.dumps(body,indent=2,ensure_ascii=False)+'\n')
record={'manifest':str(file),'manifestSha256':sha(file.read_bytes()),'releaseId':body['releaseId'],'pluginVersion':version,'engineVersion':body['engine']['version'],'assetVersion':body['assets']['version'],'teamAssetDistributionApproved':False,'pluginInstalled':False,'published':False}
(dist/'release-package-verification.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
