import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {authError,normalizeEmail,requireSameOrigin} from './owner-auth.mjs';
const SESSION_COOKIE='__Host-la_stazione_owner',NONCE_COOKIE='__Host-la_stazione_nonce';
const SESSION_SECONDS=8*60*60;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function readCookie(request,name) {
  const matches=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  return matches.length===1?matches[0].slice(name.length+1):null;
}
function equal(a,b) {return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
const reply=(body,status=200,cookies=[])=>{const response=new Response(JSON.stringify(body),{status,headers});for(const value of cookies)response.headers.append('Set-Cookie',value);return response;};
export function createGoogleSessions(storeFactory,{clientId=process.env.GOOGLE_CLIENT_ID||'',verifyIdToken,now=()=>Date.now()}={}) {
  const configured=/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const google=new OAuth2Client();
  const verify=verifyIdToken||((credential)=>google.verifyIdToken({idToken:credential,audience:clientId}));
  async function verifyUser(request) {
    const token=readCookie(request,SESSION_COOKIE);
    if(!configured||!token||!/^[a-zA-Z0-9_-]{43}$/.test(token))throw authError('Sign in with Google to open the owner workspace.',401);
    const store=await storeFactory();
    const session=await store.getWithMetadata(`sessions/${hash(token)}`,{type:'json',consistency:'strong'});
    if(!session?.data?.user?.id||session.data.revoked||!Number.isFinite(session.data.expiresAt)||session.data.expiresAt<=now())throw authError('Your sign-in expired. Sign in with Google again.',401);
    return session.data.user;
  }
  async function handleLogin(request,isAllowedEmail) {
    try {
      if(request.method==='GET') {
        if(!configured)return reply({configured:false});
        const nonce=`${now()}.${randomBytes(32).toString('base64url')}`;
        return reply({configured:true,clientId,nonce},200,[cookie(NONCE_COOKIE,nonce,600)]);
      }
      if(!['POST','DELETE'].includes(request.method))return reply({error:'Method not allowed.'},405);
      requireSameOrigin(request);
      if(request.method==='DELETE') {
        const token=readCookie(request,SESSION_COOKIE);
        if(token&&/^[a-zA-Z0-9_-]{43}$/.test(token)) {
          const store=await storeFactory(),key=`sessions/${hash(token)}`;
          const session=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
          if(session)await store.setJSON(key,{...session.data,revoked:true},{onlyIfMatch:session.etag});
        }
        return reply({signedOut:true},200,[cookie(SESSION_COOKIE,'',0),cookie(NONCE_COOKIE,'',0)]);
      }
      if(!configured)throw authError('Google sign-in is being set up. Editing remains locked.',503);
      if(!request.headers.get('content-type')?.startsWith('application/json'))throw authError('Send the Google sign-in response as JSON.',415);
      const body=await request.text();if(body.length>20000)throw authError('This sign-in response is too large.',413);
      let payload;try{payload=JSON.parse(body);}catch{throw authError('The sign-in response could not be read.',400);}
      if(typeof payload.credential!=='string'||payload.credential.length>16000)throw authError('Google did not return a valid sign-in response.',400);
      const nonce=readCookie(request,NONCE_COOKIE);
      const issuedAt=Number(nonce?.split('.')[0]);
      if(!nonce||!/^\d{13}\.[a-zA-Z0-9_-]{43}$/.test(nonce)||issuedAt>now()+30000||now()-issuedAt>600000)throw authError('This sign-in attempt expired. Please try again.',401);
      let claims;
      try {claims=(await verify(payload.credential)).getPayload();}
      catch {throw authError('Google could not verify this sign-in. Please try again.',401);}
      // Signature, audience, issuer and expiration are verified by Google's SDK.
      // Recheck explicit account/nonce requirements before issuing our session.
      if(!claims?.sub||claims.email_verified!==true||claims.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||!Number.isFinite(claims.exp)||claims.exp*1000<=now()||!equal(claims.nonce,nonce))throw authError('This Google sign-in could not be verified. Please try again.',401);
      const user={id:claims.sub,email:normalizeEmail(claims.email),name:typeof claims.name==='string'?claims.name.slice(0,200):claims.email};
      if(!await isAllowedEmail(user.email))throw authError('This Google account does not have access. Ask the owner to add your email.',403);
      const store=await storeFactory();
      const used=await store.setJSON(`used-nonces/${hash(nonce)}`,{usedAt:now()},{onlyIfNew:true});
      if(!used.modified)throw authError('This sign-in response has already been used. Please try again.',401);
      const token=randomBytes(32).toString('base64url');
      await store.setJSON(`sessions/${hash(token)}`,{user,createdAt:now(),expiresAt:now()+SESSION_SECONDS*1000,revoked:false},{onlyIfNew:true});
      return reply({authenticated:true},200,[cookie(SESSION_COOKIE,token,SESSION_SECONDS),cookie(NONCE_COOKIE,'',0)]);
    } catch(error) {
      return reply({error:error.status?error.message:'Sign-in is temporarily unavailable. Please try again.'},error.status||503,[cookie(NONCE_COOKIE,'',0)]);
    }
  }
  return {verifyUser,handleLogin};
}
