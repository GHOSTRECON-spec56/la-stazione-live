(() => {
  'use strict';
  const album = document.querySelector('.hero-album');
  if (!album) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fallback = [...album.querySelectorAll('figure')].map((figure, index) => ({
    id: `original-${index}`, url: figure.querySelector('img').getAttribute('src'),
    alt: figure.querySelector('img').alt, caption: figure.querySelector('figcaption')?.textContent || '',
    isFirst: figure.classList.contains('photo-main')
  }));
  // Start with the cappuccino while preserving the original left/right pictures.
  const first = Math.max(0, fallback.findIndex(photo => photo.isFirst));
  const initialPhotos = [...fallback.slice(first), ...fallback.slice(0, first)];
  let photos = [], slides = [], current = 0, step = 0, physical = 0;
  let frame = 0, settleTimer = 0, pointerActive = false, jumpInProgress = false;
  let sourceKey = '', lastWidth = 0;
  album.classList.add('hero-carousel');
  album.setAttribute('role', 'region');
  album.setAttribute('aria-roledescription', 'carousel');
  album.setAttribute('aria-label', 'Life at La Stazione');
  const viewport = document.createElement('div');
  viewport.className = 'hero-carousel-viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'group');
  viewport.setAttribute('aria-label', 'Cafe photographs. Swipe or use the left and right arrow keys.');
  const track = document.createElement('div');
  track.className = 'hero-carousel-track';
  viewport.append(track);
  const controls = document.createElement('div');
  controls.className = 'hero-carousel-controls';
  const button = (direction, label) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'round-button';
    element.setAttribute('aria-label', label);
    element.dataset.heroDirection = direction;
    element.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#arrow-${direction === 'previous' ? 'left' : 'right'}"/></svg>`;
    return element;
  };
  const prev = button('previous', 'Previous photograph');
  const next = button('next', 'Next photograph');
  const counter = document.createElement('span');
  counter.className = 'hero-carousel-counter';
  counter.setAttribute('aria-live', 'polite');
  counter.setAttribute('aria-atomic', 'true');
  controls.append(prev, counter, next);
  album.replaceChildren(viewport, controls);

  const wrap = index => ((index % photos.length) + photos.length) % photos.length;
  const motionAllowed = () => !reduced.matches && root.dataset.motionPaused !== 'true';
  const paint = () => {
    frame = 0;
    if (!step || !photos.length) return;
    // A responsive layout may emit scroll before ResizeObserver. Never derive
    // a new selected photo from a scroll offset measured with the old spacing.
    if (Math.abs(viewport.clientWidth - lastWidth) >= .5) { measure(); return; }
    const position = viewport.scrollLeft / step;
    physical = Math.max(0, Math.min(slides.length - 1, Math.round(position)));
    current = wrap(physical);
    slides.forEach((slide, index) => {
      const distance = Math.max(-1, Math.min(1, index - position));
      const scale = 1 - Math.abs(distance) * .14;
      const rotation = 1.5 + distance * (distance < 0 ? 8.5 : 5.5);
      // Give the adjacent photos the same casual tilt as the original album.
      const transform = `translateY(${Math.abs(distance) * 18}px) rotate(${rotation}deg) scale(${scale})`;
      if (slide.firstElementChild.style.transform !== transform) slide.firstElementChild.style.transform = transform;
      const active = index === physical;
      if (slide.dataset.active !== String(active)) {
        slide.dataset.active = String(active);
        slide.setAttribute('aria-hidden', String(!active));
      }
    });
  };
  const announce = () => { const value = `${current + 1} / ${photos.length}`; if (counter.textContent !== value) counter.textContent = value; };
  const jumpTo = index => {
    jumpInProgress = true;
    viewport.scrollTo({ left: index * step, behavior: 'instant' });
    paint();
    jumpInProgress = false;
  };
  const settle = () => {
    clearTimeout(settleTimer);
    if (pointerActive || !photos.length || !step) return;
    paint();
    // The five equal cycles have identical geometry. Recenter after momentum
    // stops, so Safari's native touch scrolling never fights a scripted jump.
    const middle = photos.length > 1 ? photos.length * 2 + current : 0;
    if (physical !== middle) jumpTo(middle);
    announce();
  };
  const measure = () => {
    const width = viewport.clientWidth;
    if (!width || (Math.abs(width - lastWidth) < .5 && step)) return;
    lastWidth = width;
    const narrow = matchMedia('(max-width: 620px)').matches;
    const slideWidth = width * (narrow ? .435 : .315);
    const gap = narrow ? 8 : 13;
    step = slideWidth + gap;
    album.style.setProperty('--viewport-width', `${width}px`);
    album.style.setProperty('--slide-width', `${slideWidth}px`);
    album.style.setProperty('--slide-gap', `${gap}px`);
    jumpTo(photos.length > 1 ? photos.length * 2 + current : 0);
  };
  const setPhotos = nextPhotos => {
    if (!Array.isArray(nextPhotos)) return;
    const safePhotos = nextPhotos.filter(photo => photo && typeof photo.url === 'string' && photo.url.trim());
    // Compare the rendered fields in a fixed order. The synchronous seed and
    // API response may serialize their object keys differently without changing
    // a photograph; preserving those image nodes also preserves the first LCP.
    const key = JSON.stringify(safePhotos.map(photo => [photo.id, photo.url, photo.alt || '', photo.caption || '']));
    if (key === sourceKey) return;
    sourceKey = key;
    const previousId = photos[current]?.id;
    photos = safePhotos;
    current = Math.max(0, photos.findIndex(photo => photo.id === previousId));
    album.hidden = photos.length === 0;
    album.dataset.single = String(photos.length < 2);
    controls.hidden = photos.length < 2;
    viewport.tabIndex = photos.length > 1 ? 0 : -1;
    clearTimeout(settleTimer);
    track.replaceChildren();
    slides = [];
    if (!photos.length) return;
    const count = photos.length === 1 ? 1 : photos.length * 5;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const photo = photos[index % photos.length];
      const figure = document.createElement('figure');
      figure.className = 'hero-slide';
      figure.setAttribute('role', 'group');
      figure.setAttribute('aria-roledescription', 'slide');
      figure.setAttribute('aria-label', `${index % photos.length + 1} of ${photos.length}`);
      figure.setAttribute('aria-hidden', 'true');
      const imageWrap = document.createElement('div');
      imageWrap.className = 'hero-slide-image';
      const image = document.createElement('img');
      image.alt = photo.alt || photo.caption || 'A moment at La Stazione';
      image.width = 1080;
      image.height = 1080;
      image.decoding = 'async';
      image.draggable = false;
      // Set priority and lazy loading before assigning any network URL.
      const initialIndex = photos.length > 1 ? photos.length * 2 + current : 0;
      image.loading = Math.abs(index - initialIndex) <= 1 ? 'eager' : 'lazy';
      if (index === initialIndex) image.fetchPriority = 'high';
      const original = photo.url.match(/^\/redesign_v4\/photos\/(gallery-\d{2})-1000\.webp$/);
      if (original) {
        // Match the original mobile preload and avoid fetching a second, larger
        // file when the shared content replaces the static opening photographs.
        const stem = `/redesign_v4/photos/${original[1]}`;
        image.sizes = '(max-width: 620px) 43.5vw, (max-width: 850px) min(31.5vw, 252px), (min-width: 1600px) 372px, min(31.5vw, 340.2px)';
        image.srcset = `${stem}-640.webp 640w, ${stem}-1000.webp 1000w`;
        image.src = `${stem}-640.webp`;
      } else image.src = photo.url;
      const caption = document.createElement('figcaption');
      caption.textContent = photo.caption || '';
      imageWrap.append(image);
      figure.append(imageWrap, caption);
      fragment.append(figure);
      slides.push(figure);
    }
    track.append(fragment);
    lastWidth = 0;
    measure();
    announce();
  };
  const move = (direction, animate) => {
    if (photos.length < 2) return;
    clearTimeout(settleTimer);
    const index = Math.round(viewport.scrollLeft / step) + direction;
    viewport.scrollTo({ left: index * step, behavior: animate && motionAllowed() ? 'smooth' : 'instant' });
    if (!animate || !motionAllowed()) settle();
  };
  prev.addEventListener('click', event => move(-1, event.detail > 0));
  next.addEventListener('click', event => move(1, event.detail > 0));
  viewport.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1, false);
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      current = event.key === 'Home' ? 0 : photos.length - 1;
      jumpTo(photos.length > 1 ? photos.length * 2 + current : 0);
      announce();
    }
  });
  viewport.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(paint);
    if (jumpInProgress) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
  }, { passive: true });
  viewport.addEventListener('scrollend', settle);
  viewport.addEventListener('pointerdown', () => { pointerActive = true; clearTimeout(settleTimer); }, { passive: true });
  const release = () => { pointerActive = false; clearTimeout(settleTimer); settleTimer = setTimeout(settle, 180); };
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });
  new ResizeObserver(measure).observe(viewport);
  window.addEventListener('pageshow', () => { lastWidth = 0; measure(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pointerActive = false; settle(); } });
  const acceptContent = content => { if (Array.isArray(content?.photos?.hero)) setPhotos(content.photos.hero); };
  document.addEventListener('lastazione:content', event => acceptContent(event.detail?.content));
  setPhotos(Array.isArray(window.LaStazioneInitialPhotos) ? window.LaStazioneInitialPhotos : initialPhotos);
  const initialContent = window.LaStazioneContent?.get?.();
  if (initialContent && typeof initialContent.then !== 'function') acceptContent(initialContent);
  window.LaStazioneContent?.ready?.then(acceptContent).catch(() => { /* Keep the original photographs available offline. */ });
  window.LaStazioneHeroCarousel = { setPhotos, getCurrentIndex: () => current };
})();
