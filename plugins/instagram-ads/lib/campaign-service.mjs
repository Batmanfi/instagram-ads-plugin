import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {hash,read,assert,inside,canonical,owned,atomic,verifyRelease,locked} from './storage.mjs';

export const pluginRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suppliedResources=path.join(pluginRoot,'resources');
export const defaultState=()=>path.join(os.homedir(),'Library/Application Support/Instagram Ads');
function roots(options) {
  const state=canonical(options.stateRoot ?? defaultState());
  const data=canonical(options.dataRoot ?? path.join(os.homedir(),'Documents/Instagram Ads'));
  assert(!inside(state,data)&&!inside(data,state),'State/data roots must not overlap');
  const packagePath=canonical(pluginRoot);
  assert(!inside(packagePath,state)&&!inside(packagePath,data),'Writable roots must be outside the installed plugin');
  assert(state!==path.parse(state).root&&data!==path.parse(data).root,'Cannot own a filesystem root');
  return {stateRoot:state,dataRoot:data};
}
export function settings(options) {
  const stateRoot=canonical(options.stateRoot??defaultState());
  const config=read(path.join(stateRoot,'settings.json'));
  assert(config.version===1 && config.stateRoot===stateRoot,'Unsupported settings or state-root mismatch');
  const safe=roots(config);assert(safe.dataRoot===config.dataRoot,'Data-root identity changed');
  return config;
}
function pin(config) {
  const release=verifyRelease(suppliedResources);
  const destination=owned(config.stateRoot,'workflows',release.workflowId);
  if(fs.existsSync(destination)) {verifyRelease(destination);return release;}
  const stage=owned(config.stateRoot,'workflows',`.stage-${crypto.randomUUID()}`);
  fs.mkdirSync(stage,{recursive:true});
  try {
    for(const file of [...release.files.map(f=>f.path),'release.json']) {
      const target=owned(stage,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(owned(suppliedResources,file),target,fs.constants.COPYFILE_EXCL);
    }
    verifyRelease(stage);fs.renameSync(stage,destination);
  } finally {if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});}
  return release;
}
export function workflow(config,id) {
  assert(/^[a-f0-9]{64}$/.test(id),'Invalid pinned workflow');
  const directory=owned(config.stateRoot,'workflows',id);verifyRelease(directory);return directory;
}
async function resolver(directory) {return import(pathToFileURL(path.join(directory,'scripts/lib/campaign-setup.mjs')).href);}
export function campaignDirectory(config,id) {
  assert(typeof id==='string'&&/^[a-z0-9][a-z0-9_-]{0,100}$/i.test(id),'Invalid campaign slug');
  return owned(config.dataRoot,'Campaigns',id);
}
const context=id=>assert(typeof id==='string'&&id.trim()&&id.length<=250,'Trusted chat context ID is required');
function formOutput(options,config,destination,filename) {
  const output=options.output?path.resolve(options.output):owned(destination,filename);
  assert(path.extname(output)==='.html','Form output must have an .html extension');
  const resolved=canonical(output);
  assert(!inside(canonical(pluginRoot),resolved)&&!inside(canonical(path.join(config.stateRoot,'workflows')),resolved),'Form output cannot overwrite installed or pinned code');
  assert(resolved===output,'Form output cannot contain symlinks');
  if(options.output)assert(!fs.existsSync(output),'Explicit form output already exists; choose a new path');
  return output;
}
export function association(directory,chatId) {
  context(chatId);const lock=read(path.join(directory,'campaign-lock.json'));
  assert(lock.version===1&&lock.chatId===chatId,'Campaign belongs to a different chat context');return lock;
}
export function sourceIntegrity(directory,lock) {
  const metadata=read(path.join(directory,'source-metadata.json'));
  assert(path.basename(metadata.source.filename)===metadata.source.filename,'Invalid archived source filename');
  assert(hash(fs.readFileSync(path.join(directory,metadata.source.filename)))===lock.sourceSha256,'Archived source changed');
  assert(hash(fs.readFileSync(path.join(directory,'copy.json')))===lock.copySha256,'Campaign copy changed');
  assert(hash(fs.readFileSync(path.join(directory,'source-audit.json')))===lock.auditSha256,'Source audit changed');
  assert(hash(fs.readFileSync(path.join(directory,'source-metadata.json')))===lock.metadataSha256,'Source metadata changed');
  if(lock.snapshotSha256) assert(hash(fs.readFileSync(path.join(directory,'google-document-snapshot.json')))===lock.snapshotSha256,'Google Doc snapshot changed');
}
function auditSource(audit,parsed,sourceBytes,parsedBytes,isGoogle) {
  assert(audit?.version===1&&audit.status==='passed'&&audit.method==='independent-source-word-audit','A completed independent source audit is required');
  assert(audit.sourceSha256===hash(sourceBytes)&&audit.parsedSha256===hash(parsedBytes),'Source audit hashes do not match the current source/parsed JSON');
  assert(JSON.stringify(audit.reviewedAdIds)===JSON.stringify(parsed.ads.map(a=>a.id)),'Source audit must cover every ad in source order');
  for(const ad of parsed.ads) assert(JSON.stringify(audit.reviewedBlockIds?.[ad.id])===JSON.stringify(ad.blocks.map(b=>b.id)),'Source audit must cover ordered blocks');
  assert(Array.isArray(audit.findings)&&audit.findings.length===0,'Unresolved copy audit findings');
  if(isGoogle) assert(audit.sourceCompleteness?.status==='complete'&&Array.isArray(audit.sourceCompleteness.relevantTabIds)&&audit.sourceCompleteness.relevantTabIds.length>0,'Google Docs require complete relevant-tab audit records');
}
export function init(options) {
  const config={version:1,...roots(options),timezone:options.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone};
  new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone}).format(new Date());
  const file=path.join(config.stateRoot,'settings.json');
  if(fs.existsSync(file)) assert(JSON.stringify(read(file))===JSON.stringify(config),'Initialization cannot overwrite different settings');
  fs.mkdirSync(config.stateRoot,{recursive:true});fs.mkdirSync(config.dataRoot,{recursive:true});
  const release=pin(config);
  for(const name of ['Campaigns','Workspace','Compatibility','Renders/Ad-Campaigns','Deliveries','Index'])fs.mkdirSync(owned(config.dataRoot,name),{recursive:true});
  const stub=owned(config.dataRoot,'Workspace/AGENTS.md');
  if(!fs.existsSync(stub))fs.writeFileSync(stub,'# Instagram Ads development alpha\n\nUse the installed prepare-instagram-ads workflow for supplied ad Markdown or accessible Google Docs. This alpha archives source and displays the inline campaign setup form. Copy review requests remain reviews. Only a complete final submission permits applying choices. Configure the separate local engine/assets/dependencies before preparing a production-enabled form. Only its final Start production submission permits starting a pinned job. Continue representative QA, remaining renders and complete verified delivery through the installed workflow; settings-only and compatibility submissions never render. Keep all records under this local workspace configuration.\n',{flag:'wx'});
  if(!fs.existsSync(file))atomic(file,config);
  return {status:'initialized',...config,workflowId:release.workflowId,capabilities:release.capabilities,pluginInstalledByThisCommand:false};
}
export function doctor(options={}) {
  const inspect=(command,args)=>{const result=spawnSync(command,args,{encoding:'utf8',timeout:10000});return {available:!result.error&&result.status===0,version:(result.stdout||result.stderr||result.error?.message||'').trim().split('\n')[0]};};
  const current=verifyRelease(suppliedResources);
  const configFile=path.join(canonical(options.stateRoot??defaultState()),'settings.json');
  return {status:'diagnostic',platform:process.platform,architecture:process.arch,node:process.version,
    configured:fs.existsSync(configFile),...(fs.existsSync(configFile)?{settings:settings(options)}:{}),
    pluginVersion:current.pluginVersion,workflowId:current.workflowId,capabilities:current.capabilities,
    prerequisites:{npm:inspect('npm',['--version']),ffmpeg:inspect('ffmpeg',['-version']),ffprobe:inspect('ffprobe',['-version']),
      pillow:inspect('python3',['-c','import PIL; print(PIL.__version__)']),swift:inspect('xcrun',['--find','swift'])},
    unverified:['native visualization and final callback','Times New Roman in renderer browser','render browser/runtime installation','live Google Drive access','teammate installation and second Mac'],
    writesPerformed:false};
}
export async function prepare(options) {
  context(options.chatId);const config=settings(options),release=pin(config),directory=workflow(config,release.workflowId),api=await resolver(directory);
  const engineFile=owned(config.stateRoot,'engine-config.json');
  const engineAtPreparation=fs.existsSync(engineFile)?read(engineFile):null;
  assert(!engineAtPreparation?.distribution||engineAtPreparation.distribution.workflowId===release.workflowId,'Plugin refresh required: the running workflow does not match the active release. Refresh Codex and check release-status before preparing a new campaign.');
  const productionAvailable=release.capabilities.render===true&&!!engineAtPreparation;
  const sourceBytes=fs.readFileSync(options.source),parsedBytes=fs.readFileSync(options.copy),parsed=JSON.parse(parsedBytes),split=api.splitParsedCopy(parsed);
  const auditBytes=fs.readFileSync(options.audit),audit=JSON.parse(auditBytes);
  assert(!options.snapshot||options.sourceUrl,'Snapshot requires its supplied Google Doc URL');
  if(options.sourceUrl) assert(/^https:\/\/(docs\.google\.com|drive\.google\.com)\//.test(options.sourceUrl)&&options.snapshot,'Google Doc URL and complete snapshot required');
  const snapshotBytes=options.snapshot?fs.readFileSync(options.snapshot):null;if(snapshotBytes)JSON.parse(snapshotBytes);
  auditSource(audit,parsed,sourceBytes,parsedBytes,!!options.sourceUrl);
  const brand=String(options.brand??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);assert(brand,'Readable brand is required');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let campaign,destination;
  for(let n=1;;n++) {campaign=`${brand}-${date}-${String(n).padStart(2,'0')}`;destination=campaignDirectory(config,campaign);try{fs.mkdirSync(destination);}catch(error){if(error.code==='EEXIST')continue;throw error;}break;}
  try {
    const sourceName=`Original-Ad-Copy${path.extname(options.source)||'.txt'}`;
    fs.writeFileSync(path.join(destination,sourceName),sourceBytes,{flag:'wx'});
    fs.writeFileSync(path.join(destination,'parsed-input.json'),parsedBytes,{flag:'wx'});
    fs.writeFileSync(path.join(destination,'source-audit.json'),auditBytes,{flag:'wx'});
    if(snapshotBytes)fs.writeFileSync(path.join(destination,'google-document-snapshot.json'),snapshotBytes,{flag:'wx'});
    const copy={...split.copy,source:sourceName};atomic(path.join(destination,'copy.json'),copy);
    const copySha256=hash(fs.readFileSync(path.join(destination,'copy.json'))),requestId=crypto.randomUUID();
    const backgrounds=read(path.join(directory,'data/backgrounds.json')).filter(b=>b.suitableFor10Seconds===true&&b.duration>=10);assert(backgrounds.length,'No eligible scenery');
    const manifest={version:1,layoutMode:'compact',defaultContrast:.28,safeMargins:{top:150,side:90,bottom:280},music:false,
      setup:{version:1,status:'pending',requestId,copySha256},ads:split.layoutAds.map((ad,i)=>({...ad,outputName:`${campaign}-${ad.id}`,fontPreset:'condensed-regular',background:{filename:backgrounds[i%backgrounds.length].filename,startTime:0,cropPosition:[50,50]},music:false}))};
    atomic(path.join(destination,'manifest.json'),manifest);
    atomic(path.join(destination,'source-metadata.json'),{version:1,archivedAt:new Date().toISOString(),source:{filename:sourceName,sha256:hash(sourceBytes),kind:options.sourceUrl?'google-doc':'attachment',...(options.sourceUrl?{url:options.sourceUrl,snapshot:{filename:'google-document-snapshot.json',sha256:hash(snapshotBytes)}}:{})},ads:split.metadata});
    atomic(path.join(destination,'campaign-lock.json'),{version:1,campaign,requestId,chatId:options.chatId,timezone:config.timezone,pluginVersion:release.pluginVersion,workflowId:release.workflowId,productionEnabled:productionAvailable,...(productionAvailable?{engineAtPreparation}:{}),sourceSha256:hash(sourceBytes),copySha256,auditSha256:hash(auditBytes),metadataSha256:hash(fs.readFileSync(path.join(destination,'source-metadata.json'))),...(snapshotBytes?{snapshotSha256:hash(snapshotBytes)}:{}),createdAt:new Date().toISOString()});
    const output=formOutput(options,config,destination,'campaign-setup.html');
    const form=api.generateForm(directory,{kind:'instagram-ad-campaign-setup',version:1,demo:false,campaign,requestId,copySha256,adCount:copy.ads.length,productionAvailable,ads:split.metadata},output);
    return {campaign,directory:destination,adCount:copy.ads.length,status:'awaiting setup choices',workflowId:release.workflowId,form,contentReference:`visualize${JSON.stringify({path:form})}`,productionAvailable};
  } catch(error) {atomic(path.join(destination,'preparation-error.json'),{message:error.message,at:new Date().toISOString()});throw error;}
}
export async function form(options) {
  const config=settings(options),destination=campaignDirectory(config,options.campaign),lock=association(destination,options.chatId);sourceIntegrity(destination,lock);
  const directory=workflow(config,lock.workflowId),api=await resolver(directory),manifest=read(path.join(destination,'manifest.json')),copy=read(path.join(destination,'copy.json')),metadata=read(path.join(destination,'source-metadata.json'));
  assert(manifest.setup.status==='pending','Only pending campaigns can open a form');
  const output=formOutput(options,config,destination,'campaign-setup.html');
  const generated=api.generateForm(directory,{kind:'instagram-ad-campaign-setup',version:1,demo:false,campaign:options.campaign,requestId:lock.requestId,copySha256:lock.copySha256,adCount:copy.ads.length,productionAvailable:lock.productionEnabled===true,ads:metadata.ads},output);
  return {form:generated,contentReference:`visualize${JSON.stringify({path:generated})}`};
}
export async function apply(options) {
  const config=settings(options),destination=campaignDirectory(config,options.campaign),lock=association(destination,options.chatId);sourceIntegrity(destination,lock);
  const directory=workflow(config,lock.workflowId),api=await resolver(directory),choices=read(options.choices);
  return locked(path.join(destination,'.setup-apply.lock'),options.recoverLock,async()=>{
    const manifest=read(path.join(destination,'manifest.json')),copy=read(path.join(destination,'copy.json'));
    const result=api.resolveChoices({manifest,copy,copyHash:lock.copySha256,campaign:options.campaign,choices,musicTracks:read(path.join(directory,'data/music.json')).tracks});
    const choicesFile=path.join(destination,'setup-choices.json'),transaction=path.join(destination,'.setup-transaction.json');
    if(fs.existsSync(choicesFile))assert(api.choicesDigest(read(choicesFile))===api.choicesDigest(choices),'Conflicting saved choices');
    if(fs.existsSync(transaction))assert(read(transaction).choicesSha256===api.choicesDigest(choices),'Conflicting incomplete setup transaction');
    if(!result.alreadyApplied||fs.existsSync(transaction)) {
      atomic(transaction,{version:1,choicesSha256:api.choicesDigest(choices),choices,manifest:result.manifest});
      atomic(choicesFile,choices);atomic(path.join(destination,'manifest.json'),result.manifest);fs.unlinkSync(transaction);
    }
    return {campaign:options.campaign,status:'choices archived; Start production is a separate validated action',alreadyApplied:result.alreadyApplied,workflowId:lock.workflowId,selections:result.manifest.ads.map(ad=>({id:ad.id,style:ad.style,music:ad.music||false})),productionAvailable:false};
  });
}
export function status(options) {
  const config=settings(options),destination=campaignDirectory(config,options.campaign),lock=association(destination,options.chatId);sourceIntegrity(destination,lock);workflow(config,lock.workflowId);
  const manifest=read(path.join(destination,'manifest.json'));
  return {campaign:options.campaign,setup:manifest.setup,workflowId:lock.workflowId,adCount:manifest.ads.length,productionAvailable:false};
}
export async function compatibilityForm(options) {
  context(options.chatId);const config=settings(options),release=pin(config),directory=workflow(config,release.workflowId),api=await resolver(directory);
  const requestId=crypto.randomUUID(),campaign=`compatibility-${requestId}`,ads=Array.from({length:7},(_,i)=>({id:`qa-${String(i+1).padStart(2,'0')}`,number:i+1,title:`Synthetic form check ${i+1}`}));
  const configData={kind:'instagram-ad-plugin-compatibility',version:1,demo:true,campaign,requestId,copySha256:hash(JSON.stringify(ads)),adCount:ads.length,ads};
  const destination=owned(config.dataRoot,'Compatibility',requestId);fs.mkdirSync(destination);
  atomic(path.join(destination,'request.json'),{...configData,chatId:options.chatId,workflowId:release.workflowId});
  const output=formOutput(options,config,destination,'compatibility-form.html');
  const generated=api.generateForm(directory,configData,output);
  return {requestId,form:generated,contentReference:`visualize${JSON.stringify({path:generated})}`,testOnly:true};
}
export async function compatibilityAccept(options) {
  context(options.chatId);const config=settings(options),choices=read(options.choices);
  assert(choices.kind==='instagram-ad-plugin-compatibility'&&choices.version===1&&choices.demo===true,'Only a compatibility-test submission can use this command');
  assert(/^[a-f0-9-]{36}$/.test(choices.requestId),'Invalid compatibility request');
  const destination=owned(config.dataRoot,'Compatibility',choices.requestId),request=read(path.join(destination,'request.json'));
  assert(request.chatId===options.chatId,'Compatibility test belongs to a different chat');
  assert(choices.campaign===request.campaign&&choices.copySha256===request.copySha256&&choices.adCount===request.adCount&&JSON.stringify(choices.adIds)===JSON.stringify(request.ads.map(ad=>ad.id)),'Compatibility request/source mismatch');
  const directory=workflow(config,request.workflowId),api=await resolver(directory);
  const copy={version:1,ads:request.ads.map(ad=>({id:ad.id,blocks:[{id:'hook',text:'QA only'}]}))};
  const manifest={version:1,setup:{status:'pending',requestId:request.requestId,copySha256:request.copySha256},ads:copy.ads.map(ad=>({id:ad.id,blocks:[{id:'hook'}]}))};
  const result=api.resolveChoices({manifest,copy,copyHash:request.copySha256,campaign:request.campaign,choices:{...choices,kind:'instagram-ad-campaign-setup',demo:false},musicTracks:read(path.join(directory,'data/music.json')).tracks});
  const receiptFile=path.join(destination,'receipt.json');
  if(fs.existsSync(receiptFile))assert(read(receiptFile).choicesSha256===api.choicesDigest(choices),'Conflicting compatibility result');
  else atomic(receiptFile,{version:1,status:'payload validated',choicesSha256:api.choicesDigest(choices),receivedAt:new Date().toISOString(),chatId:options.chatId,renderStarted:false,selections:result.manifest.ads.map(ad=>({id:ad.id,style:ad.style,music:ad.music||false})),nativeBridgeAttestation:'Requires observed same-chat follow-up; CLI cannot attest UI origin'});
  atomic(path.join(destination,'submitted-choices.json'),choices);
  return read(receiptFile);
}
