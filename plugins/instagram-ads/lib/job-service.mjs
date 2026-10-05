import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {settings,campaignDirectory,association,sourceIntegrity,workflow,apply} from './campaign-service.mjs';
import {hash,read,assert,canonical,inside,owned,atomic,locked} from './storage.mjs';
import {verifyEngine,verifyJob,alive,run,reconcile,reviewBinding} from './job-runtime.mjs';

function context(options) {
  const config=settings(options),campaign=campaignDirectory(config,options.campaign),lock=association(campaign,options.chatId);
  sourceIntegrity(campaign,lock);const workflowRoot=workflow(config,lock.workflowId);
  return {config,campaign,lock,workflowRoot};
}
function jobContext(options) {
  const ctx=context(options),pointer=read(owned(ctx.campaign,'production-job.json'));
  assert(/^[a-f0-9]{32}$/.test(pointer.jobId),'Invalid job identity');const directory=owned(ctx.config.stateRoot,'jobs',pointer.jobId);
  const job=verifyJob(directory);assert(job.spec.campaign===options.campaign&&job.spec.chatId===options.chatId&&job.control.specSha256===pointer.specSha256,'Campaign/job association mismatch');
  return {...ctx,directory,...job};
}
export async function inspectEngine(options) {
  assert(path.isAbsolute(options.engineRoot),'Engine root must be absolute');
  const config=settings(options),root=canonical(options.engineRoot),release=verifyEngine(root);
  const runtime=read(options.runtime);assert(runtime.version===1,'Supply a version-1 engine runtime configuration');
  const engine={root,engineId:release.engineId,engineVersion:release.engineVersion,concurrency:runtime.concurrency??2};
  for(const key of ['assetRoot','assetManifest','browserExecutable']){assert(path.isAbsolute(runtime[key]),'Engine paths must be absolute');engine[key]=canonical(runtime[key]);}
  engine.serifFontFile=runtime.serifFontFile?canonical(runtime.serifFontFile):null;
  for(const input of [root,engine.assetRoot])for(const output of [owned(config.stateRoot,'jobs'),...['Campaigns','Renders','Deliveries','Index','Workspace'].map(name=>owned(config.dataRoot,name))])assert(!inside(input,output)&&!inside(output,input),'Engine/assets must be separated from writable campaign/job/output roots');
  const api=await import(pathToFileURL(owned(root,'scripts/lib/portable-runtime.mjs')).href);
  const assets=api.verifyAssets(engine);api.inventoryAssets(engine,assets);api.verifyFonts(root);
  engine.assetVersion=assets.id;engine.assetManifestSha256=hash(fs.readFileSync(engine.assetManifest));engine.browserSha256=hash(fs.readFileSync(engine.browserExecutable));
  fs.accessSync(engine.browserExecutable,fs.constants.X_OK);
  if(engine.serifFontFile)engine.serifFontSha256=api.fontIdentity(engine.serifFontFile).sha256;
  assert(Number.isInteger(engine.concurrency)&&engine.concurrency>=1&&engine.concurrency<=16,'Invalid concurrency');
  // Resolve the exact pinned packages; never install or substitute dependencies here.
  for(const [name,expected] of Object.entries(read(owned(root,'package.json')).dependencies))assert(read(owned(root,'node_modules',name,'package.json')).version===expected,`Pinned dependency mismatch: ${name}`);
  run(process.execPath,['--input-type=module','-e',"await import('@remotion/bundler'); await import('@remotion/renderer');"],{cwd:root});
  run('ffmpeg',['-version']);run('ffprobe',['-version']);run('python3',['-c','from PIL import Image,ImageDraw,ImageFont; print(ImageFont.load_default(size=18))']);run('xcrun',['--find','swift']);
  return engine;
}
export async function configureEngine(options) {
  const config=settings(options);
  return locked(owned(config.stateRoot,'.release.lock'),options.recoverLock,async()=>{
    const engine=await inspectEngine(options);
    atomic(owned(config.stateRoot,'engine-config.json'),{version:1,configuredAt:new Date().toISOString(),...engine});
    return {status:'engine configured for future campaigns',engine,dependenciesInstalled:false,activeJobsChanged:false};
  });
}
function idle(directory,progress) {
  assert(!alive(progress.workerPid)&&!alive(progress.renderPid),'A recorded worker or renderer is still alive; wait before recovery');
  if(fs.existsSync(owned(directory,'active-process.json')))assert(!alive(read(owned(directory,'active-process.json')).pid),'A launched worker is still alive');
  if(fs.existsSync(owned(directory,'.worker.lock')))assert(!alive(read(owned(directory,'.worker.lock')).pid),'Worker lock belongs to a live process');
}
function launch(directory,spec) {
  const progressFile=owned(directory,'progress.json'),progress=read(progressFile);
  idle(directory,progress);
  progress.phase='launching';atomic(progressFile,progress);
  const fd=fs.openSync(owned(directory,'worker.log'),'a',0o600);
  const child=spawn(process.execPath,[owned(spec.workflowRoot,'execution/job-worker.mjs'),directory],{cwd:directory,detached:true,stdio:['ignore',fd,fd]});
  fs.closeSync(fd);child.unref();atomic(owned(directory,'active-process.json'),{pid:child.pid,launchedAt:new Date().toISOString()});
  return child.pid;
}
export async function start(options) {
  const ctx=context(options),{config,campaign,lock,workflowRoot}=ctx,choices=read(options.choices);
  assert(choices.action==='start-production'&&choices.kind==='instagram-ad-campaign-setup'&&choices.demo===false,'Only an explicit final Start production submission starts a job');
  assert(lock.productionEnabled===true&&read(owned(workflowRoot,'release.json')).capabilities.render===true,'This campaign was prepared with a settings-only workflow; prepare a new campaign');
  return locked(owned(campaign,'.production-start.lock'),options.recoverLock,async()=>{
    await apply(options);
    const manifestNow=read(owned(campaign,'manifest.json')),copyNow=read(owned(campaign,'copy.json'));
    const api=await import(pathToFileURL(owned(workflowRoot,'scripts/lib/campaign-setup.mjs')).href);
    const expected=api.resolveChoices({manifest:{...manifestNow,setup:{...manifestNow.setup,status:'pending'}},copy:copyNow,copyHash:lock.copySha256,campaign:options.campaign,choices,musicTracks:read(owned(workflowRoot,'data/music.json')).tracks}).manifest;
    assert(manifestNow.layoutMode==='compact'&&manifestNow.music===false&&manifestNow.ads.every((ad,i)=>ad.style===expected.ads[i].style&&api.choicesDigest(ad.music)===api.choicesDigest(expected.ads[i].music)),'Saved controls no longer match submitted choices');
    const submissionSha256=hash(fs.readFileSync(options.choices)),pointerFile=owned(campaign,'production-job.json');
    if(fs.existsSync(pointerFile)) {
      const existing=jobContext(options);assert(existing.spec.choicesSha256===manifestNow.setup.choicesSha256,'Conflicting Start production submission');
      return {jobId:existing.spec.jobId,directory:existing.directory,alreadyStarted:true,progress:read(owned(existing.directory,'progress.json'))};
    }
    const currentEngine=lock.engineAtPreparation?null:read(owned(config.stateRoot,'engine-config.json'));
    assert(lock.engineAtPreparation||!currentEngine.distribution,'Legacy pending form has no engine pin: restore its original unmanaged engine configuration or prepare a new campaign. A managed update cannot silently choose its engine.');
    const engine=lock.engineAtPreparation??currentEngine;assert(verifyEngine(engine.root).engineId===engine.engineId,'Configured engine changed');
    const jobId=hash(`${options.campaign}:${lock.requestId}`).slice(0,32),directory=owned(config.stateRoot,'jobs',jobId),inputs=owned(directory,'inputs');
    // Recover a committed spec if the process exited before linking the campaign.
    if(fs.existsSync(owned(directory,'job.json'))) {
      const existing=verifyJob(directory);assert(existing.spec.choicesSha256===manifestNow.setup.choicesSha256,'Conflicting interrupted start');
      atomic(pointerFile,{version:1,jobId,specSha256:existing.control.specSha256});
      return {jobId,directory,alreadyStarted:true,progress:read(owned(directory,'progress.json')),recovery:'Use resume after confirming the process exited'};
    }
    const stage=owned(config.stateRoot,'jobs',`.stage-${crypto.randomUUID()}`);fs.mkdirSync(owned(stage,'inputs'),{recursive:true});
    const inputHashes={};
    fs.copyFileSync(options.choices,owned(stage,'inputs/start-submission.json'),fs.constants.COPYFILE_EXCL);inputHashes['start-submission.json']=submissionSha256;
    for(const entry of fs.readdirSync(campaign,{withFileTypes:true})) {
      if(!entry.isFile()||entry.name.startsWith('.')||entry.name.endsWith('.html')||entry.name==='production-job.json')continue;
      const target=owned(stage,'inputs',entry.name);fs.copyFileSync(owned(campaign,entry.name),target,fs.constants.COPYFILE_EXCL);inputHashes[entry.name]=hash(fs.readFileSync(target));
    }
    if(options.syntheticQa){const file=owned(stage,'inputs/manifest.json'),value=read(file);value.qaOnly=true;atomic(file,value);inputHashes['manifest.json']=hash(fs.readFileSync(file));}
    const copy=read(owned(stage,'inputs/copy.json')),manifest=read(owned(stage,'inputs/manifest.json'));
    const representativeId=[...copy.ads].sort((a,b)=>b.blocks.reduce((n,x)=>n+x.text.length,0)-a.blocks.reduce((n,x)=>n+x.text.length,0))[0].id;
    const assetManifest=owned(directory,'asset-manifest.json');atomic(owned(stage,'asset-manifest.json'),read(engine.assetManifest));
    const pinnedEngine={...engine,assetManifest,assetManifestSha256:hash(fs.readFileSync(owned(stage,'asset-manifest.json')))};
    const spec={version:1,action:'start-production',jobId,directory,inputs,campaign:options.campaign,chatId:options.chatId,requestId:lock.requestId,copySha256:lock.copySha256,choicesSha256:manifest.setup.choicesSha256,submissionSha256,workflowId:lock.workflowId,workflowRoot,engine:pinnedEngine,inputHashes,representativeId,outputRoot:owned(config.dataRoot,'Renders/Ad-Campaigns'),deliveryRoot:owned(config.dataRoot,'Deliveries'),indexRoot:owned(config.dataRoot,'Index'),syntheticQa:!!options.syntheticQa,createdAt:new Date().toISOString()};
    atomic(owned(stage,'spec.json'),spec);const specSha256=hash(fs.readFileSync(owned(stage,'spec.json')));
    atomic(owned(stage,'job.json'),{version:1,specSha256});atomic(owned(stage,'progress.json'),{version:1,phase:'ready',ads:{},reviews:{},attempts:[],workerPid:null,renderPid:null});
    fs.mkdirSync(path.dirname(directory),{recursive:true});assert(!fs.existsSync(directory),'Uncommitted job directory exists; preserve it for inspection');fs.renameSync(stage,directory);
    verifyJob(directory);atomic(pointerFile,{version:1,jobId,specSha256});
    const pid=launch(directory,spec);return {jobId,directory,pid,alreadyStarted:false,syntheticQa:spec.syntheticQa,status:'representative production started'};
  });
}
export function jobStatus(options) {
  const {directory,spec}=jobContext(options),progress=read(owned(directory,'progress.json'));
  return {jobId:spec.jobId,directory,progress,qaBindings:Object.fromEntries(Object.entries(progress.ads).filter(([,entry])=>entry.status==='rendered').map(([id,entry])=>[id,reviewBinding(entry)])),workerAlive:alive(progress.workerPid)||(fs.existsSync(owned(directory,'active-process.json'))&&alive(read(owned(directory,'active-process.json')).pid)),rendererAlive:alive(progress.renderPid),versions:{workflowId:spec.workflowId,engineVersion:spec.engine.engineVersion,engineId:spec.engine.engineId,assetVersion:spec.engine.assetVersion},syntheticQa:spec.syntheticQa};
}
export async function resume(options) {
  const {directory,spec}=jobContext(options);
  return locked(owned(directory,'.control.lock'),options.recoverLock,()=>{
    const file=owned(directory,'progress.json'),progress=read(file);assert(progress.phase!=='complete'&&progress.phase!=='partial-delivery','Finished job cannot be resumed');
    idle(directory,progress);
    atomic(file,reconcile(directory,spec,progress));return {jobId:spec.jobId,pid:launch(directory,spec),status:'resuming missing or invalid outputs'};
  });
}
export async function review(options) {
  const {directory,spec}=jobContext(options),record=read(options.review);
  return locked(owned(directory,'.control.lock'),options.recoverLock,()=>{
    const file=owned(directory,'progress.json'),progress=read(file);idle(directory,progress);
    reconcile(directory,spec,progress);
    assert(record.version===1&&record.jobId===spec.jobId&&typeof record.reviewer==='string'&&record.reviewer.trim()&&Array.isArray(record.ads)&&record.ads.length,'QA review must identify the job and actual reviewer');
    const keys=['exactCopy','wrapping','highlights','emoji','contrast','crop','safeMargins','compactSpacing','motion','audio'];const seen=new Set();
    for(const ad of record.ads){assert(!seen.has(ad.id),'Duplicate QA ad');seen.add(ad.id);const entry=progress.ads[ad.id];assert(entry?.status==='rendered','QA requires a verified rendered ad');assert(ad.binding===reviewBinding(entry),'QA review does not match current output/stills/props');assert(JSON.stringify(ad.frames)==='[0,150,299]'&&keys.every(key=>ad.checks?.[key]===true)&&ad.motionInspected===true&&typeof ad.notes==='string','QA must record all required actual inspections');progress.reviews[ad.id]={...ad,reviewer:record.reviewer,reviewedAt:new Date().toISOString()};}
    atomic(owned(directory,'qa-reviews',`${crypto.randomUUID()}.json`),record);atomic(file,progress);
    const remaining=read(owned(spec.inputs,'copy.json')).ads.some(ad=>progress.ads[ad.id]?.status!=='rendered');
    return {jobId:spec.jobId,status:'QA recorded',...(remaining&&progress.reviews[spec.representativeId]?{pid:launch(directory,spec)}:{})};
  });
}
export async function finalize(options) {
  const {directory,spec}=jobContext(options);
  return locked(owned(directory,'.control.lock'),options.recoverLock,()=>{
    const file=owned(directory,'progress.json'),progress=read(file);idle(directory,progress);
    reconcile(directory,spec,progress);const ids=read(owned(spec.inputs,'copy.json')).ads.map(a=>a.id);
    const failed=ids.filter(id=>progress.ads[id]?.status!=='rendered');assert(!failed.length||options.allowPartial,'Campaign has missing/failed ads; resume or explicitly package a partial delivery');
    assert(ids.some(id=>progress.ads[id]?.status==='rendered'),'No verified ads to deliver');
    for(const id of ids.filter(id=>progress.ads[id]?.status==='rendered'))assert(progress.reviews[id]?.binding===reviewBinding(progress.ads[id]),`Actual visual/motion QA required: ${id}`);
    atomic(file,progress);
    const result=JSON.parse(run('python3',[owned(spec.workflowRoot,'execution/delivery.py'),directory]));
    progress.phase=failed.length?'partial-delivery':'complete';progress.delivery=result;atomic(file,progress);
    atomic(owned(spec.indexRoot,`${spec.campaign}-${spec.jobId}.json`),{version:1,campaign:spec.campaign,jobId:spec.jobId,status:progress.phase,delivery:result,versions:{workflow:spec.workflowId,engine:spec.engine.engineVersion,assets:spec.engine.assetVersion}});
    return {jobId:spec.jobId,status:progress.phase,...result};
  });
}
