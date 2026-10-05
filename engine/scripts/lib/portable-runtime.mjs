import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const inside=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
export function canonical(file) {
  check(typeof file==='string'&&path.isAbsolute(file),'Runtime paths must be absolute');
  let base=path.resolve(file),suffix=[];
  while(!fs.existsSync(base)){suffix.unshift(path.basename(base));const next=path.dirname(base);check(next!==base,'Cannot resolve path');base=next;}
  return path.join(fs.realpathSync(base),...suffix);
}
export function safeFile(root,name) {
  check(typeof name==='string'&&!path.isAbsolute(name)&&!name.split(/[\\/]/).includes('..'),'Invalid relative asset path');
  const file=path.resolve(root,name);check(inside(root,file)&&file!==root,'Asset escaped its root');
  const resolved=canonical(file);check(inside(root,resolved)&&resolved===file,'Asset paths cannot contain symlinks');return file;
}
export function loadRuntime(file,engineRoot) {
  check(file,'Pass --runtime with an explicit portable runtime JSON. Legacy personal paths are disabled.');
  const value=read(file);check(value.version===1,'Unsupported runtime version');
  const required=['assetRoot','assetManifest','campaignDir','workRoot','outputRoot','browserExecutable'];
  const result={version:1,engineRoot:canonical(engineRoot),runtimeFile:canonical(path.resolve(file))};
  for(const name of required)result[name]=canonical(value[name]);
  result.serifFontFile=value.serifFontFile?canonical(value.serifFontFile):null;
  result.mode=value.mode??'qa';check(['qa','job'].includes(result.mode),'Runtime mode must be qa or job');
  if(result.mode==='job') {
    result.jobSpec=canonical(value.jobSpec);result.jobSpecSha256=value.jobSpecSha256;
    check(sha256(fs.readFileSync(result.jobSpec))===result.jobSpecSha256,'Job specification changed');
    const job=read(result.jobSpec);
    check(job.version===1&&job.action==='start-production','A final Start production job specification is required');
    check(job.engine.root===result.engineRoot&&job.inputs===result.campaignDir&&job.outputRoot===result.outputRoot,'Job runtime does not match pinned roots');
    check(sha256(fs.readFileSync(result.assetManifest))===job.engine.assetManifestSha256,'Job asset manifest changed');
    for(const name of ['copy.json','manifest.json'])check(sha256(fs.readFileSync(safeFile(result.campaignDir,name)))===job.inputHashes[name],`Job ${name} changed`);
    if(job.engine.serifFontSha256)check(result.serifFontFile&&sha256(fs.readFileSync(result.serifFontFile))===job.engine.serifFontSha256,'Pinned installed font changed');
  }
  result.concurrency=value.concurrency??2;check(Number.isInteger(result.concurrency)&&result.concurrency>=1&&result.concurrency<=16,'Invalid concurrency');
  const reads=[result.engineRoot,result.assetRoot,result.campaignDir],writes=[result.workRoot,result.outputRoot];
  for(const write of writes){check(write!==path.parse(write).root,'Cannot write into filesystem root');for(const input of reads)check(!inside(input,write)&&!inside(write,input),'Read-only inputs and writable roots must not overlap');}
  check(!inside(writes[0],writes[1])&&!inside(writes[1],writes[0]),'Scratch/output roots must not overlap');
  for(const directory of reads)check(fs.statSync(directory).isDirectory(),'Input root is not a directory');
  check(fs.statSync(result.browserExecutable).isFile(),'Configured browser is missing');fs.accessSync(result.browserExecutable,fs.constants.X_OK);
  return result;
}
export function verifyAssets(runtime) {
  const manifest=read(runtime.assetManifest);check(manifest.version===1&&typeof manifest.id==='string'&&Array.isArray(manifest.files)&&manifest.files.length,'Invalid asset manifest');
  const names=new Set();
  for(const entry of manifest.files) {
    check(!names.has(entry.path),'Duplicate asset manifest path');names.add(entry.path);const file=safeFile(runtime.assetRoot,entry.path);
    check(fs.statSync(file).size===entry.size&&sha256(fs.readFileSync(file))===entry.sha256,`Asset checksum mismatch: ${entry.path}`);
  }
  return {id:manifest.id,manifestSha256:sha256(fs.readFileSync(runtime.assetManifest)),files:manifest.files.length,distributionStatus:manifest.distributionStatus,entries:manifest.files};
}
export function fontIdentity(file) {
  const bytes=fs.readFileSync(file);check(bytes.length>=12,'Invalid TTF');
  check(bytes.toString('ascii',0,4)!=='ttcf','Supply the regular Times New Roman .ttf file, not a font collection');
  const count=bytes.readUInt16BE(4);let offset;
  for(let i=0;i<count;i++){const at=12+16*i;check(at+16<=bytes.length,'Invalid TTF table');if(bytes.toString('ascii',at,at+4)==='name')offset=bytes.readUInt32BE(at+8);}
  check(offset!==undefined&&offset+6<=bytes.length,'Font name table missing');
  const records=bytes.readUInt16BE(offset+2),strings=offset+bytes.readUInt16BE(offset+4),names=[];
  for(let i=0;i<records;i++) {
    const at=offset+6+i*12;check(at+12<=bytes.length,'Invalid font name record');
    const platform=bytes.readUInt16BE(at),id=bytes.readUInt16BE(at+6),length=bytes.readUInt16BE(at+8),start=strings+bytes.readUInt16BE(at+10);
    check(start+length<=bytes.length,'Invalid font name offset');if(![1,2,6,16,17].includes(id))continue;
    const slice=Buffer.from(bytes.subarray(start,start+length));let text;
    if(platform===0||platform===3){check(length%2===0,'Invalid font name encoding');slice.swap16();text=slice.toString('utf16le');}else text=slice.toString('latin1');
    names.push({id,text});
  }
  check(names.some(n=>[1,16].includes(n.id)&&n.text==='Times New Roman'),'Font must be the exact Times New Roman family');
  check(names.some(n=>[2,17].includes(n.id)&&n.text==='Regular')&&names.some(n=>n.id===6&&n.text==='TimesNewRomanPSMT'),'Font must be Times New Roman Regular, not a substituted/bold/italic face');
  return {family:'Times New Roman',weight:400,postScriptName:'TimesNewRomanPSMT',sha256:sha256(bytes),file,redistribution:'not bundled; installed font copied only into temporary local render assets'};
}
export function discoverSerif() {
  return [path.join(os.homedir(),'Library/Fonts/Times New Roman.ttf'),'/Library/Fonts/Times New Roman.ttf','/System/Library/Fonts/Supplemental/Times New Roman.ttf'].find(file=>fs.existsSync(file))??null;
}
export function probe(file) {
  const result=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',maxBuffer:20*1024*1024,timeout:30000});
  if(result.error)throw result.error;check(result.status===0,`ffprobe failed: ${result.stderr}`);return JSON.parse(result.stdout);
}
export function inventoryAssets(runtime,verified) {
  const backgrounds=verified.entries.filter(e=>e.path.startsWith('backgrounds/')&&e.path.endsWith('.mp4')).map(entry=>{
    const metadata=probe(safeFile(runtime.assetRoot,entry.path)),v=metadata.streams.find(s=>s.codec_type==='video');check(v,'Scenery has no video stream');
    const duration=Number(v.duration??metadata.format.duration);check(Number.isFinite(duration),'Invalid scenery duration');
    return {filename:path.basename(entry.path),duration,width:v.width,height:v.height,fps:v.r_frame_rate,suitableFor10Seconds:duration>=10};
  });
  const music=verified.entries.filter(e=>e.path.startsWith('music/')&&e.path.endsWith('.mp3')).map(entry=>{const metadata=probe(safeFile(runtime.assetRoot,entry.path)),a=metadata.streams.find(s=>s.codec_type==='audio');check(a,'Music has no audio stream');return {filename:path.basename(entry.path),duration:Number(a.duration??metadata.format.duration),codec:a.codec_name};});
  return {backgrounds,music};
}
export function stagePublic(runtime,work,verified,serif) {
  const publicDir=path.join(work,'public');fs.mkdirSync(publicDir,{recursive:true});
  for(const folder of ['fonts','emoji'])fs.cpSync(path.join(runtime.engineRoot,'public',folder),path.join(publicDir,folder),{recursive:true,dereference:false});
  for(const entry of verified.entries){const destination=safeFile(publicDir,entry.path);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(safeFile(runtime.assetRoot,entry.path),destination,fs.constants.COPYFILE_EXCL);check(sha256(fs.readFileSync(destination))===entry.sha256,'Asset changed while staging');}
  if(serif){const destination=path.join(publicDir,'fonts/TimesNewRoman-Installed.ttf');fs.copyFileSync(serif.file,destination,fs.constants.COPYFILE_EXCL);check(sha256(fs.readFileSync(destination))===serif.sha256,'Installed serif font changed while staging');}
  return publicDir;
}
export function verifyFonts(engineRoot) {
  return ['Roboto','RobotoCondensed'].flatMap(family=>['Regular','Medium','Bold'].map(weight=>{
    const filename=`${family}-${weight}.ttf`,file=safeFile(engineRoot,`public/fonts/${filename}`);check(fs.existsSync(file),`Required font missing: ${filename}`);
    return {filename,sha256:sha256(fs.readFileSync(file))};
  }));
}
