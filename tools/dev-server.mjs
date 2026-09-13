import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createContentHandler} from '../lib/content-api.mjs';
import {localStore} from './local-store.mjs';
import {createOwnerAuthorization} from '../lib/owner-auth.mjs';
import {createGoogleSessions} from '../lib/google-session.mjs';
const base=path.resolve(import.meta.dirname,'..'),root=path.join(base,'public');
const storage=localStore(path.join(base,'.local-data'));
const authStorage=localStore(path.join(base,'.local-access'));
const googleSessions=createGoogleSessions(()=>authStorage);
const ownerAuthorization=createOwnerAuthorization(()=>authStorage,googleSessions.verifyUser);
const handler=createContentHandler(()=>storage,{authorizeWrite:request=>ownerAuthorization.authorize(request)});
const config=await fs.readFile(path.join(base,'netlify.toml'),'utf8');
const redirects=config.split('[[redirects]]').slice(1).map(block=>({
  from:/^\s*from\s*=\s*"([^"]+)"/m.exec(block)?.[1],
  to:/^\s*to\s*=\s*"([^"]+)"/m.exec(block)?.[1],
  status:Number(/^\s*status\s*=\s*(\d+)/m.exec(block)?.[1]||301)
})).filter(rule=>rule.from&&rule.to);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host}`);
    const redirect=redirects.find(rule=>rule.from.endsWith('*')?url.pathname.startsWith(rule.from.slice(0,-1)):url.pathname===rule.from);
    if(redirect){const splat=redirect.from.endsWith('*')?url.pathname.slice(redirect.from.length-1):'';res.writeHead(redirect.status,{Location:redirect.to.replace(':splat',splat)+url.search});res.end();return;}
    if(['/.netlify/functions/content','/.netlify/functions/media','/.netlify/functions/owner-session','/.netlify/functions/owner-access','/.netlify/functions/owner-login'].includes(url.pathname)){
      const parts=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>4_100_000){res.writeHead(413);res.end();return;}parts.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
      const response=await (url.pathname.endsWith('/owner-login')?googleSessions.handleLogin(request,email=>ownerAuthorization.isAllowedEmail(email)):url.pathname.endsWith('/owner-session')?ownerAuthorization.handleSession(request):url.pathname.endsWith('/owner-access')?ownerAuthorization.handleAccess(request):handler(request));
      const responseHeaders=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie();if(cookies.length)responseHeaders['set-cookie']=cookies;
      res.writeHead(response.status,responseHeaders);res.end(Buffer.from(await response.arrayBuffer()));return;
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
}).listen(Number(process.env.PORT||8888),'0.0.0.0',()=>console.log('La Stazione local preview: http://localhost:8888/ — owner: http://localhost:8888/owner/ (Google sign-in required)'));
