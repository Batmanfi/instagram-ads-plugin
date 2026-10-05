import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {init,prepare,apply} from '../plugins/instagram-ads/lib/campaign-service.mjs';
import {atomic,hash,read} from '../plugins/instagram-ads/lib/storage.mjs';
import {discoverSerif,fontIdentity} from '../engine/scripts/lib/portable-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'.local/engine-qa');fs.mkdirSync(base,{recursive:true});
const browser=process.argv[2];if(!browser)throw Error('Provide an already installed render browser executable');
const options={stateRoot:path.join(base,'state'),dataRoot:path.join(base,'data'),timezone:'Asia/Kolkata',chatId:'synthetic-engine-qa'};init(options);
const content=[
  ['Portable render check 👇','Synthetic copy only.'],
  ['Dense layout check.','Punctuation stays exact: $25, 10% & “quotes”.','The renderer keeps every word visible.','All spacing uses the approved compact policy.','QA only — no campaign claims.'],
  ['Coral style check.','Exact copy, local assets.','Proof block: 1, 2, 3.','Synthetic CTA only.'],
  ['Portable serif check','Local Times New Roman Regular.','Silent footage, optional music.','QA only.'],
];
const parsed={version:1,ads:content.map((texts,i)=>({id:`qa-style-${i+1}`,title:`Synthetic Style ${i+1}`,status:'QA fixture',blocks:texts.map((text,n)=>({id:`block-${n+1}`,text,role:n===0?'hook':n===texts.length-1?'cta':n===1?'support':'proof'}))}))};
const source=path.join(base,'synthetic-source.md'),copy=path.join(base,'parsed.json'),audit=path.join(base,'audit.json');
fs.writeFileSync(source,parsed.ads.map(a=>`# ${a.title}\n\n${a.blocks.map(b=>b.text).join('\n\n')}`).join('\n\n')+'\n');atomic(copy,parsed);
// This is a generated literal fixture. Check every supplied literal against its source,
// and use the normal campaign path without fabricating a real-source human audit.
for(const ad of parsed.ads)for(const block of ad.blocks)if(!fs.readFileSync(source,'utf8').includes(block.text))throw Error('Synthetic source audit failed');
atomic(audit,{version:1,status:'passed',method:'independent-source-word-audit',sourceSha256:hash(fs.readFileSync(source)),parsedSha256:hash(fs.readFileSync(copy)),reviewedAdIds:parsed.ads.map(a=>a.id),reviewedBlockIds:Object.fromEntries(parsed.ads.map(a=>[a.id,a.blocks.map(b=>b.id)])),findings:[],evidence:'Synthetic literals compared with the generated source; not a real customer-source audit'});
const prepared=await prepare({...options,source,copy,audit,brand:'Portable engine QA'}),lock=read(path.join(prepared.directory,'campaign-lock.json'));
const choices=path.join(base,'choices.json');atomic(choices,{kind:'instagram-ad-campaign-setup',version:1,demo:false,campaign:prepared.campaign,requestId:lock.requestId,copySha256:lock.copySha256,adCount:4,adIds:parsed.ads.map(a=>a.id),style:'style-1',musicScope:'selected',musicAdIds:['qa-style-4'],trackSelection:'random-balanced',audio:{startTime:0,volume:.25,fadeInSeconds:8/30,fadeOutSeconds:.5},overrides:parsed.ads.map((a,i)=>({id:a.id,style:`style-${i+1}`}))});
await apply({...options,campaign:prepared.campaign,choices});
const manifestFile=path.join(prepared.directory,'manifest.json'),manifest=read(manifestFile);manifest.qaOnly=true;atomic(manifestFile,manifest);
const serifFontFile=discoverSerif();if(serifFontFile)fontIdentity(serifFontFile);
const runtime={version:1,mode:'qa',assetRoot:path.join(root,'.local/assets/source-v1'),assetManifest:path.join(root,'asset-manifests/source-v1.json'),campaignDir:prepared.directory,workRoot:path.join(base,'scratch'),outputRoot:path.join(base,'outputs'),browserExecutable:path.resolve(browser),serifFontFile,concurrency:2};
atomic(path.join(base,'runtime.json'),runtime);console.log(JSON.stringify({runtime:path.join(base,'runtime.json'),campaign:prepared.campaign,ads:4,synthetic:true,serifFontFile},null,2));
