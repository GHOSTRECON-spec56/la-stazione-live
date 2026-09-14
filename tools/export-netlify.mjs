import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateContent} from '../lib/content-api.mjs';
import {prepareJSONWrite} from '../cloudflare/store.mjs';

const origin='https://lastazionelb.com';
const directory=path.resolve('.migration-backups',new Date().toISOString().replaceAll(':','-'));
await mkdir(path.join(directory,'photos'),{recursive:true});
const response=await fetch(origin+'/.netlify/functions/content',{cache:'no-store'});
if(!response.ok)throw new Error(`Cannot export the live menu: HTTP ${response.status}`);
const snapshot=await response.json();
validateContent(snapshot.content);
if(!snapshot.etag||snapshot.storage!=='connected')throw new Error('Live storage did not return a verified snapshot.');
await writeFile(path.join(directory,'content.json'),JSON.stringify(snapshot,null,2)+'\n');
const manifest={exportedAt:new Date().toISOString(),origin,sourceEtag:snapshot.etag,
  sha256:createHash('sha256').update(JSON.stringify(snapshot.content)).digest('hex'),photos:[]};
const ids=new Set();
for(const photo of [...snapshot.content.photos.hero,...snapshot.content.photos.moments]) {
  const url=new URL(photo.url,origin);
  if(url.origin===origin&&/^\/(?:api|\.netlify\/functions)\/media$/.test(url.pathname)) {
    const id=url.searchParams.get('id');
    if(!/^[a-f0-9]{64}$/.test(id))throw new Error('An uploaded photo has an invalid address.');
    ids.add(id);
  }
}
for(const id of ids) {
  const image=await fetch(origin+'/.netlify/functions/media?id='+id);
  if(!image.ok)throw new Error(`Photo ${id} could not be exported.`);
  const bytes=Buffer.from(await image.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==id)throw new Error('Photo hash verification failed.');
  const type=image.headers.get('content-type').split(';')[0];
  await writeFile(path.join(directory,'photos',id),bytes);
  manifest.photos.push({id,type,bytes:bytes.length});
}
// A second read detects editing during the export. Do not import a mixed snapshot.
const check=await fetch(origin+'/.netlify/functions/content',{cache:'no-store'});
if(!check.ok||(await check.json()).etag!==snapshot.etag)throw new Error('Live content changed during export. Repeat the export before cutover.');
await writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const {statements}=prepareJSONWrite('content','content',snapshot.content,{onlyIfNew:true},Date.now(),8000);
const literal=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
const sql=statements.map(({sql,values})=>{let i=0;return sql.replace('INSERT INTO chunks','INSERT OR IGNORE INTO chunks').replaceAll('?',()=>literal(values[i++]))+';';}).join('\n');
await writeFile(path.join(directory,'import.sql'),sql+'\n');
// This is the public fallback menu, never a private access/session export.
await writeFile('public/site-content/default.json',JSON.stringify(snapshot.content,null,2)+'\n');
await writeFile('.migration-backups/latest.json',JSON.stringify({directory},null,2)+'\n');
console.log(`Verified export: ${snapshot.content.menu.items.length} menu items, ${manifest.photos.length} uploaded photos.\nBackup: ${directory}`);
