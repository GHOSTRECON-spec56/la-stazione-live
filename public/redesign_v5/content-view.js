(() => {
  'use strict';
  const art=document.querySelector('.menu-illustration');
  if(art){
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){art.dataset.artReady='';observer.disconnect();}},{rootMargin:'180px'});observer.observe(art);}
    else art.dataset.artReady='';
  }
  let key='';
  const render=content=>{
    const rail=document.querySelector('.photo-rail');
    if(!rail||!Array.isArray(content?.photos?.moments))return;
    const photos=content.photos.moments,next=JSON.stringify(photos);
    if(next===key)return;key=next;
    const fragment=document.createDocumentFragment();
    photos.forEach((photo,index)=>{
      const button=document.createElement('button');button.type='button';button.className=`moment moment-${index%2?'short':'tall'}`;
      button.dataset.photo=photo.url;button.dataset.caption=photo.caption;button.setAttribute('aria-label',`${photo.caption||photo.alt||'Café moment'}. Enlarge photo`);
      const img=document.createElement('img');img.src=photo.url;img.alt=photo.alt;img.loading='lazy';img.width=1080;img.height=index%2?1080:1440;
      if(/^\/redesign_v4\/photos\/gallery-\d+-1000\.webp$/.test(photo.url)){img.srcset=`${photo.url.replace('-1000.webp','-640.webp')} 640w, ${photo.url} 1000w`;img.sizes='(max-width: 620px) 70vw, 350px';}
      const caption=document.createElement('span');caption.append(document.createTextNode(photo.caption));
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');
      const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#expand');svg.append(use);caption.append(svg);button.append(img,caption);fragment.append(button);
    });
    rail.replaceChildren(fragment);
    const section=document.querySelector('#moments');section.hidden=!photos.length;
    document.dispatchEvent(new CustomEvent('lastazione:photos'));
  };
  document.addEventListener('lastazione:content',event=>render(event.detail.content));
  window.LaStazioneContent?.ready.then(render).catch(()=>{});
})();
