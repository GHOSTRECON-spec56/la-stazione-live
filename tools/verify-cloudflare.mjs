import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const origin=new URL(process.argv[2]||'http://localhost:8787').origin;
const {directory}=JSON.parse(await readFile('.migration-backups/latest.json','utf8'));
const snapshot=JSON.parse(await readFile(path.join(directory,'content.json'),'utf8'));
const published=await fetch(origin+'/api/content');assert.equal(published.status,200);
assert.deepEqual((await published.json()).content,snapshot.content,'Destination content differs from the export; reconcile before changing DNS.');
for(const route of ['/','/menu/','/menu/qr.svg','/owner/'])assert.equal((await fetch(origin+route)).status,200,route);
const owner=await fetch(origin+'/owner/');
assert.equal(owner.headers.get('x-frame-options'),'DENY');
assert.match(owner.headers.get('content-security-policy'),/frame-ancestors 'none'/);
assert.match(owner.headers.get('cache-control'),/no-store/);
for(const route of ['/api/owner-session','/api/owner-access'])assert.equal((await fetch(origin+route)).status,401,route);
for(const prefix of ['redesign',...Array.from({length:6},(_,i)=>'redesign_v'+(i+1))]) {
  const response=await fetch(origin+'/'+prefix+'/',{redirect:'manual'});
  assert.equal(response.status,301);assert.equal(new URL(response.headers.get('location'),origin).pathname,'/');
}
for(const photo of [...snapshot.content.photos.hero,...snapshot.content.photos.moments]) {
  if(photo.url.startsWith('/'))assert.equal((await fetch(new URL(photo.url,origin))).status,200,photo.url);
}
console.log('Verified: exact exported menu/photo selections, public pages, QR asset, owner security headers, blocked anonymous access and retired-version redirects.');
