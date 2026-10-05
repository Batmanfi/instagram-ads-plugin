import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {init,prepare,form} from '../plugins/instagram-ads/lib/campaign-service.mjs';
import {releaseCheck,releaseStage,releaseActivate,releaseStatus,validateManifest,releaseInstallDependencies} from '../plugins/instagram-ads/lib/release-service.mjs';
import {atomic,hash,read} from '../plugins/instagram-ads/lib/storage.mjs';
import {run} from '../plugins/instagram-ads/lib/job-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),plugin=path.join(root,'plugins/instagram-ads');
fs.mkdirSync(path.join(root,'.local/tests'),{recursive:true});
function fixture(variant='normal') {
  const base=fs.mkdtempSync(path.join(root,'.local/tests/release-')),options={stateRoot:path.join(base,'state'),dataRoot:path.join(base,'data'),timezone:'UTC'};init(options);
  const library=path.join(base,'input-assets');fs.mkdirSync(library);const assetFiles=[];
  const names=[...read(path.join(plugin,'resources/data/backgrounds.json')).filter(b=>b.suitableFor10Seconds&&b.duration>=10).map(b=>'backgrounds/'+b.filename),...read(path.join(plugin,'resources/data/music.json')).tracks.map(t=>'music/'+t.filename)];
  for(const name of names){const file=path.join(library,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'Synthetic checksum fixture, not playable media.');assetFiles.push({path:name,size:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))});}
  atomic(path.join(base,'assets.json'),{version:1,id:'unit-assets',files:assetFiles,distributionStatus:'local-development-only'});
  const engine=path.join(base,'engine');fs.mkdirSync(path.join(engine,'scripts/lib'),{recursive:true});
  fs.writeFileSync(path.join(engine,'scripts/render.mjs'),'// Synthetic nonrendering fixture');
  fs.writeFileSync(path.join(engine,'scripts/lib/portable-runtime.mjs'),'export const verifyAssets=()=>({id:"unit-assets"});export const inventoryAssets=()=>({});export const verifyFonts=()=>({});');
  atomic(path.join(engine,'package.json'),{name:'synthetic',version:'1.0.0',dependencies:{'deliberately-missing-dependency':'1.0.0'}});atomic(path.join(engine,'package-lock.json'),{lockfileVersion:3});
  const files=['scripts/render.mjs','scripts/lib/portable-runtime.mjs','package.json','package-lock.json'].map(p=>({path:p,size:fs.statSync(path.join(engine,p)).size,sha256:hash(fs.readFileSync(path.join(engine,p)))}));
  const engineId=hash(JSON.stringify(files));atomic(path.join(engine,'engine-release.json'),{version:1,engineVersion:'unit-engine',engineId,capabilities:{productionJobs:true},files});
  run('python3',['-c',`import sys,zipfile,pathlib,stat\nbase=pathlib.Path(sys.argv[1]);plugin=pathlib.Path(sys.argv[2]);variant=sys.argv[3]\nfor name,source,top in [('plugin',plugin,'instagram-ads'),('engine',base/'engine','instagram-ads-engine')]:\n with zipfile.ZipFile(base/(name+'.zip'),'w') as z:\n  for p in sorted(source.rglob('*')):\n   if p.is_file():z.write(p,top+'/'+p.relative_to(source).as_posix())\n  if name=='plugin' and variant!='normal':\n   if variant=='symlink':\n    i=zipfile.ZipInfo(top+'/attack');i.create_system=3;i.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(i,'/tmp/target')\n   elif variant=='duplicate':z.writestr(top+'/plugin.json',(plugin/'plugin.json').read_bytes())\n   else:z.writestr(top+'/../escape','attack')`,base,plugin,variant]);
  function index(name,top){return JSON.parse(run('python3',['-c',"import json,sys,zipfile,hashlib;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([{'path':p.filename[len(sys.argv[2])+1:],'size':p.file_size,'sha256':hashlib.sha256(z.read(p)).hexdigest()} for p in z.infolist()]))",path.join(base,name+'.zip'),top]));}
  const body={version:1,product:'instagram-ads',notes:'Synthetic installer fixture',compatibility:{platform:'darwin',architectures:[process.arch],minNodeMajor:22,maxNodeMajor:26,workflowSchema:1,engineApi:1,jobSchema:1},plugin:{version:read(path.join(plugin,'plugin.json')).version,workflowId:read(path.join(plugin,'resources/release.json')).workflowId,archive:'plugin.zip',sha256:hash(fs.readFileSync(path.join(base,'plugin.zip'))),files:index('plugin','instagram-ads')},engine:{version:'unit-engine',engineId,archive:'engine.zip',sha256:hash(fs.readFileSync(path.join(base,'engine.zip'))),files:index('engine','instagram-ads-engine')},assets:{version:'unit-assets',manifest:'assets.json',sha256:hash(fs.readFileSync(path.join(base,'assets.json'))),distribution:'local-only'}};
  // An untrusted archive must still fail with a trusted descriptor declaring regular paths.
  if(variant!=='normal')body.plugin.files=body.plugin.files.filter(f=>!f.path.includes('..')&&f.path!=='attack');
  atomic(path.join(base,'release.json'),{...body,releaseId:hash(JSON.stringify(body))});
  return {base,options:{...options,manifest:path.join(base,'release.json'),manifestSha256:hash(fs.readFileSync(path.join(base,'release.json'))),assetRoot:library,localOnlyAssets:true}};
}
test('trusted manifest check is read-only; wrong digest and unsupported compatibility reject',()=>{
  const f=fixture(),before=fs.readdirSync(f.options.stateRoot);assert.equal(releaseCheck(f.options).writesPerformed,false);assert.deepEqual(fs.readdirSync(f.options.stateRoot),before);
  assert.throws(()=>releaseCheck({...f.options,manifestSha256:'0'.repeat(64)}),/checksum/);
  for(const changes of [{engineApi:2},{minNodeMajor:100,maxNodeMajor:101},{architectures:['unknown']}]){const v=read(f.options.manifest),{releaseId,...body}=v;body.compatibility={...body.compatibility,...changes};atomic(f.options.manifest,{...body,releaseId:hash(JSON.stringify(body))});assert.throws(()=>releaseCheck({...f.options,manifestSha256:hash(fs.readFileSync(f.options.manifest))}));}
});
test('staging is idempotent, deduplicates components and does not activate or register Codex',async()=>{
  const f=fixture();await assert.rejects(releaseStage({...f.options,localOnlyAssets:false}),/not cleared/);
  const staged=await releaseStage(f.options),again=await releaseStage({...f.options,assetRoot:undefined});assert.equal(staged.directory,again.directory);assert.equal(staged.engineRoot,again.engineRoot);assert.equal(releaseStatus(f.options).active,null);assert.equal(staged.pluginInstalled,false);
  assert.equal(read(path.join(staged.marketplaceRoot,'.agents/plugins/marketplace.json')).plugins[0].source.path,'./plugins/instagram-ads');
  fs.appendFileSync(path.join(staged.engineRoot,'scripts/render.mjs'),'changed');await assert.rejects(releaseStage(f.options),/changed/);
});
test('tampered archives/assets, traversal, symlinks and duplicate ZIP entries cannot activate',async()=>{
  const corrupt=fixture();fs.appendFileSync(path.join(corrupt.base,'plugin.zip'),'tamper');await assert.rejects(releaseStage(corrupt.options),/archive checksum/);
  const asset=fixture();fs.writeFileSync(path.join(asset.options.assetRoot,read(path.join(asset.base,'assets.json')).files[0].path),'changed');await assert.rejects(releaseStage(asset.options),/Asset checksum/);assert.equal(releaseStatus(asset.options).active,null);
  for(const variant of ['traversal','symlink','duplicate']){const f=fixture(variant);await assert.rejects(releaseStage(f.options));assert.equal(fs.existsSync(path.join(f.options.stateRoot,'engine-config.json')),false);assert.equal(fs.existsSync(path.join(f.options.stateRoot,'staging/escape')),false);}
});
test('failed runtime/dependency preflight preserves the previous atomic selector and user records',async()=>{
  const f=fixture(),staged=await releaseStage(f.options),selector=path.join(f.options.stateRoot,'engine-config.json');atomic(selector,{version:1,root:'/previous-engine',marker:'preserve'});const before=fs.readFileSync(selector);
  const record=path.join(f.options.dataRoot,'Deliveries','keep.txt');fs.writeFileSync(record,'Existing delivery.');const runtime=path.join(f.base,'runtime.json');atomic(runtime,{version:1,browserExecutable:'/usr/bin/true',concurrency:1});
  await assert.rejects(releaseActivate({...f.options,releaseId:staged.releaseId,runtime}),/ENOENT/);assert.deepEqual(fs.readFileSync(selector),before);assert.equal(fs.readFileSync(record,'utf8'),'Existing delivery.');
  const jobs=path.join(f.options.stateRoot,'jobs','old-job');fs.mkdirSync(jobs,{recursive:true});atomic(path.join(jobs,'spec.json'),{engine:{root:staged.engineRoot}});await assert.rejects(releaseInstallDependencies({...f.options,releaseId:staged.releaseId}),/existing job/);
});
test('new campaign preparation detects a required plugin refresh before archiving customer data',async()=>{
  const f=fixture();atomic(path.join(f.options.stateRoot,'engine-config.json'),{version:1,distribution:{workflowId:'0'.repeat(64)}});
  await assert.rejects(prepare({...f.options,source:path.join(f.base,'missing.md'),copy:path.join(f.base,'missing.json'),audit:path.join(f.base,'missing-audit.json'),brand:'Refresh QA',chatId:'qa'}),/Plugin refresh required/);
  assert.equal(releaseStatus(f.options).pluginRefreshRequired,true);assert.equal(fs.readdirSync(path.join(f.options.dataRoot,'Campaigns')).length,0);
});

test('interrupted release lock refuses live owners and can recover an exited owner without selecting incomplete stages',async()=>{
  const f=fixture(),file=path.join(f.options.stateRoot,'.release.lock');
  atomic(file,{pid:process.pid});await assert.rejects(releaseStage({...f.options,recoverLock:true}),/live process/);
  const scratch=path.join(f.options.stateRoot,'staging','abandoned');fs.mkdirSync(scratch,{recursive:true});fs.writeFileSync(path.join(scratch,'incomplete'),'Retain for inspection.');
  atomic(file,{pid:9999999});const stage=await releaseStage({...f.options,recoverLock:true});
  assert.equal(releaseStatus(f.options).active,null);assert.equal(fs.existsSync(file),false);assert.equal(fs.readFileSync(path.join(scratch,'incomplete'),'utf8'),'Retain for inspection.');assert.ok(stage.releaseId);
});
