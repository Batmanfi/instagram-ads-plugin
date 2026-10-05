import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {splitParsedCopy, resolveChoices, assertSetupReady, sha256, generateForm} from "./campaign-setup.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const musicTracks = JSON.parse(fs.readFileSync(path.join(root, "data/music.json"))).tracks;
const fixture = (count = 20) => {
  const parsed = {version: 1, ads: Array.from({length: count}, (_, i) => ({id: `script-${i + 1}`, title: `QA only ${i + 1}`, status: 'draft',
    blocks: [{id: 'hook', text: 'QA only: punctuation, $ & emoji 👇.', role: 'hook'}, {id: 'proof', text: 'Synthetic copy for integration testing.', role: 'proof'}, {id: 'cta', text: 'Test CTA.', role: 'cta'}]}))};
  const split = splitParsedCopy(parsed), copyHash = sha256(JSON.stringify(split.copy));
  const manifest = {version: 1, layoutMode: 'compact', music: false, safeMargins: {top:150,side:90,bottom:280}, defaultContrast:.28,
    setup: {status:'pending',requestId:'test-request',copySha256:copyHash},
    ads: split.layoutAds.map(ad => ({...ad, outputName:ad.id, fontPreset:'condensed-regular',background:{filename:'01-Mount-Rainier-Road-1080x1920.mp4',startTime:0,cropPosition:[50,50]}}))};
  const choices = {kind:'instagram-ad-campaign-setup',version:1,demo:false,campaign:'qa-test',requestId:'test-request',copySha256:copyHash,
    adCount:count,adIds:split.copy.ads.map(ad=>ad.id),style:'mix',musicScope:'selected',musicAdIds:[3,4,8,14].filter(n=>n<=count).map(n=>`script-${n}`),
    trackSelection:'random-balanced',audio:{startTime:0,volume:.25,fadeInSeconds:8/30,fadeOutSeconds:.5},overrides:[]};
  return {parsed, split, manifest, copy:split.copy, copyHash, campaign:'qa-test',choices,musicTracks};
};

test('20 ads resolve to concrete repeatable styles and three music tracks, only on selected IDs', () => {
  const input = fixture(), original = JSON.stringify(input.copy);
  const a = resolveChoices(input).manifest, b = resolveChoices(input).manifest;
  assert.deepEqual(a.ads,b.ads);
  assert.equal(new Set(a.ads.map(ad=>ad.style)).size,4);
  assert.deepEqual(a.ads.filter(ad=>ad.music).map(ad=>ad.id),input.choices.musicAdIds);
  assert.equal(new Set(a.ads.filter(ad=>ad.music).map(ad=>ad.music.track)).size,3);
  assert.equal(a.ads.filter(ad=>ad.music===false).length,16);
  assert.equal(JSON.stringify(input.copy),original);
  assert.equal(a.setup.status,'ready');
  assertSetupReady(a,input.copyHash);
});

test('silent default and per-ad style, music and track overrides are explicit', () => {
  const input=fixture(6); input.choices.musicScope='none'; input.choices.musicAdIds=[]; input.choices.style='style-1';
  assert.ok(resolveChoices(input).manifest.ads.every(ad=>ad.music===false));
  input.choices.overrides=[{id:'script-2',style:'style-4',music:true,track:'hush'}];
  const ads=resolveChoices(input).manifest.ads;
  assert.equal(ads[1].style,'style-4'); assert.equal(ads[1].music.track,'hush');
  assert.equal(ads.filter(ad=>ad.music).length,1);
});

test('all-ad music, opt-out overrides and arbitrary ad counts', () => {
  const input=fixture(7); input.choices.musicScope='all'; input.choices.musicAdIds=[...input.choices.adIds];
  input.choices.overrides=[{id:'script-1',music:false}];
  assert.equal(resolveChoices(input).manifest.ads.filter(ad=>ad.music).length,6);
});

test('reject demo, stale copy/request, wrong ad IDs, invalid audio and contradictory overrides', () => {
  for (const change of [
    c=>{c.demo=true;}, c=>{c.requestId='other';}, c=>{c.copySha256='changed';},
    c=>{c.adIds.reverse();}, c=>{c.musicAdIds.push('unknown');}, c=>{c.style='style-5';},
    c=>{c.audio.volume=0;}, c=>{c.audio.startTime=9999;},
    c=>{c.overrides=[{id:'script-1',music:false,track:'hush'}];},
    c=>{c.overrides=[{id:'script-1',style:'style-8'}];},
    c=>{c.overrides=[{id:'script-1',music:true},{id:'script-1',music:false}];}
  ]) {const input=fixture(); change(input.choices); assert.throws(()=>resolveChoices(input));}
});

test('pending copy cannot render; legacy campaigns are unchanged; duplicate submissions are idempotent', () => {
  const input=fixture(); assert.throws(()=>assertSetupReady(input.manifest,input.copyHash),/pending/);
  assertSetupReady({version:1},'legacy-hash');
  input.manifest=resolveChoices(input).manifest;
  assert.equal(resolveChoices(input).alreadyApplied,true);
  input.choices=Object.fromEntries(Object.entries(input.choices).reverse());
  assert.equal(resolveChoices(input).alreadyApplied,true);
  input.choices.style='style-3'; assert.throws(()=>resolveChoices(input),/already applied/);
  assert.throws(()=>assertSetupReady(input.manifest,'changed'),/changed/);
});

test('source words stay in copy, titles/status and block roles stay outside it', () => {
  const input=fixture(1), split=input.split;
  assert.deepEqual(split.copy.ads[0].blocks[0],{id:'hook',text:input.parsed.ads[0].blocks[0].text});
  assert.equal(split.metadata[0].status,'draft'); assert.equal(split.layoutAds[0].blocks[1].styleRole,'proof');
  assert.equal(split.copy.ads[0].title,undefined);
  assert.throws(()=>splitParsedCopy({version:1,ads:[]}),/contain ads/);
  const duplicate=fixture(2).parsed; duplicate.ads[1].id=duplicate.ads[0].id;
  assert.throws(()=>splitParsedCopy(duplicate),/duplicate ad/);
});

test('generated fragment escapes source metadata and embeds no network calls', () => {
  const directory=fs.mkdtempSync(path.join(root,'work/setup-fragment-test-'));
  try {
    const input=fixture(1), destination=path.join(directory,'campaign-setup.html');
    generateForm(root,{...input.choices,ads:[{id:'script-1',number:1,title:'</script><script>unsafe()</script>'}]},destination);
    const html=fs.readFileSync(destination,'utf8');
    assert.ok(Buffer.byteLength(html)<1_000_000); assert.ok(!html.includes('"title":"</script>'));
    assert.ok(!/<!doctype|<(html|head|body)(?:\s|>)/i.test(html));
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html));
    assert.ok(!html.includes('__FORM_SCRIPT__')); assert.ok(!html.includes('__CAMPAIGN_CONFIG__'));
    const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
    assert.equal(spawnSync(process.execPath,['--check'],{input:script,encoding:'utf8'}).status,0);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('CLI archives bytes, chooses unique slugs, prepares a variable-count form and applies choices', () => {
  const directory=fs.mkdtempSync(path.join(root,'work/setup-cli-test-'));
  try {
    for (const file of ['scripts/campaign-setup.mjs','scripts/lib/campaign-setup.mjs','scripts/lib/music.mjs',
      'tools/campaign-setup/form.template.html','tools/campaign-setup/form.js','data/backgrounds.json','data/music.json']) {
      fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true}); fs.copyFileSync(path.join(root,file),path.join(directory,file));
    }
    const source=path.join(directory,'new-copy.md'), parsed=path.join(directory,'parsed.json');
    fs.writeFileSync(source,'# QA-only source\n\nExact $ & emoji 👇.\n');
    fs.writeFileSync(parsed,JSON.stringify(fixture(7).parsed));
    const call=(...args)=>spawnSync(process.execPath,[path.join(directory,'scripts/campaign-setup.mjs'),...args],{encoding:'utf8'});
    const first=call('prepare','--copy',parsed,'--source',source,'--brand','QA brand');
    assert.equal(first.status,0,first.stderr); const result=JSON.parse(first.stdout);
    assert.equal(result.adCount,7); assert.deepEqual(fs.readFileSync(path.join(result.directory,'Original-Ad-Copy.md')),fs.readFileSync(source));
    assert.ok(fs.readFileSync(result.form,'utf8').includes('script-7'));
    const second=call('prepare','--copy',parsed,'--source',source,'--brand','QA brand');
    assert.equal(second.status,0,second.stderr); assert.notEqual(JSON.parse(second.stdout).campaign,result.campaign);
    const manifest=JSON.parse(fs.readFileSync(path.join(result.directory,'manifest.json'))), copy=JSON.parse(fs.readFileSync(path.join(result.directory,'copy.json')));
    const choices={...fixture(7).choices,campaign:result.campaign,requestId:manifest.setup.requestId,copySha256:manifest.setup.copySha256,adIds:copy.ads.map(ad=>ad.id)};
    const chosen=path.join(directory,'choices.json'); fs.writeFileSync(chosen,JSON.stringify(choices));
    const applied=call('apply','--campaign',result.campaign,'--choices',chosen);
    assert.equal(applied.status,0,applied.stderr); assert.equal(JSON.parse(applied.stdout).status,'ready');
    assert.equal(JSON.parse(call('apply','--campaign',result.campaign,'--choices',chosen).stdout).alreadyApplied,true);
    assert.equal(call('form','--campaign',result.campaign).status,1);
    const snapshot=path.join(directory,'google-snapshot.json');
    fs.writeFileSync(snapshot,JSON.stringify({documentId:'qa-fixture-only',tabs:[{text:'Exact $ & emoji 👇.'}]}));
    const google=call('prepare','--copy',parsed,'--source',source,'--brand','QA Google Doc','--source-url','https://docs.google.com/document/d/qa-fixture-only/edit','--snapshot',snapshot);
    assert.equal(google.status,0,google.stderr);
    const googleDir=JSON.parse(google.stdout).directory;
    assert.deepEqual(fs.readFileSync(path.join(googleDir,'google-document-snapshot.json')),fs.readFileSync(snapshot));
    assert.equal(JSON.parse(fs.readFileSync(path.join(googleDir,'source-metadata.json'))).source.kind,'google-doc');
    assert.equal(call('prepare','--copy',parsed,'--source',source,'--brand','QA Google Doc','--source-url','https://docs.google.com/document/d/qa-fixture-only/edit').status,1);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
