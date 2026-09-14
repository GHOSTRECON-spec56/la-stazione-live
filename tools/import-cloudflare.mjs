import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const remote=process.argv.includes('--remote');
const {directory}=JSON.parse(await readFile('.migration-backups/latest.json','utf8'));
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
const config=remote?'wrangler.production.json':'wrangler.jsonc';
if(remote) {
  const value=JSON.parse(await readFile(config,'utf8'));
  if(!value.account_id||value.d1_databases[0].database_id.startsWith('00000000'))throw new Error('Configure your own free Cloudflare account first. See CLOUDFLARE-MIGRATION.md.');
  if(Date.now()-Date.parse(manifest.exportedAt)>24*60*60*1000)throw new Error('This snapshot is over 24 hours old. Export the live site again before migrating.');
}
const location=remote?'--remote':'--local';
function wrangler(args) {
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config',config],{stdio:'inherit'});
  if(result.status!==0)throw new Error(`Cloudflare command failed (${result.status}). Import stopped.`);
}
// Photos first; the destination content record is only inserted if it is absent.
for(const photo of manifest.photos)wrangler(['kv','key','put',`photos/${photo.id}`,'--binding','PHOTOS',location,
  '--path',path.join(directory,'photos',photo.id),'--metadata',JSON.stringify({type:photo.type,createdAt:manifest.exportedAt})]);
wrangler(['d1','execute','DB',location,'--file',path.join(directory,'import.sql')]);
console.log('Import commands completed. Existing destination content is never overwritten. Verify /api/content against the exported snapshot before switching DNS.');
