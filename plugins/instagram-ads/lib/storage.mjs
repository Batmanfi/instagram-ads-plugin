import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const hash = data => crypto.createHash('sha256').update(data).digest('hex');
export const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
export const assert = (condition, message) => {if (!condition) throw Error(message);};
export const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
export function canonical(file) {
  let base=path.resolve(file); const parts=[];
  while (!fs.existsSync(base)) {parts.unshift(path.basename(base));const next=path.dirname(base);assert(next!==base,'Cannot resolve path');base=next;}
  return path.join(fs.realpathSync(base),...parts);
}
export function owned(root, ...parts) {
  const target=path.resolve(root,...parts);
  assert(inside(root,target) && target!==root,'Path must remain below its owned root');
  let current=root;
  for(const part of path.relative(root,target).split(path.sep)) {
    current=path.join(current,part);
    try {assert(!fs.lstatSync(current).isSymbolicLink(),'Owned paths cannot contain symlinks');} catch(error) {if(error.code!=='ENOENT')throw error;}
  }
  return target;
}
export function atomic(file,value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=path.join(path.dirname(file),`.${path.basename(file)}-${crypto.randomUUID()}.tmp`);
  const fd=fs.openSync(temporary,'wx',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  try {fs.renameSync(temporary,file);} finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  const directoryFd=fs.openSync(path.dirname(file),'r');
  try {fs.fsyncSync(directoryFd);}catch(error){if(!['EINVAL','ENOTSUP'].includes(error.code))throw error;}finally{fs.closeSync(directoryFd);}
}
export function verifyRelease(directory) {
  const release=read(path.join(directory,'release.json'));
  assert(release.version===1 && /^[a-f0-9]{64}$/.test(release.workflowId) && Array.isArray(release.files)&&release.files.length>0,'Invalid workflow release');
  const seen=new Set();
  for(const entry of release.files) {
    assert(typeof entry.path==='string' && !path.isAbsolute(entry.path) && !entry.path.split(/[\\/]/).includes('..') && !seen.has(entry.path),'Invalid release path');
    seen.add(entry.path);
    const file=owned(directory,entry.path);
    assert(hash(fs.readFileSync(file))===entry.sha256,`Workflow integrity failure: ${entry.path}`);
  }
  assert(hash(JSON.stringify(release.files))===release.workflowId,'Workflow digest mismatch');
  return release;
}
export async function locked(file,recover,fn) {
  if(fs.existsSync(file) && recover) {
    const owner=read(file); assert(Number.isInteger(owner.pid) && owner.pid>0,'Invalid lock owner');
    let alive=true;
    try {process.kill(owner.pid,0);} catch(error) {if(error.code==='ESRCH')alive=false;else throw error;}
    assert(!alive,'Lock belongs to a live process; cannot recover');fs.unlinkSync(file);
  }
  let fd;
  try {fd=fs.openSync(file,'wx',0o600);} catch(error) {if(error.code==='EEXIST')throw Error('Campaign is locked; inspect owner and use --recover-lock only after its process exits');throw error;}
  try {fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token:crypto.randomUUID(),createdAt:new Date().toISOString()}));fs.fsyncSync(fd);return await fn();}
  finally {fs.closeSync(fd);fs.unlinkSync(file);}
}
