import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(await readFile('wrangler.production.json','utf8').catch(()=>{throw new Error('Cloudflare account configuration is missing. Follow CLOUDFLARE-MIGRATION.md.');}));
// Owner requests must reach the canonical-origin redirect before static assets.
config.assets.run_worker_first=[...new Set([...(config.assets.run_worker_first||[]),'/owner','/owner/*'])];
if(!/^[a-f0-9]{32}$/.test(config.account_id||'')||!config.d1_databases?.[0]?.database_id||config.d1_databases[0].database_id.startsWith('00000000')||!config.kv_namespaces?.[0]?.id||config.kv_namespaces[0].id.startsWith('00000000'))throw new Error('Replace the local placeholder IDs with your Cloudflare account, D1 and KV IDs first.');
await writeFile('wrangler.production.json',JSON.stringify(config,null,2)+'\n');
for(const args of [['tools/build-cloudflare.mjs'],['node_modules/wrangler/bin/wrangler.js','deploy','--config','wrangler.production.json']]) {
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
