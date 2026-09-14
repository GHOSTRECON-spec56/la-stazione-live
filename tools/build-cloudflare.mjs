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
const config=await readFile('netlify.toml','utf8');
const redirects=config.split('[[redirects]]').slice(1).map(block=>{
  const from=/^\s*from\s*=\s*"([^"]+)"/m.exec(block)?.[1];
  const to=/^\s*to\s*=\s*"([^"]+)"/m.exec(block)?.[1];
  return `${from} ${to} 301`;
});
await writeFile(path.join(destination,'_redirects'),redirects.join('\n')+'\n');
const headerBlock=config.split('[[headers]]')[1].split('# Keep')[0];
const headers=[...headerBlock.matchAll(/^\s+([\w-]+) = "(.*)"$/gm)]
  .filter(([,name])=>name!=='for').map(([,name,value])=>`  ${name}: ${value}`);
await writeFile(path.join(destination,'_headers'),`/owner/*\n${headers.join('\n')}\n/site-content/default.json\n  Cache-Control: no-cache\n`);
// Use host-neutral routes in Cloudflare output; source remains deployable on Netlify for rollback.
for(const item of ['site-content/content.js','owner/auth.bundle.js']) {
  const filename=path.join(destination,item);
  await writeFile(filename,(await readFile(filename,'utf8')).replaceAll('/.netlify/functions/','/api/'));
}
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
