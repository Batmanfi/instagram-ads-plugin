import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {read,owned,atomic,locked} from './storage.mjs';
import {verifyJob,reconcile,run} from './job-runtime.mjs';

const directory=path.resolve(process.argv[2]);
let acquired=false;
try {
  await locked(owned(directory,'.worker.lock'),true,async()=>{
    acquired=true;
    const {spec,control}=verifyJob(directory),progressFile=owned(directory,'progress.json');
    let progress=reconcile(directory,spec,read(progressFile));
    progress.workerPid=process.pid;progress.phase='rendering';atomic(progressFile,progress);
    const copy=read(owned(spec.inputs,'copy.json'));
    const ordered=[spec.representativeId,...copy.ads.map(a=>a.id).filter(id=>id!==spec.representativeId)];
    if(!progress.reviews[spec.representativeId])ordered.splice(1);
    for(const id of ordered) {
      if(progress.ads[id]?.status==='rendered')continue;
      const attemptId=crypto.randomUUID(),workRoot=owned(directory,'attempts',attemptId,'work');
      const attempt={id:attemptId,adId:id,workRoot,startedAt:new Date().toISOString()};progress.attempts.push(attempt);
      const runtimeFile=owned(directory,'attempts',attemptId,'runtime.json');
      atomic(runtimeFile,{version:1,mode:'job',...spec.engine,campaignDir:spec.inputs,workRoot,outputRoot:spec.outputRoot,jobSpec:owned(directory,'spec.json'),jobSpecSha256:control.specSha256});
      const args=[owned(spec.engine.root,'scripts/render.mjs'),'--runtime',runtimeFile,'--campaign',spec.campaign,'--id',id];
      try {
        const preflight=JSON.parse(run(process.execPath,[...args,'--dry-run'],{cwd:directory}));
        atomic(owned(directory,'attempts',attemptId,'preflight.json'),preflight);
      } catch(error) {
        attempt.exitCode='preflight failed';attempt.finishedAt=new Date().toISOString();progress.ads[id]={id,status:'failed',reason:error.message};atomic(progressFile,progress);
        if(id===spec.representativeId&&ordered.length===1)ordered.push(...copy.ads.map(ad=>ad.id).filter(next=>next!==id));continue;
      }
      const fd=fs.openSync(owned(directory,'worker.log'),'a',0o600);
      const child=spawn(process.execPath,args,{cwd:directory,stdio:['ignore',fd,fd]});fs.closeSync(fd);
      attempt.pid=child.pid;progress.renderPid=child.pid;atomic(progressFile,progress);
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      attempt.finishedAt=new Date().toISOString();attempt.exitCode=code;progress.renderPid=null;
      progress=reconcile(directory,spec,progress);
      if(!progress.ads[id])progress.ads[id]={id,status:'failed',reason:`Renderer exited ${code}; inspect worker.log`};
      atomic(progressFile,progress);
      if(id===spec.representativeId&&progress.ads[id]?.status!=='rendered'&&ordered.length===1)ordered.push(...copy.ads.map(a=>a.id).filter(next=>next!==id));
    }
    progress.phase=!progress.reviews[spec.representativeId]&&progress.ads[spec.representativeId]?.status==='rendered'?'awaiting-representative-qa':Object.values(progress.ads).some(a=>a.status!=='rendered')?'needs-recovery':'awaiting-final-qa';
    // A failed representative must not prevent valid remaining ads from rendering.
    if(!progress.reviews[spec.representativeId]&&progress.ads[spec.representativeId]?.status!=='rendered')progress.phase='needs-recovery';
    progress.workerPid=null;atomic(progressFile,progress);
  });
} catch(error) {
  if(acquired)try {const file=owned(directory,'progress.json'),progress=read(file);progress.phase='needs-recovery';progress.workerPid=null;progress.error=error.message;atomic(file,progress);}catch{}
  console.error(error.stack);process.exitCode=1;
}
