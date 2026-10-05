import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadRuntime,verifyAssets,inventoryAssets,fontIdentity,discoverSerif,sha256} from './lib/portable-runtime.mjs';
const engineRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),index=args.indexOf('--runtime');
const inspect=(cmd,argv)=>{const result=spawnSync(cmd,argv,{encoding:'utf8',timeout:10000});return {available:!result.error&&result.status===0,version:(result.stdout||result.stderr||result.error?.message||'').trim().split('\n')[0]};};
try {
  const runtime=loadRuntime(index>=0?args[index+1]:undefined,engineRoot),assets=verifyAssets(runtime),inventory=inventoryAssets(runtime,assets);
  const packages=Object.entries(JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'))).dependencies).map(([name,expected])=>{
    const file=path.join(engineRoot,'node_modules',name,'package.json');const installed=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).version:null;return {name,expected,installed,passed:installed===expected};
  });
  const fonts=['Roboto','RobotoCondensed'].flatMap(family=>['Regular','Medium','Bold'].map(weight=>{
    const file=path.join(engineRoot,'public/fonts',`${family}-${weight}.ttf`);return {filename:path.basename(file),available:fs.existsSync(file),...(fs.existsSync(file)?{sha256:sha256(fs.readFileSync(file))}:{})};
  }));
  const serif=runtime.serifFontFile?fontIdentity(runtime.serifFontFile):{available:false,detectedCandidate:discoverSerif(),action:'Set serifFontFile to the installed exact Times New Roman Regular .ttf before Style 4'};
  const tools={ffmpeg:inspect('ffmpeg',['-version']),ffprobe:inspect('ffprobe',['-version']),pillow:inspect('python3',['-c','import PIL; print(PIL.__version__)']),swift:inspect('xcrun',['--find','swift'])};
  const passed=packages.every(p=>p.passed)&&fonts.every(f=>f.available)&&tools.ffmpeg.available&&tools.ffprobe.available&&!!runtime.serifFontFile;
  console.log(JSON.stringify({status:passed?'prerequisites checked':'setup incomplete',platform:process.platform,architecture:process.arch,node:process.version,runtime,packages,fonts,serif,tools,assets:{id:assets.id,files:assets.files,manifestSha256:assets.manifestSha256},inventory,writesPerformed:false,browser:{file:runtime.browserExecutable,launch:'Requires actual QA render; file/executable check passed'},unverified:['second Mac/account','full dependency installation on minimum supported Node/macOS','persistent production jobs and complete delivery','private asset redistribution clearance']},null,2));
  if(!passed)process.exitCode=1;
} catch(error){console.error(JSON.stringify({status:'error',message:error.message,writesPerformed:false}));process.exitCode=1;}
