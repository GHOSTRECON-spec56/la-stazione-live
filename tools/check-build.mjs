import {access} from 'node:fs/promises';
import {validateContent} from '../lib/content-api.mjs';
import seed from '../public/site-content/default.json' with {type:'json'};
import {build} from 'esbuild';
await build({entryPoints:['public/owner/auth.js'],outfile:'public/owner/auth.bundle.js',bundle:true,format:'esm',platform:'browser',target:['safari15','chrome100'],minify:true,legalComments:'eof'});
validateContent(seed);
await Promise.all(['public/index.html','public/assets/site/style.css','public/assets/site/brand-colors.css','public/assets/site/app.js','public/assets/site/carousel.js','public/menu/index.html','public/owner/index.html','netlify/functions/content.mjs','netlify/functions/media.mjs'].map(file=>access(file)));
console.log('La Stazione static pages and shared-content functions are ready for Netlify bundling.');
