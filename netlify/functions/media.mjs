import {getStore} from '@netlify/blobs';
import {createContentHandler} from '../../lib/content-api.mjs';
export default createContentHandler(() => getStore({name:'la-stazione-v4',consistency:'strong'}));
