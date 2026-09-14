/* Shared content for La Stazione and the permanent printed menu URL. */
(() => {
  'use strict';
  let content, etag = null, connected = false, lastError = null;
  const endpoint = '/api/content';
  const emit = () => document.dispatchEvent(new CustomEvent('lastazione:content', {detail:{content}}));
  async function jsonFetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.method ? 30000 : 8000);
    try {
      const response = await fetch(url, {...options, cache:'no-store', signal:controller.signal});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(result.error || 'The website could not connect to shared storage. Please try again.'), {status:response.status});
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection took too long. Your changes have not been published. Please try again.');
      throw error;
    } finally {clearTimeout(timer);}
  }
  async function refresh() {
    try {
      const result = await jsonFetch(endpoint);
      if (!result.content?.menu || !result.etag) throw new Error('Shared storage returned an unreadable menu.');
      content = result.content; etag = result.etag; connected = true; lastError = null;
      emit(); return content;
    } catch (error) {connected = false; lastError = error; throw error;}
  }
  async function save(next, base = etag) {
    if (!window.LaStazioneAuth) throw new Error('Open the owner workspace and sign in with Google to publish.');
    await window.LaStazioneAuth.ensureSession();
    const baseEtag = typeof base === 'object' ? base.etag : base;
    if (!baseEtag) throw new Error('Shared storage has not connected. Your draft is safe. Reload the published version before publishing.');
    const result = await jsonFetch(endpoint, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:next,etag:baseEtag})});
    content=result.content;etag=result.etag;connected=true;lastError=null;emit();return content;
  }
  async function upload(file) {
    if (!window.LaStazioneAuth) throw new Error('Open the owner workspace and sign in with Google to upload photos.');
    await window.LaStazioneAuth.ensureSession();
    if (!(file instanceof Blob) || !file.size) throw new Error('Choose an image to upload.');
    if (file.size > 40_000_000) throw new Error('Choose a photo under 40 MB.');
    const objectURL=URL.createObjectURL(file), img=new Image();
    let blob;
    try {
      img.src=objectURL; await img.decode();
      const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const encode=quality=>new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
      blob=await encode(.84);
      if(blob?.size>3_500_000)blob=await encode(.65);
      if(!blob||blob.size>3_500_000)throw new Error('This photo is too large. Please export it as a smaller JPEG.');
    } catch(error) {throw new Error(error.message?.includes('too large')?error.message:'This image could not be opened. Please choose a JPEG, PNG or WebP photo.');}
    finally {URL.revokeObjectURL(objectURL);}
    return jsonFetch('/api/media',{method:'POST',headers:{'Content-Type':blob.type},body:blob});
  }
  const fallback = jsonFetch('/site-content/default.json').then(data=>({data}),error=>({error}));
  // A healthy API must never wait for the backup file; handle its rejection eagerly.
  const initial = refresh().catch(async error=>{
    const backup=await fallback;
    if(backup.data?.menu){content=backup.data;emit();return content;}
    throw error;
  });
  window.LaStazioneContent={ready:initial,get:()=>content,getETag:()=>etag,refresh,save,upload,get connected(){return connected;},get error(){return lastError;},get etag(){return etag;}};
  initial.catch(error=>document.dispatchEvent(new CustomEvent('lastazione:content-error',{detail:{message:error.message}})));
})();
