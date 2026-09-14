import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createContentHandler,validateContent} from '../lib/content-api.mjs';
import {localStore} from '../tools/local-store.mjs';
import seed from '../public/site-content/default.json' with {type:'json'};
const clone=()=>structuredClone(seed);
test('Extras support multiple whole categories and subcategories, with legacy compatibility and reference validation',()=>{
  const data=clone(),extra=data.menu.extras[0];
  extra.groupIds=['coffee','tea'];extra.categoryIds=['food-sandwiches','food-salads'];delete extra.groupId;
  assert.doesNotThrow(()=>validateContent(data));
  for(const invalid of [
    {groupIds:[],categoryIds:[]},
    {groupIds:['missing'],categoryIds:[]},
    {groupIds:[],categoryIds:['missing']},
    {groupIds:['coffee','coffee'],categoryIds:[]},
    {groupIds:[],categoryIds:['food-sandwiches','food-sandwiches']},
    {groupIds:'coffee',categoryIds:[]}
  ])assert.throws(()=>validateContent({...data,menu:{...data.menu,extras:[{...extra,...invalid}]}}));
  delete extra.groupIds;delete extra.categoryIds;extra.groupId='coffee';
  assert.doesNotThrow(()=>validateContent(data));
});
const req=(method,body,headers={})=>new Request('http://localhost/.netlify/functions/content',{method,headers:{'Content-Type':'application/json',Origin:'http://localhost',...headers},...(body?{body:JSON.stringify(body)}:{})});
test('Original prices and all menu items are preserved',()=>{assert.equal(seed.menu.items.length,103);assert.equal(seed.menu.items.reduce((n,i)=>n+i.prices.length,0),168);validateContent(clone());});
test('Invalid references, duplicate IDs, unsafe image links and negative prices are rejected',()=>{
  for(const change of [v=>v.menu.items[0].categoryId='missing',v=>v.menu.items[1].id=v.menu.items[0].id,v=>v.photos.hero[0].url='javascript:alert(1)',v=>v.menu.items[0].prices[0].usd=-1]){const v=clone();change(v);assert.throws(()=>validateContent(v));}
});
test('Empty galleries and fully new menu groups are supported',()=>{const v=clone();v.photos.hero=[];v.photos.moments=[];v.menu.groups.push({id:'seasonal',label:'Seasonal'});v.menu.categories.push({id:'winter',label:'Winter',groupId:'seasonal'});v.menu.items.push({...v.menu.items[0],id:'new',categoryId:'winter'});validateContent(v);});
test('Persistent publishing, concurrent write conflict, CSRF and upload validation',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stazione-content-'));const store=localStore(dir);const handle=createContentHandler(()=>store,{authorizeWrite:async()=>({email:'owner@example.com'})});
  try {
    const initial=await (await handle(req('GET'))).json();assert.equal(initial.etag,'seed-v4');
    const edited=clone();edited.menu.items[0].prices[0].usd=4.25;
    const saved=await handle(req('PUT',{content:edited,etag:initial.etag}));assert.equal(saved.status,200);const published=await saved.json();
    const other=createContentHandler(()=>localStore(dir),{authorizeWrite:async()=>({email:'owner@example.com'})});const read=await(await other(req('GET'))).json();assert.equal(read.content.menu.items[0].prices[0].usd,4.25);
    assert.equal((await handle(req('PUT',{content:edited,etag:initial.etag}))).status,409);
    assert.equal((await handle(req('PUT',{content:edited,etag:published.etag},{Origin:'https://evil.example'}))).status,403);
    const races=await Promise.all([handle(req('PUT',{content:clone(),etag:published.etag})),handle(req('PUT',{content:clone(),etag:published.etag}))]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
    const invalid=await handle(new Request('http://localhost/.netlify/functions/media',{method:'POST',headers:{Origin:'http://localhost'},body:'<svg onload="alert(1)"></svg>'}));assert.equal(invalid.status,400);
    const bytes=await fs.readFile(new URL('../public/assets/site/photos/logo-160.webp',import.meta.url));
    const upload=await handle(new Request('http://localhost/.netlify/functions/media',{method:'POST',headers:{Origin:'http://localhost'},body:bytes}));assert.equal(upload.status,201);const photo=await upload.json();
    const downloaded=await handle(new Request('http://localhost'+photo.url));assert.equal(downloaded.headers.get('Content-Type'),'image/webp');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
