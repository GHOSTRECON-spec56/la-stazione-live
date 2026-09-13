import {access} from 'node:fs/promises';
import {validateContent} from '../lib/content-api.mjs';
import seed from '../public/site-content/default.json' with {type:'json'};
validateContent(seed);
await Promise.all(['public/index.html','public/redesign_v4/index.html','public/menu/index.html','public/owner/index.html','netlify/functions/content.mjs','netlify/functions/media.mjs'].map(file=>access(file)));
console.log('La Stazione static pages and shared-content functions are ready for Netlify bundling.');
