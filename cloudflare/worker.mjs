import {createContentHandler} from '../lib/content-api.mjs';
import {createGoogleSessions} from '../lib/google-session.mjs';
import {createOwnerAuthorization} from '../lib/owner-auth.mjs';
import {createCloudflareStore,cleanExpiredRecords} from './store.mjs';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const pathname=url.pathname;
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
