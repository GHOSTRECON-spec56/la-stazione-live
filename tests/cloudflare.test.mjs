import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createCloudflareStore,cleanExpiredRecords,prepareJSONWrite} from '../cloudflare/store.mjs';
import {createGoogleIdTokenVerifier} from '../lib/google-verifier.mjs';
import {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet} from 'jose';
import worker from '../cloudflare/worker.mjs';

test('Owner links use the registered Google origin while public pages and local previews stay on their host',async()=>{
  const assets={ASSETS:{fetch:async()=>new Response('asset')}};
  for(const host of ['www.lastazionelb.com','la-stazione.la-stazione-site.workers.dev']) {
    for(const path of ['/owner','/owner/','/owner/index.html?from=bookmark']) {
      const response=await worker.fetch(new Request(`https://${host}${path}`),assets);
      assert.equal(response.status,302);
      assert.equal(response.headers.get('location'),'https://lastazionelb.com'+path);
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
    assert.equal(await(await worker.fetch(new Request(`https://${host}/menu/`),assets)).text(),'asset');
  }
  for(const url of ['https://lastazionelb.com/owner/','http://localhost:8787/owner/']) {
    assert.equal(await(await worker.fetch(new Request(url),assets)).text(),'asset');
  }
});

let mf,env;
const origin='https://lastazionelb.test',clientId='cloudflare-test.apps.googleusercontent.com';
before(async()=>{
  const bundled=await build({entryPoints:['cloudflare/worker.mjs'],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',external:['node:*'],logLevel:'silent'});
  mf=new Miniflare(convertV4MiniflareOptions({name:'test',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],kvNamespaces:['PHOTOS'],bindings:{GOOGLE_CLIENT_ID:clientId}}));
  env={DB:await mf.getD1Database('DB'),PHOTOS:await mf.getKVNamespace('PHOTOS')};
  const schema=await readFile('cloudflare/migrations/0001_storage.sql','utf8');
  await env.DB.batch(schema.split(';').filter(s=>s.trim()).map(sql=>env.DB.prepare(sql)));
});
after(async()=>{await mf?.dispose();});
const store=namespace=>createCloudflareStore(env,namespace);
const request=(path,method='GET',body,cookie)=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('Published menu export provides category tables and CSV without accepting writes',async()=>{
  const response=await request('/api/menu-export');assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.tables.find(table=>table.id==='items').rows.length,103);
  const csv=await request('/api/menu-export?format=csv&table=extras');assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(await csv.text(),/Food \/ Sandwiches/);
  assert.equal((await request('/api/menu-export?format=csv&table=unknown')).status,404);
  assert.equal((await request('/api/menu-export','POST',{})).status,405);
  assert.equal(await(await request('/api/menu-export','HEAD')).text(),'');
});
async function session(email) {
  const token=randomBytes(32).toString('base64url');
  await store('access').setJSON('sessions/'+createHash('sha256').update(token).digest('hex'),{user:{id:email,email,name:'Test'},expiresAt:Date.now()+60000,createdAt:Date.now(),revoked:false});
  return '__Host-la_stazione_owner='+token;
}

test('D1 preserves large Unicode records and permits exactly one competing publication',async()=>{
  const content=store('large');
  const value={details:'a'.repeat(299986)+'☕🙂'.repeat(300_000)};
  const first=await content.setJSON('content',value,{onlyIfNew:true});
  assert.equal(first.modified,true);
  assert.deepEqual((await content.getWithMetadata('content')).data,value);
  const [one,two]=await Promise.all([
    content.setJSON('content',{winner:'one'},{onlyIfMatch:first.etag}),
    content.setJSON('content',{winner:'two'},{onlyIfMatch:first.etag})
  ]);
  assert.equal([one,two].filter(r=>r.modified).length,1);
  assert.deepEqual((await content.getWithMetadata('content')).data,{winner:one.modified?'one':'two'});
  const chunks=await env.DB.prepare("SELECT count(*) AS total FROM chunks WHERE namespace='large'").first();
  assert.equal(chunks.total,1,'Failed CAS creates no orphan chunks; replaced chunks are removed');
  assert.equal((await content.setJSON('missing',{bad:true},{onlyIfMatch:first.etag})).modified,false);
  assert.equal(await content.getWithMetadata('missing'),null);
});

test('D1 batch rolls back a pointer update if a following chunk operation fails',async()=>{
  const s=store('rollback');await s.setJSON('content',{safe:true});
  await assert.rejects(env.DB.batch([
    env.DB.prepare("UPDATE records SET etag='broken' WHERE namespace='rollback'"),
    env.DB.prepare("INSERT INTO chunks(namespace,key,etag,part,data) VALUES('nonexistent','content','broken',0,'{}')")
  ]));
  assert.deepEqual((await s.getWithMetadata('content')).data,{safe:true});
});

test('Replaying the exact initial import safely resumes chunks without replacing published content',async()=>{
  const {statements}=prepareJSONWrite('import','content',{initial:true},{onlyIfNew:true},Date.now(),8000);
  const execute=()=>env.DB.batch(statements.map(({sql,values})=>env.DB.prepare(sql.replace('INSERT INTO chunks','INSERT OR IGNORE INTO chunks')).bind(...values)));
  await execute();await execute();
  assert.deepEqual((await store('import').getWithMetadata('content')).data,{initial:true});
  await store('import').setJSON('content',{publishedLater:true});
  await execute();
  assert.deepEqual((await store('import').getWithMetadata('content')).data,{publishedLater:true});
});

test('Worker serves the public menu, rejects unsigned edits and accepts owner publication with CAS',async()=>{
  const first=await request('/api/content');assert.equal(first.status,200);
  const baseline=await first.json();assert.equal(baseline.content.menu.items.length,103);
  assert.equal((await request('/api/content','PUT',{content:baseline.content,etag:baseline.etag})).status,401);
  assert.equal((await request('/api/owner-session')).status,401);
  const owner=await session('lastazione10@gmail.com');
  const saved=await request('/api/content','PUT',{content:baseline.content,etag:baseline.etag},owner);
  assert.equal(saved.status,200,await saved.clone().text());
  const published=await saved.json();
  assert.deepEqual((await(await request('/.netlify/functions/content')).json()).content,published.content);
  assert.equal((await request('/api/content','PUT',{content:baseline.content,etag:baseline.etag},owner)).status,409);
  const csrf=await mf.dispatchFetch(origin+'/api/content',{method:'PUT',headers:{Origin:'https://attacker.test',Cookie:owner},body:'{}'});
  assert.equal(csrf.status,403);
});

test('Owner can grant and revoke editors; uploaded KV photos remain available through old URLs',async()=>{
  const owner=await session('lastazione10@gmail.com'),editor=await session('editor@gmail.com');
  const access=await(await request('/api/owner-access','GET',undefined,owner)).json();
  const grant=await request('/api/owner-access','POST',{email:'editor@gmail.com',etag:access.etag},owner);
  assert.equal(grant.status,200);
  assert.equal((await request('/api/owner-session','GET',undefined,editor)).status,200);
  assert.equal((await request('/api/owner-access','GET',undefined,editor)).status,403);
  const bytes=Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
  const upload=await mf.dispatchFetch(origin+'/api/media',{method:'POST',headers:{Origin:origin,Cookie:editor,'Content-Type':'image/png'},body:bytes});
  assert.equal(upload.status,201,await upload.clone().text());
  const {url}=await upload.json();
  const image=await mf.dispatchFetch(origin+url);assert.equal(image.status,200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
  assert.match(image.headers.get('cache-control'),/immutable/);
  assert.equal((await request('/api/owner-access','DELETE',{email:'editor@gmail.com',etag:(await grant.json()).etag},owner)).status,200);
  assert.equal((await request('/api/owner-session','GET',undefined,editor)).status,403);
  assert.equal((await mf.dispatchFetch(origin+'/api/media',{method:'POST',headers:{Origin:origin,Cookie:editor},body:bytes})).status,403);
});

test('Expired sessions and history are cleaned without removing current content, access or photos',async()=>{
  const s=store('cleanup');
  await s.setJSON('sessions/expired',{expiresAt:Date.now()-1});
  await s.setJSON('owner-access-v1',{editors:[]});
  await s.setJSON('content',{keep:true});
  await s.setJSON('history/old',{recover:true});
  await env.DB.prepare("UPDATE records SET expires_at=1 WHERE namespace='cleanup' AND key='history/old'").run();
  assert.equal(await s.getWithMetadata('sessions/expired'),null);
  await cleanExpiredRecords(env);
  assert.deepEqual((await s.getWithMetadata('content')).data,{keep:true});
  assert.ok(await s.getWithMetadata('owner-access-v1'));
  assert.equal(await s.getWithMetadata('history/old'),null);
  assert.equal((await env.DB.prepare("SELECT count(*) AS total FROM chunks WHERE namespace='cleanup'").first()).total,2);
});

test('The portable Google verifier validates cryptographic signatures and token audience',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='test-google-key';
  const verify=createGoogleIdTokenVerifier(clientId,createLocalJWKSet({keys:[jwk]}));
  const sign=aud=>new SignJWT({email:'lastazione10@gmail.com',email_verified:true,nonce:'nonce'})
    .setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject('owner').setIssuer('https://accounts.google.com')
    .setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const token=await sign(clientId);assert.equal((await verify(token)).getPayload().email,'lastazione10@gmail.com');
  await assert.rejects(verify(await sign('wrong-client')));
  const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({email:'attacker@gmail.com'})).toString('base64url');
  await assert.rejects(verify(parts.join('.')));
});
