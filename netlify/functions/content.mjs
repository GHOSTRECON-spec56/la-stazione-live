import {getStore} from '@netlify/blobs';
import {createContentHandler} from '../../lib/content-api.mjs';
import {ownerAuthorization} from '../../lib/netlify-owner.mjs';
export default createContentHandler(() => getStore({name:'la-stazione-v4',consistency:'strong'}),{authorizeWrite:request=>ownerAuthorization.authorize(request)});
