import {createContentHandler} from '../lib/content-api.mjs';
import {createGoogleSessions} from '../lib/google-session.mjs';
import {createOwnerAuthorization} from '../lib/owner-auth.mjs';
import {createCloudflareStore,cleanExpiredRecords} from './store.mjs';
import {menuTables,tableCSV} from '../lib/menu-tables.mjs';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const pathname=url.pathname;
    if(pathname==='/api/menu-export') {
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      const response=await createContentHandler(()=>createCloudflareStore(env,'content'))(new Request(url.origin+'/api/content'));
      if(!response.ok)return response;
      const data=await response.json(),tables=menuTables(data.content);
      const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      if(url.searchParams.get('format')==='csv') {
        const table=tables.find(table=>table.id===(url.searchParams.get('table')||'items'));
        if(!table)return new Response('Unknown menu table',{status:404});
        return new Response(request.method==='HEAD'?null:tableCSV(table),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});
      }
      if(request.method==='HEAD')return new Response(null,{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
      return Response.json({title:data.content.menu.title,intro:data.content.menu.intro,source:url.origin+'/menu/',etag:data.etag,tables},{headers});
    }
    // Google sign-in always starts on the registered production origin.
    if((pathname==='/owner'||pathname.startsWith('/owner/'))&&
       ['www.lastazionelb.com','la-stazione.la-stazione-site.workers.dev'].includes(url.hostname)) {
      return new Response(null,{status:302,headers:{Location:'https://lastazionelb.com'+pathname+url.search,'Cache-Control':'no-store'}});
    }
    // Keep existing clients and saved uploaded-photo URLs working across cutover.
    const route=/^\/(?:api|\.netlify\/functions)\/(content|media|owner-login|owner-session|owner-access)$/.exec(pathname)?.[1];
    if(!route)return env.ASSETS.fetch(request);
    const accessStore=()=>createCloudflareStore(env,'access');
    const google=createGoogleSessions(accessStore,{clientId:env.GOOGLE_CLIENT_ID||''});
    const auth=createOwnerAuthorization(accessStore,google.verifyUser);
    let response;
    if(route==='owner-login')response=await google.handleLogin(request,email=>auth.isAllowedEmail(email));
    else if(route==='owner-session')response=await auth.handleSession(request);
    else if(route==='owner-access')response=await auth.handleAccess(request);
    else response=await createContentHandler(()=>createCloudflareStore(env,'content'),{
      authorizeWrite:r=>auth.authorize(r)
    })(request);
    response.headers.set('X-Frame-Options','DENY');
    response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    return response;
  },
  async scheduled(_controller,env) {
    await cleanExpiredRecords(env);
  }
};
