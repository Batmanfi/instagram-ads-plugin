#!/usr/bin/env node
// Standalone installer driver for a verified kit. Never registers Codex or renders.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const [command,...args]=process.argv.slice(2),allowed=['kit','manifest-sha256','state-root','data-root','timezone','browser','serif-font'];const options={};
function requireValue(ok,message){if(!ok)throw Error(message);}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
try {
 requireValue(['doctor','setup'].includes(command),'Use doctor or setup. This driver never installs a Codex plugin or starts production.');
 for(let i=0;i<args.length;i++){const key=args[i].replace(/^--/,'');requireValue(args[i].startsWith('--')&&allowed.includes(key)&&!(key in options),'Unknown/duplicate option');const value=args[++i];requireValue(value&&!value.startsWith('--'),'Missing option value');options[key]=value;}
 requireValue(options.kit&&path.isAbsolute(options.kit),'Supply --kit with the extracted absolute kit root');const kit=fs.realpathSync(options.kit),index=JSON.parse(fs.readFileSync(path.join(kit,'pilot.json')));
 requireValue(index.version===1&&index.synthetic===true,'Expected synthetic pilot kit');
 requireValue(options['manifest-sha256']===index.manifestSha256,'Supply the trusted manifest SHA-256 separately; the kit cannot establish publisher trust by itself');
 for(const name of [index.manifest,'bootstrap/instagram-ads/scripts/cli.mjs'])requireValue(typeof name==='string'&&!path.isAbsolute(name)&&!name.split('/').includes('..'),'Unsafe kit path');
 const manifest=path.join(kit,index.manifest);requireValue(sha(fs.readFileSync(manifest))===options['manifest-sha256'],'Manifest checksum mismatch');
 const declared=JSON.parse(fs.readFileSync(manifest));requireValue(declared.version===1&&declared.product==='instagram-ads'&&Array.isArray(declared.plugin?.files)&&declared.plugin.files.length,'Invalid release plugin index');
 const bootstrap=path.join(kit,'bootstrap/instagram-ads');const seen=new Set();
 for(const entry of declared.plugin.files){requireValue(typeof entry.path==='string'&&!path.isAbsolute(entry.path)&&!entry.path.includes('\\')&&entry.path.split('/').every(part=>part&&part!=='.'&&part!=='..')&&!seen.has(entry.path),'Unsafe bootstrap file index');seen.add(entry.path);const file=path.join(bootstrap,entry.path);requireValue(fs.realpathSync(file)===file&&fs.statSync(file).isFile()&&fs.statSync(file).size===entry.size&&sha(fs.readFileSync(file))===entry.sha256,'Bootstrap plugin checksum mismatch: '+entry.path);}
 const state=options['state-root']??path.join(os.homedir(),'Library/Application Support/Instagram Ads'),data=options['data-root']??path.join(os.homedir(),'Documents/Instagram Ads');
 requireValue(path.isAbsolute(state)&&path.isAbsolute(data),'State/data paths must be absolute');
 const cli=path.join(kit,'bootstrap/instagram-ads/scripts/cli.mjs'),common=['--state-root',state];
 function call(cmd,args=[]) {const result=spawnSync(process.execPath,[cli,cmd,...common,...args],{encoding:'utf8',maxBuffer:20*1024*1024});if(result.error)throw result.error;requireValue(result.status===0,result.stderr||result.stdout);return JSON.parse(result.stdout);}
 const diagnostic=call('doctor');if(command==='doctor'){console.log(JSON.stringify({diagnostic,synthetic:true,pluginInstalledByDriver:false,rendersStarted:false},null,2));}
 else {
  requireValue(process.platform==='darwin'&&process.arch==='arm64','The pilot candidate currently supports macOS arm64');requireValue(options.browser&&path.isAbsolute(options.browser),'Supply --browser with an existing browser executable');requireValue(options['serif-font']&&path.isAbsolute(options['serif-font']),'Supply --serif-font with the exact installed Times New Roman Regular TTF');
  const failures=Object.entries(diagnostic.prerequisites).filter(([,v])=>!v.available).map(([key])=>key);requireValue(!failures.length,'Resolve missing prerequisites first: '+failures.join(', '));
  call('init',['--data-root',data,'--timezone',options.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone]);
  call('release-check',['--manifest',manifest,'--manifest-sha256',options['manifest-sha256']]);
  const staged=call('release-stage',['--manifest',manifest,'--manifest-sha256',options['manifest-sha256'],'--asset-root',path.join(kit,'synthetic-assets')]);
  const dependencies=call('release-install-dependencies',['--release-id',staged.releaseId]);
  const runtimeDirectory=path.join(state,'pilot-config');fs.mkdirSync(runtimeDirectory,{recursive:true});const runtime=path.join(runtimeDirectory,`runtime-${crypto.randomUUID()}.json`);fs.writeFileSync(runtime,JSON.stringify({version:1,browserExecutable:options.browser,serifFontFile:options['serif-font'],concurrency:2},null,2)+'\n',{flag:'wx',mode:0o600});
  const activation=call('release-activate',['--release-id',staged.releaseId,'--runtime',runtime]);
  console.log(JSON.stringify({status:'synthetic pilot engine ready; install the plugin separately in Codex',releaseId:staged.releaseId,manifestSha256:index.manifestSha256,marketplaceRoot:staged.marketplaceRoot,workspace:path.join(data,'Workspace'),sourceFixture:path.join(kit,'fixtures/SYNTHETIC-COPY.md'),dependenciesInstalled:dependencies.dependenciesInstalled,activation,pluginInstalledByDriver:false,rendersStarted:false,productionMediaVerified:false},null,2));
 }
} catch(error){console.error(JSON.stringify({status:'error',message:error.message,pluginInstalledByDriver:false,rendersStarted:false}));process.exitCode=1;}
