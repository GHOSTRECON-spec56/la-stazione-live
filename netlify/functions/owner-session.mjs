import {ownerAuthorization} from '../../lib/netlify-owner.mjs';
export default request => ownerAuthorization.handleSession(request);
