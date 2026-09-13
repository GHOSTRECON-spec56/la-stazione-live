import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSessions} from '../lib/google-session.mjs';
import {createOwnerAuthorization,OWNER_EMAIL} from '../lib/owner-auth.mjs';
const origin='https://lastazionelb.com',clientId='test.apps.googleusercontent.com';
const fixed=Date.now();
function store(){const entries=new Map();let revision=0;return {entries,async getWithMetadata(key){return entries.get(key)||null;},async setJSON(key,data,options={}){const old=entries.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};const etag=`${++revision}`;entries.set(key,{data:structuredClone(data),etag});return {modified:true,etag};}};}
const req=(method='GET',body,headers={})=>new Request(origin+'/.netlify/functions/owner-login',{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const cookieFrom=(r,name)=>r.headers.getSetCookie().find(x=>x.startsWith(name+'=')).split(';')[0];
function fixture(options={}){const memory=store();let claims,clock=fixed;const auth=createGoogleSessions(()=>memory,{clientId,now:()=>clock,verifyIdToken:async()=>{if(options.invalidSignature)throw Error('signature');return {getPayload:()=>claims};},...options});return {auth,memory,setClock:value=>{clock=value;},async config(overrides={}){const response=await auth.handleLogin(req(),()=>true);const config=await response.json();claims={sub:'google-account-123',email:OWNER_EMAIL,email_verified:true,name:'Owner',aud:clientId,iss:'https://accounts.google.com',exp:Math.floor(fixed/1000)+3600,nonce:config.nonce,...overrides};return {config,cookie:cookieFrom(response,'__Host-la_stazione_nonce')};}};}

test('Without a configured Google client, login remains locked and never accepts client identity fields',async()=>{
  const auth=createGoogleSessions(()=>store(),{clientId:''});assert.deepEqual(await(await auth.handleLogin(req(),()=>true)).json(),{configured:false});
  assert.equal((await auth.handleLogin(req('POST',{email:OWNER_EMAIL,credential:'fake'}),()=>true)).status,503);
  await assert.rejects(auth.verifyUser(req()),e=>e.status===401);
});
test('Google sign-in creates an opaque Secure HttpOnly host cookie and a verified account session',async()=>{
  const f=fixture(),setup=await f.config();const response=await f.auth.handleLogin(req('POST',{credential:'verified-by-google-sdk'},{Cookie:setup.cookie}),()=>true);assert.equal(response.status,200);
  const header=response.headers.getSetCookie().find(x=>x.startsWith('__Host-la_stazione_owner='));for(const flag of ['Secure','HttpOnly','SameSite=Lax','Path=/','Max-Age=28800'])assert.ok(header.includes(flag));
  assert.ok(!header.includes(OWNER_EMAIL));assert.ok(!header.includes('verified-by-google-sdk'));
  const user=await f.auth.verifyUser(req('GET',null,{Cookie:header.split(';')[0]}));assert.equal(user.id,'google-account-123');assert.equal(user.email,OWNER_EMAIL);
});
test('Forged signatures, wrong audience/issuer, expired or unverified Google tokens and wrong nonces are rejected',async()=>{
  for(const override of [{aud:'attacker.apps.googleusercontent.com'},{iss:'https://attacker.example'},{exp:1},{email_verified:false},{sub:''},{nonce:'wrong'}]){const f=fixture(),setup=await f.config(override);assert.equal((await f.auth.handleLogin(req('POST',{credential:'bad'},{Cookie:setup.cookie}),()=>true)).status,401);}
  const f=fixture({invalidSignature:true}),setup=await f.config();assert.equal((await f.auth.handleLogin(req('POST',{credential:'unsigned.payload.fake'},{Cookie:setup.cookie}),()=>true)).status,401);
});
test('Unapproved Google emails cannot create sessions',async()=>{
  const f=fixture(),setup=await f.config({email:'outsider@gmail.com'});const response=await f.auth.handleLogin(req('POST',{credential:'valid-google-token'},{Cookie:setup.cookie}),email=>email===OWNER_EMAIL);assert.equal(response.status,403);assert.equal(f.memory.entries.size,0);
});
test('Sign-in and logout require same origin; nonce is required, ten-minute limited and single use',async()=>{
  const f=fixture(),setup=await f.config();const body={credential:'google-token'};
  assert.equal((await f.auth.handleLogin(req('POST',body,{Cookie:setup.cookie,Origin:'https://attacker.example'}),()=>true)).status,403);
  assert.equal((await f.auth.handleLogin(req('POST',body),()=>true)).status,401);
  assert.equal((await f.auth.handleLogin(req('POST',body,{Cookie:setup.cookie}),()=>true)).status,200);
  assert.equal((await f.auth.handleLogin(req('POST',body,{Cookie:setup.cookie}),()=>true)).status,401);
  const old=fixture(),oldSetup=await old.config();old.setClock(fixed+600001);assert.equal((await old.auth.handleLogin(req('POST',body,{Cookie:oldSetup.cookie}),()=>true)).status,401);
  assert.equal((await f.auth.handleLogin(req('DELETE',null,{Origin:'https://attacker.example'}),()=>true)).status,403);
});
test('Server sessions expire after eight hours and logout invalidates a captured cookie',async()=>{
  const f=fixture(),setup=await f.config();const login=await f.auth.handleLogin(req('POST',{credential:'google-token'},{Cookie:setup.cookie}),()=>true);const cookie=cookieFrom(login,'__Host-la_stazione_owner');
  const logout=await f.auth.handleLogin(req('DELETE',null,{Cookie:cookie}),()=>true);assert.equal(logout.status,200);await assert.rejects(f.auth.verifyUser(req('GET',null,{Cookie:cookie})),e=>e.status===401);
  const next=fixture(),nextSetup=await next.config();const logged=await next.auth.handleLogin(req('POST',{credential:'google-token'},{Cookie:nextSetup.cookie}),()=>true);next.setClock(fixed+8*60*60*1000);await assert.rejects(next.auth.verifyUser(req('GET',null,{Cookie:cookieFrom(logged,'__Host-la_stazione_owner')})),e=>e.status===401);
});
test('Actual session authorization rechecks editor revocation on every request',async()=>{
  const f=fixture(),setup=await f.config({email:'editor@gmail.com'});const access=store();await access.setJSON('owner-access-v1',{editors:[{email:'editor@gmail.com'}]});const auth=createOwnerAuthorization(()=>access,f.auth.verifyUser);
  const login=await f.auth.handleLogin(req('POST',{credential:'google-token'},{Cookie:setup.cookie}),email=>auth.isAllowedEmail(email));const cookie=cookieFrom(login,'__Host-la_stazione_owner');assert.equal((await auth.authorize(req('GET',null,{Cookie:cookie}))).role,'editor');
  await access.setJSON('owner-access-v1',{editors:[]});await assert.rejects(auth.authorize(req('GET',null,{Cookie:cookie})),e=>e.status===403);
});
