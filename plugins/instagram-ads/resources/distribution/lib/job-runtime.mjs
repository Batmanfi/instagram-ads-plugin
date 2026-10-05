import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash,read,assert,owned,canonical,verifyRelease} from './storage.mjs';

export function alive(pid) {
  if(!Number.isInteger(pid)||pid<1)return false;
  try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}
}
export function run(command,args,options={}) {
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:20*1024*1024,...options});
  if(result.error)throw result.error;assert(result.status===0,`${command} failed: ${result.stderr||result.stdout}`);return result.stdout;
}
export function verifyEngine(directory) {
  directory=canonical(directory);const release=read(owned(directory,'engine-release.json'));
  assert(release.version===1&&Array.isArray(release.files)&&release.files.length>0&&release.capabilities.productionJobs===true,'Engine lacks production-job capability');
  assert(hash(JSON.stringify(release.files))===release.engineId,'Engine release digest mismatch');
  const seen=new Set();
  for(const entry of release.files){assert(!seen.has(entry.path),'Duplicate engine path');seen.add(entry.path);const file=owned(directory,entry.path);assert(fs.statSync(file).isFile()&&fs.statSync(file).size===entry.size&&hash(fs.readFileSync(file))===entry.sha256,`Engine integrity failure: ${entry.path}`);}
  for(const name of ['scripts/render.mjs','scripts/lib/portable-runtime.mjs','package.json','package-lock.json'])assert(seen.has(name),'Engine release omits required code');
  return release;
}
export function verifyJob(directory) {
  const control=read(owned(directory,'job.json')),specFile=owned(directory,'spec.json');
  assert(hash(fs.readFileSync(specFile))===control.specSha256,'Pinned job specification changed');
  const spec=read(specFile);assert(spec.version===1&&spec.directory===directory,'Job directory identity mismatch');
  const release=verifyRelease(spec.workflowRoot);assert(release.workflowId===spec.workflowId,'Pinned workflow mismatch');
  assert(verifyEngine(spec.engine.root).engineId===spec.engine.engineId,'Pinned engine mismatch');
  for(const [name,digest] of Object.entries(spec.inputHashes))assert(hash(fs.readFileSync(owned(spec.inputs,name)))===digest,`Job input changed: ${name}`);
  assert(hash(fs.readFileSync(spec.engine.assetManifest))===spec.engine.assetManifestSha256,'Pinned asset manifest changed');
  assert(hash(fs.readFileSync(spec.engine.browserExecutable))===spec.engine.browserSha256,'Pinned browser changed; resume requires the original executable');
  if(spec.engine.serifFontFile)assert(hash(fs.readFileSync(spec.engine.serifFontFile))===spec.engine.serifFontSha256,'Pinned Times New Roman changed');
  const assets=read(spec.engine.assetManifest);
  for(const entry of assets.files){const file=owned(spec.engine.assetRoot,entry.path);assert(fs.statSync(file).size===entry.size&&hash(fs.readFileSync(file))===entry.sha256,`Pinned asset changed: ${entry.path}`);}
  return {control,spec};
}
export function verifyMedia(entry,expectedMusic) {
  assert(fs.existsSync(entry.output)&&hash(fs.readFileSync(entry.output))===entry.sha256,'Completed output checksum mismatch');
  const metadata=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',entry.output]));
  const videos=metadata.streams.filter(s=>s.codec_type==='video'),audio=metadata.streams.filter(s=>s.codec_type==='audio'),v=videos[0];
  assert(videos.length===1&&v.codec_name==='h264'&&v.pix_fmt==='yuv420p'&&v.width===1080&&v.height===1920&&v.r_frame_rate==='30/1'&&Number(v.nb_frames)===300&&Math.abs(Number(metadata.format.duration)-10)<=.0001,'MP4 does not match production specification');
  assert(expectedMusic ? audio.length===1&&audio[0].codec_name==='aac'&&Math.abs(Number(audio[0].duration)-10)<=.0001 : audio.length===0,'MP4 audio does not match explicit music selection');
  run('ffmpeg',['-v','error','-xerror','-i',entry.output,'-f','null','-']);
  assert(Array.isArray(entry.stills)&&entry.stills.length===3,'Beginning/middle/end stills missing');
  const stillHashes=entry.stills.map(file=>({file,sha256:hash(fs.readFileSync(file))}));
  return {...entry,metadata:{codec:v.codec_name,pixelFormat:v.pix_fmt,width:v.width,height:v.height,fps:v.r_frame_rate,frames:v.nb_frames,duration:metadata.format.duration,decode:'passed',audio:expectedMusic?'aac':'none'},verifiedAt:new Date().toISOString(),fullMetadata:metadata,stillHashes};
}
export function reconcile(directory,spec,progress) {
  const manifest=read(owned(spec.inputs,'manifest.json')),copy=read(owned(spec.inputs,'copy.json'));
  const accept=(entry,ad)=>{
    assert(path.dirname(entry.output)===spec.outputRoot,'Output escaped canonical folder');
    assert(progress.attempts.some(attempt=>entry.resolvedFile?.startsWith(attempt.workRoot+path.sep)&&entry.stills?.every(file=>file.startsWith(attempt.workRoot+path.sep))),'Resolved props/stills escaped job attempts');
    const props=read(entry.resolvedFile),source=copy.ads.find(item=>item.id===ad.id);
    assert(props.ad.id===ad.id&&JSON.stringify(props.ad.blocks.map(block=>({id:block.id,text:block.text})))===JSON.stringify(source.blocks),'Resolved display copy does not match frozen source');
    assert(props.ad.style===ad.style&&!!props.ad.music===!!ad.music,'Resolved controls do not match submitted choices');
    if(ad.music)for(const key of ['track','startTime','volume','fadeInSeconds','fadeOutSeconds']) {
      const expected=['startTime','fadeInSeconds','fadeOutSeconds'].includes(key)?Math.round((ad.music[key]??0)*30)/30:ad.music[key];
      assert((props.ad.music[key]??0)===expected,'Resolved music no longer matches submitted choices');
    }
    return verifyMedia(entry,!!ad.music);
  };
  for(const ad of manifest.ads){
    const existing=progress.ads[ad.id];
    if(existing?.status==='rendered') {
      try {progress.ads[ad.id]=accept(existing,ad);}catch(error){progress.ads[ad.id]={id:ad.id,status:'invalid-output',reason:error.message,previous:existing};delete progress.reviews[ad.id];}
    }
  }
  for(const attempt of progress.attempts) {
    if(!fs.existsSync(attempt.workRoot))continue;
    for(const item of fs.readdirSync(attempt.workRoot,{withFileTypes:true})) {
      if(!item.isDirectory())continue;assert(!item.isSymbolicLink(),'Attempt directories cannot be symlinks');const name=item.name;
      const reportFile=owned(attempt.workRoot,name,'report.json');if(!fs.existsSync(reportFile))continue;
      const report=read(reportFile);assert(report.copySha256===spec.copySha256,'Attempt report belongs to different copy');
      for(const entry of [...report.ads,...(report.pendingDelivery?[report.pendingDelivery]:[])]) {
        const ad=manifest.ads.find(a=>a.id===entry.id);assert(ad&&attempt.adId===ad.id,'Unexpected ad in attempt report');
        if(progress.ads[ad.id]?.status==='rendered')continue;
        if(entry.status==='rendered') {
          try {const candidate={...entry,reportFile,resolvedFile:owned(path.dirname(reportFile),`${ad.id}-resolved.json`)};progress.ads[ad.id]=accept(candidate,ad);}catch(error){progress.ads[ad.id]={id:ad.id,status:'invalid-output',reason:error.message};}
        } else if(entry.status==='failed'&&progress.ads[ad.id]?.status!=='rendered')progress.ads[ad.id]={...entry,reportFile};
      }
    }
  }
  return progress;
}
export function reviewBinding(entry) {
  return hash(JSON.stringify({sha256:entry.sha256,stills:entry.stillHashes,resolvedSha256:hash(fs.readFileSync(entry.resolvedFile))}));
}
