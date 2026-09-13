export const OWNER_EMAIL = 'lastazione10@gmail.com';
const ACCESS_KEY = 'owner-access-v1';
const INITIAL_ETAG = 'access-v1';
const HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Authorization'};
export const authError = (message, status=403) => Object.assign(new Error(message), {status});
const reply = (body, status=200) => new Response(JSON.stringify(body), {status, headers:HEADERS});
export function requireSameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw authError('Open the owner workspace on this website and try again.', 403);
  }
}
export function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())) throw authError('Enter a valid email address.', 400);
  return value.trim().toLowerCase();
}
export function createOwnerAuthorization(storeFactory, verifyUser) {
  async function access() {
    const store = await storeFactory();
    const entry = await store.getWithMetadata(ACCESS_KEY, {type:'json', consistency:'strong'});
    if (entry && (!Array.isArray(entry.data?.editors) || !entry.etag)) throw authError('Access settings could not be read. Please try again.', 503);
    return {store, editors:entry?.data.editors || [], etag:entry?.etag || INITIAL_ETAG};
  }
  async function authorize(request, ownerOnly=false) {
    const user = await verifyUser(request);
    if (user.email === OWNER_EMAIL) return {...user, role:'owner'};
    if (ownerOnly) throw authError('Only the primary owner can manage access.', 403);
    const {editors} = await access();
    if (!editors.some(entry => entry.email === user.email)) throw authError('This Google account does not have access. Ask the owner to add your email.', 403);
    return {...user, role:'editor'};
  }
  async function isAllowedEmail(value) {
    let email;
    try {email=normalizeEmail(value);} catch {return false;}
    if (email === OWNER_EMAIL) return true;
    return (await access()).editors.some(entry=>entry.email===email);
  }
  async function handleSession(request) {
    if (request.method !== 'GET') return reply({error:'Method not allowed.'}, 405);
    try {
      const user = await authorize(request);
      return reply({authenticated:true, authorized:true, user:{email:user.email,name:user.name,role:user.role},canManageAccess:user.role==='owner'});
    } catch(error) {return reply({authenticated:false,authorized:false,error:error.status ? error.message : 'Access could not be verified. Please try again.'}, error.status || 503);}
  }
  async function handleAccess(request) {
    try {
      if (!['GET','POST','DELETE'].includes(request.method)) return reply({error:'Method not allowed.'},405);
      if (request.method !== 'GET') requireSameOrigin(request);
      await authorize(request, true);
      const current = await access();
      if (request.method === 'GET') return reply({ownerEmail:OWNER_EMAIL,editors:current.editors,etag:current.etag});
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw authError('Send access changes as JSON.',415);
      const text = await request.text();
      if (text.length > 2000) throw authError('This access change is too large.',413);
      let payload;
      try {payload=JSON.parse(text);} catch {throw authError('This access change could not be read.',400);}
      const email = normalizeEmail(payload.email);
      if (email === OWNER_EMAIL) throw authError('The primary owner always has access and cannot be removed.',400);
      if (!payload.etag) throw authError('Reload the access list before changing it.',428);
      if (payload.etag !== current.etag) throw authError('The access list changed on another device. Reload it and try again.',409);
      let editors = current.editors.filter(entry => entry.email !== email);
      if (request.method === 'POST') {
        if (current.editors.some(entry => entry.email === email)) throw authError('This email already has access.',409);
        editors.push({email,grantedAt:new Date().toISOString(),grantedBy:OWNER_EMAIL});
      }
      editors.sort((a,b)=>a.email.localeCompare(b.email));
      const saved=await current.store.setJSON(ACCESS_KEY,{editors},current.etag===INITIAL_ETAG?{onlyIfNew:true}:{onlyIfMatch:current.etag});
      if (!saved.modified) throw authError('The access list changed on another device. Reload it and try again.',409);
      return reply({ownerEmail:OWNER_EMAIL,editors,etag:saved.etag});
    } catch(error) {return reply({error:error.status ? error.message : 'Access settings are temporarily unavailable. Please try again.'},error.status||503);}
  }
  return {authorize, handleSession, handleAccess, isAllowedEmail};
}
