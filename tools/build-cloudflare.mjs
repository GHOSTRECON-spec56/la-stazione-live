import {cp,mkdir,readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import './check-build.mjs';

const destination=path.resolve('.cloudflare/public');
const generatedRoot=path.resolve('.cloudflare');
if(path.dirname(destination)!==generatedRoot||path.basename(destination)!=='public')throw new Error('Invalid generated asset directory.');
await mkdir(destination,{recursive:true});
// Only final-version assets enter the deployment. The design archive stays in Git.
const included=['index.html','brand-logo.jpg','favicon.svg','assets/site','gallery','menu','owner','site-content'];
const expected=new Set(['_headers','_redirects']);
async function inventory(item) {
  const info=await stat(path.join('public',item));
  if(info.isDirectory())for(const name of await readdir(path.join('public',item)))await inventory(path.join(item,name));
  else expected.add(item.replaceAll(path.sep,'/'));
}
for(const item of included)await inventory(item);
// Remove only stale generated files, keeping directories open by Windows watchers.
async function prune(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())await prune(filename);
    else if(!expected.has(path.relative(destination,filename).replaceAll(path.sep,'/')))await rm(filename);
  }
}
await prune(destination);
for(const item of included)await cp(path.join('public',item),path.join(destination,item),{recursive:true});
for(const name of ['_headers','_redirects'])await cp(path.join('cloudflare',name),path.join(destination,name));
let count=0,total=0;
async function check(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())await check(filename);
    else {const {size}=await stat(filename);if(size>25*1024*1024)throw new Error(`Cloudflare asset exceeds 25 MiB: ${filename}`);count++;total+=size;}
  }
}
await check(destination);
if(count>20000)throw new Error('Too many static assets for Workers Free.');
console.log(`Cloudflare: ${count} static assets, ${(total/1e6).toFixed(2)} MB. Final V6 design preserved.`);
