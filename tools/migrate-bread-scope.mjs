import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {prepareJSONWrite} from '../cloudflare/store.mjs';
import {validateContent} from '../lib/content-api.mjs';

// One-time, explicitly requested assignment change; CAS preserves concurrent edits.
if(!process.argv.includes('--apply'))throw new Error('Use --apply to assign the live bread extras to Sandwiches.');
const endpoint='https://lastazionelb.com/api/content';
const response=await fetch(endpoint,{cache:'no-store'});
assert.equal(response.status,200);
const before=await response.json(),content=structuredClone(before.content);
assert.equal(typeof before.etag,'string');
const bread=content.menu.extras.find(section=>section.id==='bread-extras');
assert.ok(bread,'Bread extras must exist.');
assert.ok(content.menu.categories.some(category=>category.id==='food-sandwiches'),'Sandwiches must exist.');
if(bread.groupIds?.length===0&&bread.categoryIds?.length===1&&bread.categoryIds[0]==='food-sandwiches') {
  console.log('Bread extras are already assigned only to Sandwiches.');
  process.exit(0);
}
bread.groupIds=[];bread.categoryIds=['food-sandwiches'];delete bread.groupId;
validateContent(content);
const directory=path.resolve('.migration-backups','bread-scope-'+Date.now());
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,'before.json'),JSON.stringify(before,null,2));
await writeFile(path.join(directory,'after.json'),JSON.stringify(content,null,2));
const history=prepareJSONWrite('content',`history/${Date.now()}-${randomUUID()}`,before.content,{onlyIfNew:true});
const update=prepareJSONWrite('content','content',content,{onlyIfMatch:before.etag});
const quote=value=>value===null?'NULL':typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`;
const sql=[...history.statements,...update.statements].map(({sql,values})=>{
  let i=0;return sql.replace(/\?/g,()=>quote(values[i++]))+';';
}).join('\n');
const filename=path.join(directory,'change.sql');
await writeFile(filename,sql);
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--remote','--config','wrangler.production.json','--file',filename],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const after=await(await fetch(endpoint,{cache:'no-store'})).json();
assert.equal(after.etag,update.etag,'The live menu changed concurrently; do not overwrite it.');
assert.deepEqual(after.content,content,'The live result must match the single intended scope change.');
console.log('Verified: bread applies only to Sandwiches; all other live content is unchanged. Backup: '+directory);
