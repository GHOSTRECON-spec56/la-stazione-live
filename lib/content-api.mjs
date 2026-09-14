import seed from '../public/site-content/default.json' with {type:'json'};
import {createHash, randomUUID} from 'node:crypto';
import {requireSameOrigin} from './owner-auth.mjs';

const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply = (value,status=200) => new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
const list = (value,path) => {if(!Array.isArray(value)) fail(`${path} must be a list.`); return value;};
const str = (value,path,max=4000,required=false) => {if(typeof value!=='string'||value.length>max||(required&&!value.trim())) fail(`${path} must be ${required?'nonempty ':''}text under ${max} characters.`);return value;};
const id = (value,path) => {str(value,path,100,true);if(!/^[a-zA-Z0-9_-]+$/.test(value))fail(`${path} contains invalid characters.`);return value;};
const identifiers = (values,path) => {const ids=new Set();for(const value of list(values,path)){id(value?.id,`${path} ID`);if(ids.has(value.id))fail(`${path} has duplicate IDs.`);ids.add(value.id);}return ids;};
const price = (value,path) => {if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12))fail(`${path} must be a positive amount, zero, or blank.`);};
export function validateContent(value) {
  if(value?.schemaVersion!==1||!value.menu||!value.photos)fail('This is not a La Stazione content file.');
  const m=value.menu;
  str(m.title,'Menu title',300,true);str(m.intro,'Menu introduction',4000);
  const groups=identifiers(m.groups,'Menu groups'),categories=identifiers(m.categories,'Categories');
  identifiers(m.items,'Menu items');identifiers(m.extras,'Extra groups');
  for(const group of m.groups)str(group.label,'Group name',300,true);
  for(const category of m.categories){str(category.label,'Category name',300,true);if(!groups.has(category.groupId))fail('A category refers to a missing menu group.');}
  for(const item of m.items){
    if(!categories.has(item.categoryId))fail('An item refers to a missing category.');
    str(item.name,'Item name',500,true);str(item.details,'Description',20000);
    for(const option of list(item.options,'Item options'))str(option,'Option',2000);
    if(typeof item.available!=='boolean'||typeof item.featured!=='boolean')fail('Item availability and featured values must be true or false.');
    for(const p of list(item.prices,'Prices')){if(!p||typeof p!=='object')fail('Every price must have a label and currency amounts.');str(p.label,'Price label',300);price(p.usd,'USD price');price(p.lbp,'LBP price');}
  }
  for(const extra of m.extras){
    str(extra.label,'Extra group name',300,true);
    if(extra.groupIds!==undefined||extra.categoryIds!==undefined) {
      const groupIds=list(extra.groupIds,'Extra categories'),categoryIds=list(extra.categoryIds,'Extra subcategories');
      if(!groupIds.length&&!categoryIds.length)fail('Choose at least one category or subcategory for each extras section.');
      for(const [targets,known] of [[groupIds,groups],[categoryIds,categories]]) {
        if(new Set(targets).size!==targets.length)fail('Extras contain duplicate assignments.');
        if(targets.some(target=>!known.has(target)))fail('Extras refer to a missing category or subcategory.');
      }
    } else if(!groups.has(extra.groupId))fail('Extras refer to a missing menu group.');
    identifiers(extra.items,'Extras');for(const item of extra.items){str(item.name,'Extra name',500,true);price(item.usd,'Extra USD price');price(item.lbp,'Extra LBP price');}
  }
  for(const kind of ['hero','moments']){identifiers(value.photos[kind],`${kind} photos`);for(const photo of value.photos[kind]){
    str(photo.url,'Photo URL',4000,true);str(photo.alt,'Photo description',2000);str(photo.caption,'Photo caption',2000);
    if(!/^\/(?!\/)[^\s\\]*$/.test(photo.url)&&!/^https:\/\/[^\s]+$/.test(photo.url))fail('Photo addresses must be HTTPS links or local image paths.');
    if(photo.url.startsWith('https:')){let url;try{url=new URL(photo.url);}catch{fail('Invalid photo URL.');}if(url.username||url.password)fail('Photo links cannot contain credentials.');}
  }}
  return value;
}

function checkWrite(request) {
  requireSameOrigin(request);
}
export function createContentHandler(storeFactory, {authorizeWrite=async()=>{fail('Sign in with Google to edit the website.',401);}}={}) {
  return async request => {
    try {
      const url=new URL(request.url),mediaId=url.searchParams.get('id');
      const store=await storeFactory();
      if(url.pathname.endsWith('/media')) {
        if(request.method==='GET') {
          if(!mediaId||!/^[a-f0-9]{64}$/.test(mediaId))return reply({error:'Photo not found.'},404);
          const entry=await store.getWithMetadata(`photos/${mediaId}`,{type:'arrayBuffer',consistency:'strong'});
          if(!entry)return reply({error:'Photo not found.'},404);
          return new Response(entry.data,{headers:{'Content-Type':entry.metadata.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
        }
        if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
        checkWrite(request);
        await authorizeWrite(request);
        if(Number(request.headers.get('content-length'))>4_000_000)fail('Please use a photo smaller than 4 MB.',413);
        const bytes=new Uint8Array(await request.arrayBuffer());
        if(!bytes.length||bytes.length>4_000_000)fail('Please use a photo smaller than 4 MB.',413);
        const signature=Buffer.from(bytes.subarray(0,16));
        const type=signature.subarray(0,4).toString()==='RIFF'&&signature.subarray(8,12).toString()==='WEBP'?'image/webp':signature[0]===255&&signature[1]===216&&signature[2]===255?'image/jpeg':signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
        if(!type)fail('Choose a JPEG, PNG or WebP image.');
        const photoId=createHash('sha256').update(bytes).digest('hex');
        await store.set(`photos/${photoId}`,bytes,{metadata:{type,createdAt:new Date().toISOString()},onlyIfNew:true});
        return reply({id:photoId,url:`/api/media?id=${photoId}`},201);
      }
      if(request.method==='GET'){
        const entry=await store.getWithMetadata('content',{type:'json',consistency:'strong'});
        return reply({content:entry?.data||seed,etag:entry?.etag||'seed-v4',storage:'connected'});
      }
      if(request.method!=='PUT')return reply({error:'Method not allowed.'},405);
      checkWrite(request);
      await authorizeWrite(request);
      if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Publish JSON content.',415);
      const body=await request.text();if(body.length>3_000_000)fail('This content file is too large. Export a backup and contact the website maintainer.',413);
      let payload;try{payload=JSON.parse(body);}catch{fail('The content file could not be read.');}
      const content=validateContent(payload.content);
      if(typeof payload.etag!=='string'||!payload.etag)fail('Reload the published version before saving.',428);
      content.updatedAt=new Date().toISOString();content.revision=randomUUID();
      const existing=await store.getWithMetadata('content',{type:'json',consistency:'strong'});
      if((existing?.etag||'seed-v4')!==payload.etag)fail('The published menu changed on another device. Your draft is safe. Export it, then reload the published version before publishing again.',409);
      // Preserve a server-side recovery copy before replacing any published content.
      if(existing)await store.setJSON(`history/${Date.now()}-${randomUUID()}`,existing.data);
      const result=await store.setJSON('content',content,payload.etag==='seed-v4'?{onlyIfNew:true}:{onlyIfMatch:payload.etag});
      if(!result.modified)fail('Another edit was published at the same time. Your draft is safe; reload the published version.',409);
      return reply({content,etag:result.etag,storage:'connected'});
    } catch(error) {
      if(error.status)return reply({error:error.message},error.status);
      console.error('La Stazione content storage:',error.name,error.message);
      return reply({error:'Shared storage is temporarily unavailable. Your draft has not been published. Please try again.'},503);
    }
  };
}
