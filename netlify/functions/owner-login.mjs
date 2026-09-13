import {googleSessions,ownerAuthorization} from '../../lib/netlify-owner.mjs';
export default request=>googleSessions.handleLogin(request,email=>ownerAuthorization.isAllowedEmail(email));
