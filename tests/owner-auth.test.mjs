import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerAuthorization,OWNER_EMAIL,authError} from '../lib/owner-auth.mjs';
import {createContentHandler} from '../lib/content-api.mjs';
import seed from '../public/site-content/default.json' with {type:'json'};

const origin='https://lastazionelb.com';
const request=(endpoint,method='GET',body,headers={})=>new Request(`${origin}/.netlify/functions/${endpoint}`,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body&&method!=='GET'?{body:JSON.stringify(body)}:{})});
function memoryStore(){
  const entries=new Map();let revision=0;
  return {entries,async getWithMetadata(key){return entries.has(key)?structuredClone(entries.get(key)):null;},
    async setJSON(key,data,options={}){const before=entries.get(key);if(options.onlyIfNew&&before||options.onlyIfMatch&&before?.etag!==options.onlyIfMatch)return {modified:false};const etag=`r${++revision}`;entries.set(key,{data:structuredClone(data),etag});return {modified:true,etag};}};
}
const signedRequest=(endpoint,method,body,email=OWNER_EMAIL)=>request(endpoint,method,body,{Authorization:`Bearer ${email}`});
const verifyFixture=async req=>{const token=req.headers.get('authorization')?.replace('Bearer ','');if(!token)throw authError('Sign in.',401);return {email:token,id:token,name:token};};

test('Only the primary owner can grant access; allowlisted editors cannot grant or remove users',async()=>{
  const store=memoryStore(),auth=createOwnerAuthorization(()=>store,verifyFixture);
  assert.equal((await auth.handleSession(signedRequest('owner-session','GET',null,'outsider@example.com'))).status,403);
  let state=await(await auth.handleAccess(signedRequest('owner-access'))).json();assert.equal(state.ownerEmail,OWNER_EMAIL);assert.equal(state.editors.length,0);
  let response=await auth.handleAccess(signedRequest('owner-access','POST',{email:' Editor@Example.com ',etag:state.etag}));assert.equal(response.status,200);state=await response.json();assert.equal(state.editors[0].email,'editor@example.com');
  assert.equal((await auth.authorize(signedRequest('content','GET',null,'editor@example.com'))).role,'editor');
  for(const method of ['GET','POST','DELETE'])assert.equal((await auth.handleAccess(signedRequest('owner-access',method,{email:'outsider@example.com',etag:state.etag},'editor@example.com'))).status,403);
  assert.equal((await auth.handleAccess(signedRequest('owner-access','DELETE',{email:OWNER_EMAIL,etag:state.etag}))).status,400);
  response=await auth.handleAccess(signedRequest('owner-access','DELETE',{email:'editor@example.com',etag:state.etag}));assert.equal(response.status,200);
  await assert.rejects(auth.authorize(signedRequest('content','PUT',null,'editor@example.com')),e=>e.status===403);
  assert.equal(await auth.isAllowedEmail('editor@example.com'),false);assert.equal(await auth.isAllowedEmail(OWNER_EMAIL),true);
});
test('Access list writes enforce same-origin, JSON, email validation and concurrency protection',async()=>{
  const auth=createOwnerAuthorization(()=>memory,verifyFixture),memory=memoryStore();
  const payload={email:'editor@example.com',etag:'access-v1'};
  assert.equal((await auth.handleAccess(request('owner-access','POST',payload,{Authorization:`Bearer ${OWNER_EMAIL}`,Origin:'https://evil.example'}))).status,403);
  assert.equal((await auth.handleAccess(new Request(`${origin}/.netlify/functions/owner-access`,{method:'POST',headers:{Authorization:`Bearer ${OWNER_EMAIL}`},body:JSON.stringify(payload)}))).status,403);
  assert.equal((await auth.handleAccess(signedRequest('owner-access','POST',{...payload,email:'bad @example.com'}))).status,400);
  const concurrent=await Promise.all([auth.handleAccess(signedRequest('owner-access','POST',payload)),auth.handleAccess(signedRequest('owner-access','POST',{...payload,email:'second@example.com'}))]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
});
test('Content and upload writes fail closed by default; public menu reads remain available',async()=>{
  const store=memoryStore(),handle=createContentHandler(()=>store);
  assert.equal((await handle(request('content'))).status,200);
  assert.equal((await handle(request('content','PUT',{content:structuredClone(seed),etag:'seed-v4'}))).status,401);
  assert.equal((await handle(new Request(`${origin}/.netlify/functions/media`,{method:'POST',headers:{Origin:origin},body:'anything'}))).status,401);
  assert.equal(store.entries.size,0);
});
test('Revocation blocks an existing editor session from publishing or uploading through real content guards',async()=>{
  const access=memoryStore(),content=memoryStore(),auth=createOwnerAuthorization(()=>access,verifyFixture);
  const granted=await(await auth.handleAccess(signedRequest('owner-access','POST',{email:'editor@example.com',etag:'access-v1'}))).json();
  const handle=createContentHandler(()=>content,{authorizeWrite:req=>auth.authorize(req)});
  const payload={content:structuredClone(seed),etag:'seed-v4'};
  const saved=await handle(signedRequest('content','PUT',payload,'editor@example.com'));assert.equal(saved.status,200);
  await auth.handleAccess(signedRequest('owner-access','DELETE',{email:'editor@example.com',etag:granted.etag}));
  assert.equal((await handle(signedRequest('content','PUT',payload,'editor@example.com'))).status,403);
  assert.equal((await handle(new Request(`${origin}/.netlify/functions/media`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer editor@example.com'},body:'anything'}))).status,403);
  const withoutOrigin=new Request(`${origin}/.netlify/functions/content`,{method:'PUT',headers:{Authorization:`Bearer ${OWNER_EMAIL}`},body:JSON.stringify(payload)});
  assert.equal((await handle(withoutOrigin)).status,403);
});
