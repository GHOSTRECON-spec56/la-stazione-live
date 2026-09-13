import {getStore} from '@netlify/blobs';
import {createOwnerAuthorization} from './owner-auth.mjs';
import {createGoogleSessions} from './google-session.mjs';
const accessStore=()=>getStore({name:'la-stazione-access',consistency:'strong'});
export const googleSessions=createGoogleSessions(accessStore);
export const ownerAuthorization = createOwnerAuthorization(
  accessStore,googleSessions.verifyUser
);
