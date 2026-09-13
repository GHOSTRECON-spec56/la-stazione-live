import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createContentHandler} from '../lib/content-api.mjs';
import {localStore} from './local-store.mjs';
const base=path.resolve(import.meta.dirname,'..'),root=path.join(base,'public');
const storage=localStore(path.join(base,'.local-data'));
const handler=createContentHandler(()=>storage);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(['/.netlify/functions/content','/.netlify/functions/media'].includes(url.pathname)){
      const parts=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>4_100_000){res.writeHead(413);res.end();return;}parts.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
      const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}
    let filename=path.resolve(root,'.'+decoded);
    if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(403);res.end();return;}
    let info=await fs.stat(filename);
    if(info.isDirectory()){
      if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search});res.end();return;}
      filename=path.join(filename,'index.html');
    }
    const bytes=await fs.readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(error.code==='ENOENT'?'Not found':'Local server error');}
}).listen(Number(process.env.PORT||8888),'0.0.0.0',()=>console.log('La Stazione local preview: http://localhost:8888/redesign_v4/ — owner: http://localhost:8888/owner/'));
