import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {settings,pluginRoot} from './campaign-service.mjs';
import {hash,read,assert,owned,canonical,inside,atomic,locked,verifyRelease} from './storage.mjs';
import {verifyEngine,run} from './job-runtime.mjs';
import {inspectEngine} from './job-service.mjs';
const sha=value=>assert(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'Expected SHA-256 digest');
const id=value=>assert(typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,90}$/i.test(value),'Invalid component version');
function entries(files) {
  assert(Array.isArray(files)&&files.length>0&&files.length<=20000,'Invalid release file index');let total=0;const seen=new Set();
  for(const item of files){assert(typeof item.path==='string'&&item.path.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!item.path.includes('\\')&&!path.isAbsolute(item.path)&&!seen.has(item.path),'Unsafe/duplicate release file path');seen.add(item.path);sha(item.sha256);assert(Number.isSafeInteger(item.size)&&item.size>=0,'Invalid release file size');total+=item.size;}
  assert(total<=2*1024**3,'Release exceeds extraction limit');
}
export function validateManifest(value) {
  assert(value.version===1&&value.product==='instagram-ads'&&typeof value.notes==='string'&&value.notes.trim(),'Invalid release manifest');sha(value.releaseId);
  const {releaseId,...body}=value;assert(hash(JSON.stringify(body))===releaseId,'Release identity mismatch');
  const compatibility=value.compatibility;
  assert(compatibility?.platform==='darwin'&&Array.isArray(compatibility.architectures)&&compatibility.architectures.length&&compatibility.architectures.every(a=>['arm64','x64'].includes(a)),'Unsupported release platform');
  assert(Number.isInteger(compatibility.minNodeMajor)&&compatibility.minNodeMajor>=22&&Number.isInteger(compatibility.maxNodeMajor)&&compatibility.maxNodeMajor>=compatibility.minNodeMajor,'Invalid Node compatibility range');
  assert(compatibility.workflowSchema===1&&compatibility.engineApi===1&&compatibility.jobSchema===1,'Unsupported release API/schema; explicit migration is required');
  for(const kind of ['plugin','engine']){const part=value[kind];id(part.version);sha(part.sha256);entries(part.files);assert(!part.files.some(f=>f.path.split('/').includes('node_modules')),'Release archives cannot ship installed dependencies');assert(typeof part.archive==='string'&&path.basename(part.archive)===part.archive&&part.archive.endsWith('.zip'),'Archives must be relative sibling ZIP files');}
  sha(value.plugin.workflowId);sha(value.engine.engineId);id(value.assets.version);sha(value.assets.sha256);
  assert(typeof value.assets.manifest==='string'&&path.basename(value.assets.manifest)===value.assets.manifest,'Asset manifest must be a relative sibling file');
  assert(['local-only','approved-private-distribution'].includes(value.assets.distribution),'Invalid asset distribution status');return value;
}
function compatible(value) {
  const c=value.compatibility,n=Number(process.versions.node.split('.')[0]);
  assert(process.platform===c.platform&&c.architectures.includes(process.arch),'Release is not compatible with this Mac architecture');
  assert(n>=c.minNodeMajor&&n<=c.maxNodeMajor,'Release is not compatible with this Node major');
}
function load(options) {
  sha(options.manifestSha256);const file=canonical(options.manifest),bytes=fs.readFileSync(file);
  assert(hash(bytes)===options.manifestSha256,'Release manifest checksum mismatch; obtain the digest from a trusted private release channel');
  const manifest=validateManifest(JSON.parse(bytes));compatible(manifest);return {file,bytes,manifest};
}
function active(config) {const file=owned(config.stateRoot,'engine-config.json');return fs.existsSync(file)?read(file):null;}
function runningWorkflow() {return verifyRelease(owned(pluginRoot,'resources')).workflowId;}
function summary(manifest,current) {return {releaseId:manifest.releaseId,versions:{plugin:manifest.plugin.version,engine:manifest.engine.version,assets:manifest.assets.version},notes:manifest.notes,changes:{plugin:current?.distribution?.workflowId!==manifest.plugin.workflowId,engine:current?.engineId!==manifest.engine.engineId,assets:current?.assetManifestSha256!==manifest.assets.sha256},pluginRefreshRequired:runningWorkflow()!==manifest.plugin.workflowId,teamAssetDistributionApproved:manifest.assets.distribution==='approved-private-distribution'};}
export function releaseCheck(options) {
  const {manifest}=load(options),config=settings(options);
  return {status:'release checked; nothing changed',...summary(manifest,active(config)),writesPerformed:false,automaticUpdate:false};
}
function verifyFiles(root,files,exact=false) {
  entries(files);const expected=new Set(files.map(e=>e.path));
  for(const entry of files){const file=owned(root,entry.path);assert(fs.statSync(file).isFile()&&fs.statSync(file).size===entry.size&&hash(fs.readFileSync(file))===entry.sha256,`Release file changed: ${entry.path}`);}
  if(exact){function walk(dir,prefix=''){for(const item of fs.readdirSync(dir,{withFileTypes:true})){assert(!item.isSymbolicLink(),'Release files cannot contain symlinks');const rel=prefix+item.name;if(item.isDirectory())walk(owned(dir,item.name),rel+'/');else assert(expected.has(rel),`Unexpected plugin file: ${rel}`);}}walk(root);}
}
function extract(config,manifest,kind,source,stage) {
  const part=manifest[kind],directory=owned(config.stateRoot,'components',kind,kind==='plugin'?part.workflowId:part.engineId);
  if(!fs.existsSync(directory)) {
    const zip=owned(path.dirname(source),part.archive);assert(hash(fs.readFileSync(zip))===part.sha256,`${kind} archive checksum mismatch`);
    const temporary=owned(stage,kind),index=owned(stage,`${kind}-files.json`);atomic(index,part.files);
    run('python3',[path.join(path.dirname(fileURLToPath(import.meta.url)),'release-extract.py'),zip,temporary,kind==='plugin'?'instagram-ads':'instagram-ads-engine',index]);
    verifyFiles(temporary,part.files,true);fs.mkdirSync(path.dirname(directory),{recursive:true});fs.renameSync(temporary,directory);
  }
  verifyFiles(directory,part.files,kind==='plugin');
  if(kind==='plugin'){const plugin=read(owned(directory,'plugin.json')),release=verifyRelease(owned(directory,'resources'));assert(plugin.name==='instagram-ads'&&plugin.version===part.version&&release.pluginVersion===part.version&&release.workflowId===part.workflowId,'Plugin identity mismatch');}
  else {const release=verifyEngine(directory);assert(release.engineId===part.engineId&&release.engineVersion===part.version,'Engine identity mismatch');}
  return directory;
}
function assets(config,manifest,source,assetRoot,stage) {
  const manifestFile=owned(path.dirname(source),manifest.assets.manifest),bytes=fs.readFileSync(manifestFile);assert(hash(bytes)===manifest.assets.sha256,'Asset manifest checksum mismatch');
  const value=JSON.parse(bytes);assert(value.version===1&&value.id===manifest.assets.version,'Asset identity mismatch');entries(value.files);
  if(manifest.assets.distribution==='approved-private-distribution')assert(value.distributionStatus==='approved-private-distribution'&&typeof value.rightsRecord==='string'&&value.files.some(f=>f.path===value.rightsRecord),'Approved assets require an included rights record');
  const directory=owned(config.stateRoot,'components','assets',manifest.assets.sha256),root=owned(directory,'files');
  if(!fs.existsSync(directory)) {
    assert(assetRoot&&path.isAbsolute(assetRoot),'Supply --asset-root with the verified local asset library');const input=canonical(assetRoot);
    assert(!inside(config.stateRoot,input)&&!inside(input,config.stateRoot)&&!inside(config.dataRoot,input)&&!inside(input,config.dataRoot),'Asset import must be separate from writable state/data roots');
    const temporary=owned(stage,'assets');fs.mkdirSync(owned(temporary,'files'),{recursive:true});
    for(const entry of value.files){const origin=owned(input,entry.path);assert(fs.statSync(origin).size===entry.size&&hash(fs.readFileSync(origin))===entry.sha256,`Asset checksum mismatch: ${entry.path}`);const target=owned(temporary,'files',entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(origin,target,fs.constants.COPYFILE_EXCL);}
    fs.writeFileSync(owned(temporary,'manifest.json'),bytes,{flag:'wx'});verifyFiles(owned(temporary,'files'),value.files,true);fs.mkdirSync(path.dirname(directory),{recursive:true});fs.renameSync(temporary,directory);
  }
  assert(hash(fs.readFileSync(owned(directory,'manifest.json')))===manifest.assets.sha256,'Staged asset manifest changed');verifyFiles(root,value.files,true);return {root,manifest:owned(directory,'manifest.json'),files:value.files};
}
function staged(config,releaseId) {
  sha(releaseId);const directory=owned(config.stateRoot,'releases',releaseId),receipt=read(owned(directory,'stage.json')),file=owned(directory,'release.json');
  assert(hash(fs.readFileSync(file))===receipt.manifestSha256,'Staged release manifest changed');const manifest=validateManifest(read(file));compatible(manifest);assert(manifest.releaseId===releaseId,'Staged release identity mismatch');
  const plugin=owned(config.stateRoot,'components','plugin',manifest.plugin.workflowId),engine=owned(config.stateRoot,'components','engine',manifest.engine.engineId),asset=owned(config.stateRoot,'components','assets',manifest.assets.sha256);
  verifyFiles(plugin,manifest.plugin.files,true);verifyFiles(engine,manifest.engine.files);
  const release=verifyRelease(owned(plugin,'resources'));assert(release.workflowId===manifest.plugin.workflowId&&release.pluginVersion===manifest.plugin.version&&read(owned(plugin,'plugin.json')).version===manifest.plugin.version,'Staged plugin identity mismatch');
  const er=verifyEngine(engine);assert(er.engineId===manifest.engine.engineId&&er.engineVersion===manifest.engine.version,'Staged engine identity mismatch');
  const assetFile=owned(asset,'manifest.json');assert(hash(fs.readFileSync(assetFile))===manifest.assets.sha256,'Staged asset manifest changed');const av=read(assetFile);assert(av.id===manifest.assets.version,'Staged asset identity mismatch');verifyFiles(owned(asset,'files'),av.files,true);
  return {directory,manifest,receipt,plugin,engine,assetRoot:owned(asset,'files'),assetManifest:assetFile};
}
export async function releaseStage(options) {
  const input=load(options),config=settings(options),manifest=input.manifest;
  assert(manifest.assets.distribution!=='local-only'||options.localOnlyAssets,'Local-only assets are not cleared for teammates. Use --local-only-assets only for isolated local development.');
  return locked(owned(config.stateRoot,'.release.lock'),options.recoverLock,async()=>{
    const stage=owned(config.stateRoot,'staging',crypto.randomUUID());fs.mkdirSync(stage,{recursive:true});
    try {
      const plugin=extract(config,manifest,'plugin',input.file,stage),engine=extract(config,manifest,'engine',input.file,stage),library=assets(config,manifest,input.file,options.assetRoot,stage);
      const names=new Set(library.files.map(f=>f.path));
      for(const b of read(owned(plugin,'resources/data/backgrounds.json')).filter(b=>b.suitableFor10Seconds&&b.duration>=10))assert(names.has(`backgrounds/${b.filename}`),'Asset bundle lacks eligible scenery required by the form');
      for(const t of read(owned(plugin,'resources/data/music.json')).tracks)assert(names.has(`music/${t.filename}`),'Asset bundle lacks a supplied music track');
      const directory=owned(config.stateRoot,'releases',manifest.releaseId);fs.mkdirSync(directory,{recursive:true});
      if(fs.existsSync(owned(directory,'release.json')))assert(hash(fs.readFileSync(owned(directory,'release.json')))===options.manifestSha256,'Conflicting staged release');
      else fs.writeFileSync(owned(directory,'release.json'),input.bytes,{flag:'wx'});
      atomic(owned(directory,'stage.json'),{version:1,manifestSha256:options.manifestSha256,stagedAt:new Date().toISOString(),localOnly:manifest.assets.distribution==='local-only'});
      const catalog=owned(directory,'marketplace');fs.mkdirSync(owned(catalog,'.agents/plugins'),{recursive:true});
      // A real portable catalog copy, never a symlink into mutable installed plugin code.
      const catalogPlugin=owned(catalog,'plugins/instagram-ads');if(!fs.existsSync(catalogPlugin))fs.cpSync(plugin,catalogPlugin,{recursive:true,errorOnExist:true,force:false});verifyFiles(catalogPlugin,manifest.plugin.files,true);
      atomic(owned(catalog,'.agents/plugins/marketplace.json'),{name:'instagram-ads-private',interface:{displayName:'Instagram Ads — Private'},plugins:[{name:'instagram-ads',source:{source:'local',path:'./plugins/instagram-ads'},policy:{installation:'AVAILABLE',authentication:'ON_USE'},category:'Productivity'}]});
      return {status:'release staged; activation and plugin installation are separate',...summary(manifest,active(config)),directory,engineRoot:engine,assetRoot:library.root,assetManifest:library.manifest,marketplaceRoot:catalog,pluginInstalled:false,dependenciesInstalled:false,activeJobsChanged:false};
    } finally {fs.rmSync(stage,{recursive:true,force:true});}
  });
}
function pinnedDependencies(root) {
  for(const [name,version] of Object.entries(read(owned(root,'package.json')).dependencies))assert(read(owned(root,'node_modules',name,'package.json')).version===version,`Pinned dependency mismatch: ${name}`);
}
export async function releaseInstallDependencies(options) {
  const config=settings(options);
  return locked(owned(config.stateRoot,'.release.lock'),options.recoverLock,async()=>{
    const target=staged(config,options.releaseId),marker=owned(config.stateRoot,'dependency-receipts',target.manifest.engine.engineId+'.json');
    if(fs.existsSync(marker)){pinnedDependencies(target.engine);return {status:'dependencies already installed; unchanged',engineRoot:target.engine,dependenciesInstalled:false};}
    const jobs=owned(config.stateRoot,'jobs');if(fs.existsSync(jobs))for(const item of fs.readdirSync(jobs)){const specFile=owned(jobs,item,'spec.json');if(fs.existsSync(specFile))assert(read(specFile).engine.root!==target.engine,'Cannot reinstall dependencies in an engine pinned by an existing job');}
    const file=owned(config.stateRoot,'dependency-logs',target.manifest.engine.engineId+'.txt');fs.mkdirSync(path.dirname(file),{recursive:true});
    try {const output=run('npm',['ci','--ignore-scripts','--no-audit','--no-fund','--cache',owned(config.stateRoot,'npm-cache')],{cwd:target.engine});fs.writeFileSync(file,output);pinnedDependencies(target.engine);verifyFiles(target.engine,target.manifest.engine.files);atomic(marker,{version:1,engineId:target.manifest.engine.engineId,node:process.version,architecture:process.arch,installedAt:new Date().toISOString(),lifecycleScripts:false});}
    catch(error){fs.writeFileSync(file,String(error));throw error;}
    return {status:'pinned engine dependencies installed; release not activated',engineRoot:target.engine,dependenciesInstalled:true,log:file};
  });
}
export async function releaseActivate(options) {
  const config=settings(options);
  return locked(owned(config.stateRoot,'.release.lock'),options.recoverLock,async()=>{
    const target=staged(config,options.releaseId),runtime=read(options.runtime);assert(runtime.version===1,'Version-1 runtime required');
    const probeFile=owned(config.stateRoot,'staging',`runtime-${crypto.randomUUID()}.json`);atomic(probeFile,{...runtime,assetRoot:target.assetRoot,assetManifest:target.assetManifest});
    let engine;try{engine=await inspectEngine({...options,engineRoot:target.engine,runtime:probeFile});}finally{fs.unlinkSync(probeFile);}
    assert(engine.engineId===target.manifest.engine.engineId&&engine.assetManifestSha256===target.manifest.assets.sha256,'Runtime/release mismatch');
    const previous=active(config),distribution={releaseId:target.manifest.releaseId,workflowId:target.manifest.plugin.workflowId,pluginVersion:target.manifest.plugin.version,manifestSha256:target.receipt.manifestSha256,localOnly:target.receipt.localOnly,previousReleaseId:previous?.distribution?.releaseId===target.manifest.releaseId?previous.distribution.previousReleaseId??null:previous?.distribution?.releaseId??null};
    const next={version:1,configuredAt:new Date().toISOString(),...engine,distribution};
    // This single atomic rename is the commit. Jobs/forms freeze this entire record.
    atomic(owned(config.stateRoot,'engine-config.json'),next);
    const result={status:options.rollback?'release rolled back for future campaigns':'release activated for future campaigns',...summary(target.manifest,previous),configuration:next,marketplaceRoot:owned(target.directory,'marketplace'),activeJobsChanged:false,pendingFormsChanged:false,campaignsOrOutputsDeleted:false,pluginInstalled:false};
    try {atomic(owned(config.stateRoot,'release-events',`${crypto.randomUUID()}.json`),{version:1,at:next.configuredAt,action:options.rollback?'rollback':'activate',releaseId:target.manifest.releaseId,previousReleaseId:distribution.previousReleaseId});} catch(error) {result.historyWarning='Activation committed; optional history write failed: '+error.message;}return result;
  });
}
export async function releaseRollback(options) {return releaseActivate({...options,rollback:true});}
export function releaseStatus(options) {
  const config=settings(options),current=active(config),workflowId=runningWorkflow();
  const releases=owned(config.stateRoot,'releases');
  return {status:'release status',active:current?.distribution??null,runningWorkflowId:workflowId,pluginRefreshRequired:!!current?.distribution&&current.distribution.workflowId!==workflowId,engineRoot:current?.root??null,stagedReleaseIds:fs.existsSync(releases)?fs.readdirSync(releases).filter(v=>/^[a-f0-9]{64}$/.test(v)):[],retention:'all versions retained; no automatic deletion or job migration',codexInstallationVerified:false,writesPerformed:false};
}
