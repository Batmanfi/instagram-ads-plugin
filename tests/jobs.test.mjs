import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {init,prepare,apply} from '../plugins/instagram-ads/lib/campaign-service.mjs';
import {start,jobStatus,resume,review,finalize} from '../plugins/instagram-ads/lib/job-service.mjs';
import {verifyEngine,alive} from '../plugins/instagram-ads/lib/job-runtime.mjs';
import {read,atomic,hash} from '../plugins/instagram-ads/lib/storage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'.local/tests'),{recursive:true});
async function fixture(configured=true) {
  const base=fs.mkdtempSync(path.join(root,'.local/tests/jobs-')),options={stateRoot:path.join(base,'state'),dataRoot:path.join(base,'data'),timezone:'UTC',chatId:'job-fixture'};init(options);
  const engine=path.join(base,'engine');fs.mkdirSync(path.join(engine,'scripts/lib'),{recursive:true});
  for(const name of ['package.json','package-lock.json','scripts/lib/portable-runtime.mjs'])fs.writeFileSync(path.join(engine,name),'{}');
  fs.writeFileSync(path.join(engine,'scripts/render.mjs'),"console.error('Injected test renderer failure: no media created');process.exitCode=1;");
  const files=['package.json','package-lock.json','scripts/lib/portable-runtime.mjs','scripts/render.mjs'].map(name=>({path:name,size:fs.statSync(path.join(engine,name)).size,sha256:hash(fs.readFileSync(path.join(engine,name)))}));
  atomic(path.join(engine,'engine-release.json'),{version:1,engineVersion:'test-only',engineId:hash(JSON.stringify(files)),capabilities:{productionJobs:true},files});
  const assetRoot=path.join(base,'assets');fs.mkdirSync(assetRoot);fs.writeFileSync(path.join(assetRoot,'license.txt'),'Test-only asset.');const assetManifest=path.join(base,'assets.json');atomic(assetManifest,{version:1,id:'test-only',files:[{path:'license.txt',size:16,sha256:hash(fs.readFileSync(path.join(assetRoot,'license.txt')))}]});
  if(configured)atomic(path.join(options.stateRoot,'engine-config.json'),{version:1,root:engine,engineVersion:'test-only',engineId:hash(JSON.stringify(files)),assetRoot,assetManifest,assetVersion:'test-only',assetManifestSha256:hash(fs.readFileSync(assetManifest)),browserExecutable:'/usr/bin/true',browserSha256:hash(fs.readFileSync('/usr/bin/true')),serifFontFile:null,concurrency:1});
  const source=path.join(base,'source.md'),copy=path.join(base,'copy.json'),audit=path.join(base,'audit.json');fs.writeFileSync(source,'QA only.');atomic(copy,{version:1,ads:[{id:'qa-1',title:'Synthetic failure fixture',blocks:[{id:'hook',text:'QA only.',role:'hook'}]}]});atomic(audit,{version:1,status:'passed',method:'independent-source-word-audit',sourceSha256:hash(fs.readFileSync(source)),parsedSha256:hash(fs.readFileSync(copy)),reviewedAdIds:['qa-1'],reviewedBlockIds:{'qa-1':['hook']},findings:[]});
  const prepared=await prepare({...options,source,copy,audit,brand:'Job fixture'}),lock=read(path.join(prepared.directory,'campaign-lock.json'));
  const choices=path.join(base,'choices.json');atomic(choices,{kind:'instagram-ad-campaign-setup',version:1,demo:false,action:'start-production',campaign:prepared.campaign,requestId:lock.requestId,copySha256:lock.copySha256,adCount:1,adIds:['qa-1'],style:'style-1',musicScope:'none',musicAdIds:[],trackSelection:'random-balanced',audio:{startTime:0,volume:.25,fadeInSeconds:8/30,fadeOutSeconds:.5},overrides:[]});
  return {base,engine,prepared,options:{...options,campaign:prepared.campaign,choices,syntheticQa:true}};
}
async function settled(item) {
  for(let n=0;n<200;n++){
    const current=jobStatus(item.options),active=read(path.join(current.directory,'active-process.json'));
    if(!alive(active.pid)&&!current.workerAlive&&!current.rendererAlive)return current;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw Error('Test worker did not exit');
}
test('settings-only, demo, stale and different-chat submissions cannot create jobs',async()=>{
  const unconfigured=await fixture(false);await assert.rejects(start(unconfigured.options),/settings-only/);assert.equal(fs.existsSync(path.join(unconfigured.options.stateRoot,'jobs')),false);
  const item=await fixture(),original=read(item.options.choices);
  for(const edits of [{action:'save-settings'},{demo:true},{requestId:'stale'},{kind:'instagram-ad-plugin-compatibility'}]){atomic(item.options.choices,{...original,...edits});await assert.rejects(start(item.options));}
  atomic(item.options.choices,original);await assert.rejects(start({...item.options,chatId:'other'}),/different chat/);
  assert.equal(fs.existsSync(path.join(item.prepared.directory,'production-job.json')),false);
});
test('duplicate and interrupted start preserve one immutable job; failure stays recoverable',async()=>{
  const item=await fixture(),first=await start(item.options),again=await start(item.options);assert.equal(again.jobId,first.jobId);assert.equal(again.alreadyStarted,true);
  let current=await settled(item);assert.equal(current.progress.phase,'needs-recovery');assert.equal(current.progress.ads['qa-1'].status,'failed');
  fs.unlinkSync(path.join(item.prepared.directory,'production-job.json'));assert.equal((await start(item.options)).jobId,first.jobId);
  const original=fs.readFileSync(path.join(first.directory,'inputs/copy.json'));await resume(item.options);current=await settled(item);assert.equal(current.progress.attempts.length,2);assert.deepEqual(fs.readFileSync(path.join(first.directory,'inputs/copy.json')),original);
  await assert.rejects(finalize(item.options),/missing\/failed/);await assert.rejects(finalize({...item.options,allowPartial:true}),/No verified/);
});
test('changed local defaults do not redirect an existing job; pinned input/code changes block access',async()=>{
  const item=await fixture(),first=await start(item.options);await settled(item);
  const config=read(path.join(item.options.stateRoot,'engine-config.json'));atomic(path.join(item.options.stateRoot,'engine-config.json'),{...config,root:'/no-new-engine-installed'});assert.equal(jobStatus(item.options).versions.engineId,config.engineId);
  const input=path.join(first.directory,'inputs/copy.json');fs.appendFileSync(input,' ');assert.throws(()=>jobStatus(item.options),/Job input changed/);
  fs.writeFileSync(input,fs.readFileSync(path.join(item.prepared.directory,'copy.json')));fs.appendFileSync(path.join(item.engine,'scripts/render.mjs'),'\n');assert.throws(()=>verifyEngine(item.engine),/integrity/);
});
test('modified per-ad controls and QA for missing outputs reject',async()=>{
  const item=await fixture();await apply(item.options);const file=path.join(item.prepared.directory,'manifest.json'),manifest=read(file);manifest.ads[0].music={track:'hush'};atomic(file,manifest);await assert.rejects(start(item.options),/controls/);
  manifest.ads[0].music=false;atomic(file,manifest);const first=await start(item.options);await settled(item);
  const record=path.join(item.base,'qa.json');atomic(record,{version:1,jobId:first.jobId,reviewer:'Test',ads:[{id:'qa-1'}]});await assert.rejects(review({...item.options,review:record}),/verified rendered/);
});
test('equivalent JSON key order and whitespace reuse a music-enabled submission',async()=>{
  const item=await fixture(),choices=read(item.options.choices);choices.musicScope='all';choices.musicAdIds=['qa-1'];atomic(item.options.choices,choices);
  const first=await start(item.options);await settled(item);
  choices.audio=Object.fromEntries(Object.entries(choices.audio).reverse());fs.writeFileSync(item.options.choices,JSON.stringify(Object.fromEntries(Object.entries(choices).reverse())));
  assert.equal((await start(item.options)).jobId,first.jobId);
});

test('a pending form retains its engine tuple when local defaults change before Start',async()=>{
  const item=await fixture(),original=read(path.join(item.options.stateRoot,'engine-config.json'));
  atomic(path.join(item.options.stateRoot,'engine-config.json'),{...original,root:'/not-the-prepared-engine'});
  const first=await start(item.options);await settled(item);
  assert.equal(read(path.join(first.directory,'spec.json')).engine.root,original.root);
  assert.equal(read(path.join(item.prepared.directory,'campaign-lock.json')).engineAtPreparation.engineId,original.engineId);
});

test('legacy pending forms without an engine pin cannot silently use a managed release',async()=>{
  const item=await fixture(),file=path.join(item.prepared.directory,'campaign-lock.json'),lock=read(file);delete lock.engineAtPreparation;atomic(file,lock);
  const engineFile=path.join(item.options.stateRoot,'engine-config.json'),engine=read(engineFile);atomic(engineFile,{...engine,distribution:{releaseId:'0'.repeat(64)}});
  await assert.rejects(start(item.options),/Legacy pending form has no engine pin/);assert.equal(fs.existsSync(path.join(item.prepared.directory,'production-job.json')),false);
});
