import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugins/instagram-ads');
const resources = path.join(plugin, 'resources');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const version=JSON.parse(fs.readFileSync(path.join(plugin,'plugin.json'))).version;
const files = ['scripts/lib/campaign-setup.mjs', 'scripts/lib/music.mjs', 'data/backgrounds.json',
  'data/music.json', 'data/layout/defaults.json', 'tools/campaign-setup/form.template.html', 'tools/campaign-setup/form.js',
  ...[1,2,3,4].map(n => `data/styles/style-${n}/definition.json`)];
fs.mkdirSync(resources, {recursive:true});
for (const name of files) {
  const target = path.join(resources, name);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  let bytes = fs.readFileSync(path.join(root, 'engine', name));
  if (name === 'data/music.json') {
    const value = JSON.parse(bytes);
    value.tracks = value.tracks.map(({originalPath, ...track}) => track);
    bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  }
  if (name === 'tools/campaign-setup/form.template.html') {
    bytes=Buffer.from(bytes.toString().replace('Review settings before rendering this campaign.','Review settings before starting this campaign.'));
  }
  if (name === 'tools/campaign-setup/form.js') {
    let script = bytes.toString();
    script = script.replace('version: 1, demo: false, campaign: config.campaign', "version: 1, demo: config.demo === true, action: config.productionAvailable === true && !config.demo ? 'start-production' : 'save-settings', campaign: config.campaign");
    script = script.replace("title: 'Start rendering this ad campaign',", "title: config.demo ? 'Send compatibility result' : config.productionAvailable ? 'Start production' : 'Save these campaign settings',");
    const start = script.indexOf("        prompt: 'Start production of the already archived campaign");
    const end = script.indexOf('JSON.stringify(payload(), null, 2)', start);
    if (start < 0 || end < 0) throw Error('Source form submission marker changed; review before rebuilding');
    script = script.slice(0,start) + "        prompt: (config.demo ? 'Record the Instagram Ads plugin native form compatibility result below with compatibility-accept. This is a synthetic UI test and does not authorize rendering.' : config.productionAvailable ? 'Start production of this archived campaign with the installed prepare-instagram-ads workflow. Save the complete submitted JSON, validate trusted chat association/source/request/order/choices, invoke start, inspect representative frames and motion, record actual QA, continue remaining ads and complete verified delivery. Preserve exact copy and per-ad choices.' : 'Validate and archive these settings with apply. This settings-only form does not authorize rendering.') + '\\n\\n' + " + script.slice(end);
    script = script.replace("  q('#ad-total').textContent", "  q('#ad-form-submit').firstChild.textContent = config.demo ? 'Send compatibility result' : config.productionAvailable ? 'Start production' : 'Save campaign settings';\n  q('#ad-total').textContent");
    script=script.replace("'No rendering until you start production'","(config.productionAvailable ? 'No rendering until you start production' : 'Settings only — configure the engine before preparing a production campaign')").replace('Open this form in its Codex chat to start production.','Open this form in its Codex chat to submit these settings.').replace('Choices handed to the production chat.','Settings submitted to this chat.');
    bytes = Buffer.from(script);
  }
  fs.writeFileSync(target, bytes);
}
for(const name of ['storage.mjs','job-runtime.mjs','job-worker.mjs','delivery.py']) {
  const relative=`execution/${name}`;files.push(relative);fs.mkdirSync(path.join(resources,'execution'),{recursive:true});
  fs.copyFileSync(path.join(plugin,'lib',name),path.join(resources,relative));
}
function snapshot(directory,prefix='') {for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
  if(entry.name==='resources')continue;const relative=path.join(prefix,entry.name),source=path.join(directory,entry.name);
  if(entry.isDirectory())snapshot(source,relative);else {const target=`distribution/${relative}`;files.push(target);fs.mkdirSync(path.dirname(path.join(resources,target)),{recursive:true});fs.copyFileSync(source,path.join(resources,target));}
}}
snapshot(plugin);
const entries = files.map(name => ({path:name, sha256:hash(fs.readFileSync(path.join(resources,name)))}));
const workflowId = hash(JSON.stringify(entries));
const manifest = {version:1, pluginVersion:version, workflowId, engineBaseline:'Remotion 4.0.506',
  capabilities:{prepare:true, form:true, apply:true, compatibility:true, render:true, delivery:true, updater:true}, files:entries};
fs.writeFileSync(path.join(resources,'release.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({plugin,workflowId,files:entries.length,capabilities:manifest.capabilities},null,2));
