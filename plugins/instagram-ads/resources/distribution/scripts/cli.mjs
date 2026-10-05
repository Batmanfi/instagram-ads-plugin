#!/usr/bin/env node
import {doctor,init,prepare,form,apply,status,compatibilityForm,compatibilityAccept} from '../lib/campaign-service.mjs';

import {configureEngine,start,jobStatus,resume,review,finalize} from '../lib/job-service.mjs';
import {releaseCheck,releaseStage,releaseInstallDependencies,releaseActivate,releaseRollback,releaseStatus} from '../lib/release-service.mjs';
const commands={'release-check':releaseCheck,'release-stage':releaseStage,'release-install-dependencies':releaseInstallDependencies,'release-activate':releaseActivate,'release-rollback':releaseRollback,'release-status':releaseStatus,'configure-engine':configureEngine,start,'job-status':jobStatus,resume,'qa-review':review,finalize,doctor,init,prepare,form,apply,status,'compatibility-form':compatibilityForm,'compatibility-accept':compatibilityAccept};
const allowed={
  'release-check':['state-root','manifest','manifest-sha256'],
  'release-stage':['state-root','manifest','manifest-sha256','asset-root','local-only-assets','recover-lock'],
  'release-install-dependencies':['state-root','release-id','recover-lock'],
  'release-activate':['state-root','release-id','runtime','recover-lock'],
  'release-rollback':['state-root','release-id','runtime','recover-lock'],
  'release-status':['state-root'],
  'configure-engine':['state-root','engine-root','runtime','recover-lock'],start:['state-root','campaign','chat-id','choices','recover-lock','synthetic-qa'],
  'job-status':['state-root','campaign','chat-id'],resume:['state-root','campaign','chat-id','recover-lock'],
  'qa-review':['state-root','campaign','chat-id','review','recover-lock'],finalize:['state-root','campaign','chat-id','recover-lock','allow-partial'],
  doctor:['state-root'],init:['state-root','data-root','timezone'],
  prepare:['state-root','copy','source','brand','chat-id','audit','source-url','snapshot','output'],
  form:['state-root','campaign','chat-id','output'],apply:['state-root','campaign','chat-id','choices','recover-lock'],
  status:['state-root','campaign','chat-id'],'compatibility-form':['state-root','chat-id','output'],
  'compatibility-accept':['state-root','chat-id','choices']
};
const required={'release-check':['manifest','manifest-sha256'],'release-stage':['manifest','manifest-sha256'],'release-install-dependencies':['release-id'],'release-activate':['release-id','runtime'],'release-rollback':['release-id','runtime'],'configure-engine':['engine-root','runtime'],start:['campaign','chat-id','choices'],'job-status':['campaign','chat-id'],resume:['campaign','chat-id'],'qa-review':['campaign','chat-id','review'],finalize:['campaign','chat-id'],prepare:['copy','source','brand','chat-id','audit'],form:['campaign','chat-id'],apply:['campaign','chat-id','choices'],status:['campaign','chat-id'],'compatibility-form':['chat-id'],'compatibility-accept':['chat-id','choices']};
try {
  const [command,...args]=process.argv.slice(2);
  if(command==='--help'||command==='help'||!command) {console.log('Instagram Ads development alpha: doctor, init, prepare, form, apply, status, compatibility-form, compatibility-accept. Production requires a configured pinned engine and a final Start production submission. Commands: configure-engine, start, job-status, resume, qa-review, finalize, release-check, release-stage, release-install-dependencies, release-activate, release-rollback, release-status.');}
  else {
    if(!commands[command])throw Error(`Unsupported command ${command}. Use start for validated production jobs. Use help for supported local release and campaign commands.`);
    const options={};
    for(let i=0;i<args.length;i++) {
      const key=args[i].replace(/^--/,'');
      if(!args[i].startsWith('--')||!allowed[command].includes(key))throw Error(`Unknown option ${args[i]}`);
      const camel=key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
      if(camel in options)throw Error(`Duplicate option --${key}`);
      if(['recover-lock','synthetic-qa','allow-partial','local-only-assets'].includes(key))options[camel]=true;
      else {const value=args[++i];if(!value||value.startsWith('--'))throw Error(`Missing --${key}`);options[camel]=value;}
    }
    for(const key of required[command]??[])if(!options[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())])throw Error(`Required: --${key}`);
    console.log(JSON.stringify(await commands[command](options),null,2));
  }
} catch(error) {console.error(JSON.stringify({status:'error',message:error.message}));process.exitCode=1;}
