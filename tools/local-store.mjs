import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function localStore(directory) {
  let queue=Promise.resolve();
  const filename=key=>path.join(directory,createHash('sha256').update(key).digest('hex')+'.json');
  const read=async key=>{try{return JSON.parse(await fs.readFile(filename(key),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
  const write=(key,data,options={})=>{
    const next=queue.then(async()=>{
      const previous=await read(key);
      if(options.onlyIfNew&&previous || options.onlyIfMatch&&previous?.etag!==options.onlyIfMatch)return {modified:false};
      const bytes=typeof data==='string'?Buffer.from(data):Buffer.from(data);
      const entry={key,etag:`"${createHash('sha256').update(bytes).digest('hex')}"`,metadata:options.metadata||{},base64:bytes.toString('base64')};
      await fs.mkdir(directory,{recursive:true});
      const target=filename(key),temp=target+'.'+randomUUID()+'.tmp';
      await fs.writeFile(temp,JSON.stringify(entry));await fs.rename(temp,target);
      return {modified:true,etag:entry.etag};
    });queue=next.catch(()=>{});return next;
  };
  return {
    async getWithMetadata(key,{type='text'}={}){const entry=await read(key);if(!entry)return null;const bytes=Buffer.from(entry.base64,'base64');return {etag:entry.etag,metadata:entry.metadata,data:type==='json'?JSON.parse(bytes.toString()):type==='arrayBuffer'?bytes:bytes.toString()};},
    set:write,setJSON:(key,data,options)=>write(key,JSON.stringify(data),options)
  };
}
