import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {init,prepare,form,apply,status,compatibilityForm,compatibilityAccept,pluginRoot} from '../plugins/instagram-ads/lib/campaign-service.mjs';
import {hash,read,atomic,owned,verifyRelease,locked} from '../plugins/instagram-ads/lib/storage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testRoot=path.join(root,'.local/tests');fs.mkdirSync(testRoot,{recursive:true});
const temporary=()=>fs.mkdtempSync(path.join(testRoot,'case-'));
function fixture(count=7) {
  const base=temporary(),options={stateRoot:path.join(base,'state'),dataRoot:path.join(base,'data'),timezone:'Asia/Kolkata',chatId:'trusted-chat'};
  init(options);
  const parsed={version:1,ads:Array.from({length:count},(_,i)=>({id:`qa-${i+1}`,title:`QA title ${i+1}`,status:'draft',blocks:[{id:'hook',text:`Exact punctuation $ & emoji 👇 ${i+1}.`,role:'hook'},{id:'cta',text:'QA only.',role:'cta'}]}))};
  const source=path.join(base,'source.md'),copy=path.join(base,'parsed.json'),audit=path.join(base,'audit.json');
  fs.writeFileSync(source,'# QA source\r\n\r\n'+parsed.ads.map(ad=>ad.blocks.map(b=>b.text).join('\r\n')).join('\r\n\r\n')+'\r\n');
  fs.writeFileSync(copy,JSON.stringify(parsed,null,2));
  atomic(audit,{version:1,status:'passed',method:'independent-source-word-audit',sourceSha256:hash(fs.readFileSync(source)),parsedSha256:hash(fs.readFileSync(copy)),reviewedAdIds:parsed.ads.map(a=>a.id),reviewedBlockIds:Object.fromEntries(parsed.ads.map(a=>[a.id,a.blocks.map(b=>b.id)])),findings:[]});
  return {base,parsed,options:{...options,source,copy,audit,brand:'QA brand'}};
}
async function campaign(count=7) {const item=fixture(count);item.result=await prepare(item.options);return item;}
function choices(item,edits={}) {
  const lock=read(path.join(item.result.directory,'campaign-lock.json'));
  return {kind:'instagram-ad-campaign-setup',version:1,demo:false,campaign:item.result.campaign,requestId:lock.requestId,copySha256:lock.copySha256,adCount:item.parsed.ads.length,adIds:item.parsed.ads.map(a=>a.id),style:'mix',musicScope:'none',musicAdIds:[],trackSelection:'random-balanced',audio:{startTime:0,volume:.25,fadeInSeconds:8/30,fadeOutSeconds:.5},overrides:[],...edits};
}
function submit(item,value) {const file=path.join(item.base,'choices.json');atomic(file,value);return {...item.options,campaign:item.result.campaign,choices:file};}
const cli=(...args)=>spawnSync(process.execPath,[path.join(pluginRoot,'scripts/cli.mjs'),...args],{encoding:'utf8'});

test('initialization is idempotent and cannot overwrite different roots or overlap installed code',()=>{
  const item=fixture();assert.equal(init(item.options).pluginInstalledByThisCommand,false);
  assert.throws(()=>init({...item.options,timezone:'UTC'}),/different settings/);
  assert.throws(()=>init({stateRoot:path.join(pluginRoot,'state'),dataRoot:path.join(item.base,'other')}),/outside/);
  assert.throws(()=>init({stateRoot:item.base,dataRoot:path.join(item.base,'nested')}),/overlap/);
});
test('owned paths reject traversal and dangling symlinks',()=>{
  const base=temporary();fs.symlinkSync(path.join(base,'missing'),path.join(base,'link'));
  assert.throws(()=>owned(base,'../escape'),/owned root/);assert.throws(()=>owned(base,'link','child'),/symlinks/);
});
test('preparation preserves exact source bytes and separates copy, metadata and compact layout',async()=>{
  const item=await campaign(3),dir=item.result.directory;
  assert.deepEqual(fs.readFileSync(path.join(dir,'Original-Ad-Copy.md')),fs.readFileSync(item.options.source));
  assert.equal(item.result.adCount,3);assert.equal(item.result.productionAvailable,false);
  const copy=read(path.join(dir,'copy.json')),manifest=read(path.join(dir,'manifest.json')),metadata=read(path.join(dir,'source-metadata.json'));
  assert.deepEqual(copy.ads[0].blocks[0],{id:'hook',text:item.parsed.ads[0].blocks[0].text});assert.equal(copy.ads[0].title,undefined);
  assert.equal(metadata.ads[0].status,'draft');assert.equal(manifest.ads[0].blocks[0].styleRole,'hook');
  assert.equal(manifest.layoutMode,'compact');assert.equal(manifest.setup.status,'pending');assert.ok(manifest.ads.every(a=>a.music===false));
  assert.equal(fs.readdirSync(path.join(item.options.dataRoot,'Renders/Ad-Campaigns')).length,0);
  assert.notEqual((await prepare(item.options)).campaign,item.result.campaign);
});
test('audit hashes, all ad IDs and all blocks are required before campaign creation',async()=>{
  for(const mutate of [a=>{a.sourceSha256='wrong';},a=>{a.reviewedAdIds.reverse();},a=>{a.reviewedBlockIds['qa-1']=[];},a=>{a.findings=['omission'];}]) {
    const item=fixture();const audit=read(item.options.audit);mutate(audit);atomic(item.options.audit,audit);
    await assert.rejects(prepare(item.options),/audit|findings/);assert.equal(fs.readdirSync(path.join(item.options.dataRoot,'Campaigns')).length,0);
  }
});
test('Google Docs require snapshot and complete tab records and preserve raw snapshot bytes',async()=>{
  const item=fixture(2),options={...item.options,sourceUrl:'https://docs.google.com/document/d/qa-only/edit'};
  await assert.rejects(prepare(options),/snapshot/);
  options.snapshot=path.join(item.base,'snapshot.json');fs.writeFileSync(options.snapshot,'{"documentId":"qa-only","tabs":[{"tabId":"tab1"}]}\n');
  await assert.rejects(prepare(options),/relevant-tab/);
  const audit=read(options.audit);audit.sourceCompleteness={status:'complete',relevantTabIds:['tab1']};atomic(options.audit,audit);
  const result=await prepare(options);assert.deepEqual(fs.readFileSync(path.join(result.directory,'google-document-snapshot.json')),fs.readFileSync(options.snapshot));
  assert.equal(read(path.join(result.directory,'source-metadata.json')).source.url,options.sourceUrl);
});
test('chat association, demo/stale choices, wrong order and contradictory overrides reject',async()=>{
  const item=await campaign();await assert.rejects(apply({...submit(item,choices(item)),chatId:'different'}),/different chat/);
  for(const edits of [{demo:true},{requestId:'stale'},{copySha256:'changed'},{adIds:choices(item).adIds.reverse()},{overrides:[{id:'qa-1',music:false,track:'hush'}]}])await assert.rejects(apply(submit(item,choices(item,edits))));
  assert.equal(status({...item.options,campaign:item.result.campaign}).setup.status,'pending');
});
test('all four styles, balanced tracks and per-ad silence/overrides resolve without copy mutation',async()=>{
  const item=await campaign(12),before=fs.readFileSync(path.join(item.result.directory,'copy.json'));
  const value=choices(item,{musicScope:'all',musicAdIds:item.parsed.ads.map(a=>a.id),overrides:[{id:'qa-1',music:false,style:'style-4'},{id:'qa-2',music:true,track:'hush',style:'style-3'}]});
  const result=await apply(submit(item,value));assert.equal(new Set(result.selections.map(a=>a.style)).size,4);
  assert.equal(new Set(result.selections.filter(a=>a.music).map(a=>a.music.track)).size,3);
  assert.equal(result.selections[0].music,false);assert.equal(result.selections[0].style,'style-4');assert.equal(result.selections[1].music.track,'hush');
  assert.deepEqual(fs.readFileSync(path.join(item.result.directory,'copy.json')),before);
  const again=await apply(submit(item,value));assert.equal(again.alreadyApplied,true);
  await assert.rejects(apply(submit(item,{...value,style:'style-1'})),/already applied|Conflicting/);
});
test('silent defaults remain silent after applying settings',async()=>{
  const item=await campaign();assert.ok((await apply(submit(item,choices(item)))).selections.every(a=>a.music===false));
  await assert.rejects(form({...item.options,campaign:item.result.campaign}),/pending/);
});
test('archive, audit, copy and metadata edits block subsequent access',async()=>{
  for(const file of ['Original-Ad-Copy.md','source-audit.json','copy.json','source-metadata.json']) {
    const item=await campaign();fs.appendFileSync(path.join(item.result.directory,file),' ');
    assert.throws(()=>status({...item.options,campaign:item.result.campaign}),/changed/);
  }
});
test('explicit form output cannot overwrite input files, existing HTML or installed resources',async()=>{
  const item=await campaign();const options={...item.options,campaign:item.result.campaign};
  await assert.rejects(form({...options,output:item.options.source}),/extension/);
  await assert.rejects(form({...options,output:item.result.form}),/already exists/);
  await assert.rejects(form({...options,output:path.join(pluginRoot,'resources/x.html')}),/installed/);
  const output=path.join(item.base,'new-form.html');assert.equal((await form({...options,output})).form,output);
});
test('generated fragments are escaped, self-contained and syntactically valid',async()=>{
  const item=fixture(1),parsed=read(item.options.copy);parsed.ads[0].title='</script><script>bad()</script>';fs.writeFileSync(item.options.copy,JSON.stringify(parsed));
  const audit=read(item.options.audit);audit.parsedSha256=hash(fs.readFileSync(item.options.copy));atomic(item.options.audit,audit);
  const result=await prepare(item.options),html=fs.readFileSync(result.form,'utf8');
  assert.ok(Buffer.byteLength(html)<1_000_000);assert.ok(!html.includes('"title":"</script>'));assert.ok(!/<!doctype|<(html|head|body)(?:\s|>)/i.test(html));
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html));assert.ok(html.includes('Save campaign settings'));
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];assert.equal(spawnSync(process.execPath,['--check'],{input:script,encoding:'utf8'}).status,0);
});
test('interrupted setup transaction completes idempotently and conflicting journal rejects',async()=>{
  const item=await campaign(),value=choices(item),options=submit(item,value);await apply(options);
  const file=path.join(item.result.directory,'.setup-transaction.json');
  const api=await import('../plugins/instagram-ads/resources/scripts/lib/campaign-setup.mjs');atomic(file,{choicesSha256:api.choicesDigest(value)});
  assert.equal((await apply(options)).alreadyApplied,true);assert.equal(fs.existsSync(file),false);
  atomic(file,{choicesSha256:'conflicting'});await assert.rejects(apply(options),/Conflicting incomplete/);
});
test('locks refuse live-process recovery and recover exited owners',async()=>{
  const base=temporary(),file=path.join(base,'lock');atomic(file,{pid:process.pid});
  await assert.rejects(locked(file,false,()=>{}),/locked/);await assert.rejects(locked(file,true,()=>{}),/live process/);
  const child=spawnSync(process.execPath,['-e','process.stdout.write(String(process.pid))'],{encoding:'utf8'});atomic(file,{pid:Number(child.stdout)});
  assert.equal(await locked(file,true,()=>42),42);assert.equal(fs.existsSync(file),false);
});
test('pinned workflow tampering fails with integrity error',()=>{
  const item=fixture(),release=verifyRelease(path.join(pluginRoot,'resources'));const file=path.join(item.options.stateRoot,'workflows',release.workflowId,release.files[0].path);
  fs.appendFileSync(file,'\n// changed');assert.throws(()=>verifyRelease(path.dirname(path.dirname(path.dirname(file)))),/integrity/);
});
test('a copied plugin operates independently and old campaigns retain their form after newer resources load',()=>{
  const item=fixture(2),copyRoot=path.join(item.base,'isolated-plugin');fs.cpSync(pluginRoot,copyRoot,{recursive:true});
  const run=(...args)=>spawnSync(process.execPath,[path.join(copyRoot,'scripts/cli.mjs'),...args],{encoding:'utf8'});
  const first=run('prepare','--state-root',item.options.stateRoot,'--chat-id','trusted-chat','--copy',item.options.copy,'--source',item.options.source,'--audit',item.options.audit,'--brand','isolated');assert.equal(first.status,0,first.stderr);
  const old=JSON.parse(first.stdout),oldHtml=fs.readFileSync(old.form,'utf8'),resources=path.join(copyRoot,'resources');
  const manifest=read(path.join(resources,'release.json'));const entry=manifest.files.find(e=>e.path.endsWith('form.js'));fs.appendFileSync(path.join(resources,entry.path),'\n// newer workflow');entry.sha256=hash(fs.readFileSync(path.join(resources,entry.path)));manifest.workflowId=hash(JSON.stringify(manifest.files));atomic(path.join(resources,'release.json'),manifest);
  const renewed=run('form','--state-root',item.options.stateRoot,'--campaign',old.campaign,'--chat-id','trusted-chat');assert.equal(renewed.status,0,renewed.stderr);assert.equal(fs.readFileSync(old.form,'utf8'),oldHtml);
  const newer=run('prepare','--state-root',item.options.stateRoot,'--chat-id','trusted-chat','--copy',item.options.copy,'--source',item.options.source,'--audit',item.options.audit,'--brand','isolated');assert.equal(newer.status,0,newer.stderr);assert.notEqual(JSON.parse(newer.stdout).workflowId,old.workflowId);
});
test('compatibility submissions are isolated from campaigns and cannot be applied as production',async()=>{
  const item=fixture(),result=await compatibilityForm(item.options),request=read(path.join(item.options.dataRoot,'Compatibility',result.requestId,'request.json'));
  const value={...request,adIds:request.ads.map(a=>a.id),style:'mix',musicScope:'none',musicAdIds:[],trackSelection:'random-balanced',audio:{startTime:0,volume:.25,fadeInSeconds:8/30,fadeOutSeconds:.5},overrides:[]};
  const file=path.join(item.base,'compatibility.json');atomic(file,value);
  const receipt=await compatibilityAccept({...item.options,choices:file});assert.equal(receipt.renderStarted,false);assert.equal((await compatibilityAccept({...item.options,choices:file})).receivedAt,receipt.receivedAt);
  await assert.rejects(compatibilityAccept({...item.options,choices:file,chatId:'other'}),/different chat/);
  atomic(file,{...value,demo:false});await assert.rejects(compatibilityAccept({...item.options,choices:file}),/compatibility-test/);
  assert.equal(fs.readdirSync(path.join(item.options.dataRoot,'Campaigns')).length,0);
  const real=await campaign();await assert.rejects(apply(submit(real,value)));
});
test('CLI rejects unavailable render/update and unknown arguments',()=>{
  for(const args of [['render'],['update'],['doctor','--unknown','x'],['apply']])assert.equal(cli(...args).status,1);
});
