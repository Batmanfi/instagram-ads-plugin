import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadRuntime,verifyAssets,fontIdentity,safeFile,sha256,stagePublic} from '../engine/scripts/lib/portable-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testRoot=path.join(root,'.local/tests');fs.mkdirSync(testRoot,{recursive:true});
function fixture() {
  const base=fs.mkdtempSync(path.join(testRoot,'runtime-'));for(const name of ['engine','assets','campaign'])fs.mkdirSync(path.join(base,name));
  const value={version:1,mode:'qa',assetRoot:path.join(base,'assets'),assetManifest:path.join(base,'assets.json'),campaignDir:path.join(base,'campaign'),workRoot:path.join(base,'work'),outputRoot:path.join(base,'outputs'),browserExecutable:process.execPath};
  const file=path.join(base,'runtime.json');fs.writeFileSync(file,JSON.stringify(value));return {base,file,value,engine:path.join(base,'engine')};
}
const write=(item,change)=>{fs.writeFileSync(item.file,JSON.stringify({...item.value,...change}));return ()=>loadRuntime(item.file,item.engine);};
test('explicit runtime separates immutable inputs, work and outputs without writing',()=>{
  const item=fixture(),before=fs.readdirSync(item.base);const runtime=loadRuntime(item.file,item.engine);
  assert.equal(runtime.workRoot,item.value.workRoot);assert.deepEqual(fs.readdirSync(item.base),before);assert.equal(fs.existsSync(runtime.workRoot),false);
  assert.throws(()=>loadRuntime(undefined,item.engine),/--runtime/);
});
test('runtime rejects every read/write overlap, scratch/output overlap and non-QA mode',()=>{
  for(const field of ['engine','assets','campaign']) {const item=fixture();assert.throws(write(item,{workRoot:path.join(item.base,field,'work')}),/overlap/);assert.throws(write(item,{outputRoot:item.base}),/overlap/);}
  const item=fixture();assert.throws(write(item,{outputRoot:path.join(item.value.workRoot,'outputs')}),/overlap/);
  assert.throws(write(item,{mode:'production'}),/mode must be qa or job/);assert.throws(write(item,{workRoot:'relative'}),/absolute/);
});
test('canonicalization catches input aliases and executable requirements',()=>{
  const item=fixture();fs.symlinkSync(item.engine,path.join(item.base,'alias'));assert.throws(write(item,{workRoot:path.join(item.base,'alias','work')}),/overlap/);
  assert.throws(write(item,{browserExecutable:path.join(item.base,'missing')}));
});
test('asset manifest enforces sizes, hashes, unique names and no symlink escape',()=>{
  const item=fixture();const file=path.join(item.value.assetRoot,'qa.txt');fs.writeFileSync(file,'fixture');const entries=[{path:'qa.txt',size:7,sha256:sha256(fs.readFileSync(file))}];
  fs.writeFileSync(item.value.assetManifest,JSON.stringify({version:1,id:'test-v1',files:entries}));const runtime=loadRuntime(item.file,item.engine);
  assert.equal(verifyAssets(runtime).files,1);fs.appendFileSync(file,'changed');assert.throws(()=>verifyAssets(runtime),/checksum/);
  fs.writeFileSync(item.value.assetManifest,JSON.stringify({version:1,id:'test-v1',files:[{...entries[0],path:'../runtime.json'}]}));assert.throws(()=>verifyAssets(runtime),/relative/);
  fs.symlinkSync(item.file,path.join(item.value.assetRoot,'link'));assert.throws(()=>safeFile(runtime.assetRoot,'link'),/symlinks/);
  fs.writeFileSync(file,'fixture');fs.writeFileSync(item.value.assetManifest,JSON.stringify({version:1,id:'test-v1',files:[...entries,...entries]}));assert.throws(()=>verifyAssets(runtime),/Duplicate/);
});
test('staging copies assets and fonts into scratch without changing source bytes',()=>{
  const item=fixture();for(const name of ['fonts','emoji']){fs.mkdirSync(path.join(item.engine,'public',name),{recursive:true});fs.writeFileSync(path.join(item.engine,'public',name,'qa.txt'),name);}
  const file=path.join(item.value.assetRoot,'qa.txt');fs.writeFileSync(file,'asset');const entries=[{path:'qa.txt',size:5,sha256:sha256(fs.readFileSync(file))}];
  fs.writeFileSync(item.value.assetManifest,JSON.stringify({version:1,id:'test-v1',files:entries}));const runtime=loadRuntime(item.file,item.engine),assets=verifyAssets(runtime);
  const staged=stagePublic(runtime,path.join(item.value.workRoot,'run'),assets,null);assert.equal(fs.readFileSync(path.join(staged,'qa.txt'),'utf8'),'asset');assert.equal(verifyAssets(runtime).files,1);
  assert.equal(fs.readFileSync(path.join(item.engine,'public/fonts/qa.txt'),'utf8'),'fonts');
});
test('font identity rejects substituted and malformed fonts rather than using fallback',()=>{
  assert.throws(()=>fontIdentity(path.join(root,'engine/public/fonts/Roboto-Regular.ttf')),/exact Times/);
  const item=fixture();fs.writeFileSync(path.join(item.base,'invalid.ttf'),'not a font');assert.throws(()=>fontIdentity(path.join(item.base,'invalid.ttf')),/Invalid TTF/);
});
test('real renderer rejects missing runtime, unknown options, pending setup and changed copy before writes',()=>{
  const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'engine/scripts/render.mjs'),...args],{cwd:root,encoding:'utf8'});
  assert.match(cli('--all').stderr,/--runtime/);assert.match(cli('--typo').stderr,/Unknown renderer option/);
  const item=fixture(),copy={version:1,ads:[{id:'qa-1',blocks:[{id:'hook',text:'QA only'}]}]};
  fs.writeFileSync(path.join(item.value.campaignDir,'copy.json'),JSON.stringify(copy));
  const manifest={version:1,qaOnly:true,setup:{status:'pending',requestId:'qa-request',copySha256:sha256(fs.readFileSync(path.join(item.value.campaignDir,'copy.json')))},ads:[]};
  const manifestFile=path.join(item.value.campaignDir,'manifest.json');fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  const pending=cli('--runtime',item.file,'--all','--qa-output');assert.equal(pending.status,1);assert.match(pending.stderr,/pending/);
  manifest.setup.status='ready';manifest.setup.copySha256='changed';fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  const changed=cli('--runtime',item.file,'--all','--qa-output');assert.equal(changed.status,1);assert.match(changed.stderr,/changed/);
  assert.equal(fs.existsSync(item.value.workRoot),false);assert.equal(fs.existsSync(item.value.outputRoot),false);
});
