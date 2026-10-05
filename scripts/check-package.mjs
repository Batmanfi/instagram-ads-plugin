import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {verifyRelease} from '../plugins/instagram-ads/lib/storage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plugin=path.join(root,'plugins/instagram-ads');
const manifest=JSON.parse(fs.readFileSync(path.join(plugin,'plugin.json')));
assert.equal(manifest.name,'instagram-ads');assert.equal(manifest.version,'0.3.0-alpha.1');
assert.equal(manifest.$schema,'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
const release=verifyRelease(path.join(plugin,'resources'));
assert.equal(release.pluginVersion,manifest.version);
assert.equal(release.capabilities.render,true);
let count=0;
function walk(directory) {for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
  assert(!entry.isSymbolicLink(),'Package must not contain symlinks');
  const file=path.join(directory,entry.name);if(entry.isDirectory()){walk(file);continue;}
  const bytes=fs.readFileSync(file);count++;
  assert(!bytes.toString().includes('/Users/kanishqbansal'),'Personal path in installed plugin');
  assert(!/\.(mp4|mp3|zip|ttf)$/i.test(file),'Alpha package must not ship unapproved assets');
  if(file.endsWith('.mjs')||file.endsWith('.js')) {
    const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
  }
}}
walk(plugin);
for(let n=1;n<=4;n++)assert.deepEqual(fs.readFileSync(path.join(plugin,`resources/data/styles/style-${n}/definition.json`)),fs.readFileSync(path.join(root,`engine/data/styles/style-${n}/definition.json`)));
console.log(JSON.stringify({status:'passed',packageFiles:count,workflowId:release.workflowId,checks:['portable paths','JavaScript syntax','workflow hashes','four exact style definitions','no bundled media/fonts','explicit alpha capabilities']},null,2));
