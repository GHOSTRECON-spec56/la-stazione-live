(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopPointer = window.matchMedia('(min-width: 851px) and (hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const uiEase = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const activeUI = new Map();
  let paused = false;
  try { paused = sessionStorage.getItem('lastazione-motion-paused') === 'true'; } catch (_) { /* Storage is optional. */ }
  root.dataset.motionPaused = String(paused);
  const canAnimate = () => !reduced.matches && !paused;
  const animateUI = (element, frames, duration = 220) => {
    activeUI.get(element)?.cancel();
    if (!canAnimate() || !element.animate) return;
    const animation = element.animate(frames, { duration, easing: uiEase });
    activeUI.set(element, animation);
    const forget = () => { if (activeUI.get(element) === animation) activeUI.delete(element); };
    animation.onfinish = forget;
    animation.oncancel = forget;
  };
  document.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) root.dataset.input = 'keyboard';
  }, { capture: true });
  document.addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, { passive: true, capture: true });
  document.querySelector('#year').textContent = new Date().getFullYear();
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  const closeNav = (restore = false) => {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
    mobileNav.hidden = true;
    if (restore) navToggle.focus();
  };
  navToggle.addEventListener('click', event => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    mobileNav.hidden = isOpen;
    if (!isOpen && event.detail > 0) animateUI(mobileNav, [{ opacity: .5, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'translateY(0)' }], 200);
    else activeUI.get(mobileNav)?.cancel();
  });
  mobileNav.addEventListener('click', event => { if (event.target.closest('a')) closeNav(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) closeNav(true); });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header') && !mobileNav.hidden) closeNav(); });
  window.matchMedia('(min-width: 621px)').addEventListener('change', event => { if (event.matches) closeNav(); });
  document.querySelectorAll('[data-open-menu]').forEach(trigger => trigger.addEventListener('click', event => {
    if (window.LaStazioneRedesignMenu) { event.preventDefault(); window.LaStazioneRedesignMenu.open('All', trigger); }
  }));
  const dock = document.querySelector('.mobile-dock');
  new IntersectionObserver(entries => {
    dock.classList.toggle('is-visible', !entries[0].isIntersecting && window.scrollY > 200);
  }, { threshold: 0 }).observe(document.querySelector('.hero'));

  const rail = document.querySelector('.photo-rail');
  const prev = document.querySelector('#gallery-prev');
  const next = document.querySelector('#gallery-next');
  const updateRail = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    prev.disabled = rail.scrollLeft < 5;
    next.disabled = rail.scrollLeft >= max - 5;
    prev.hidden = next.hidden = max < 5;
  };
  [prev, next].forEach((button, index) => button.addEventListener('click', event => rail.scrollBy({ left: (index ? 1 : -1) * (rail.querySelector('.moment').offsetWidth + parseFloat(getComputedStyle(rail).gap)), behavior: canAnimate() && event.detail > 0 ? 'smooth' : 'instant' })));
  rail.addEventListener('scroll', updateRail, { passive: true });
  new ResizeObserver(updateRail).observe(rail);
  updateRail();

  const moments = [...document.querySelectorAll('[data-photo]')];
  const lightbox = document.querySelector('.lightbox');
  let photoIndex = 0, photoTrigger = null, previousOverflow = '';
  const updatePhoto = () => {
    const selected = moments[photoIndex];
    lightbox.querySelector('img').src = selected.dataset.photo;
    lightbox.querySelector('img').alt = selected.querySelector('img').alt;
    lightbox.querySelector('figcaption').textContent = selected.dataset.caption;
    lightbox.querySelector('.lightbox-counter').textContent = `${photoIndex + 1} / ${moments.length}`;
  };
  const movePhoto = direction => { photoIndex = (photoIndex + direction + moments.length) % moments.length; updatePhoto(); };
  moments.forEach((button, index) => button.addEventListener('click', event => {
    photoIndex = index; photoTrigger = button; updatePhoto();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; lightbox.showModal();
    if (event.detail > 0) animateUI(lightbox, [{ opacity: .4, transform: 'translateY(8px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]);
  }));
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => movePhoto(-1));
  lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => movePhoto(1));
  lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); movePhoto(event.key === 'ArrowRight' ? 1 : -1); } });
  lightbox.addEventListener('click', event => { if (event.target === lightbox) { const rect = lightbox.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) lightbox.close(); } });
  lightbox.addEventListener('close', () => { activeUI.get(lightbox)?.cancel(); document.body.style.overflow = previousOverflow; photoTrigger?.focus({ preventScroll: true }); });

  // Category changes settle quickly; search and keyboard browsing remain immediate.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-menu-preview], [data-menu-main], [data-menu-category]');
    if (!button || event.detail === 0 || button.getAttribute('aria-pressed') === 'true' || !canAnimate()) return;
    const selector = button.hasAttribute('data-menu-preview') ? '.menu-preview-list' : '.menu-results';
    queueMicrotask(() => {
      const list = document.querySelector(selector);
      if (list) animateUI(list, [{ opacity: .55, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], 180);
    });
  }, { capture: true });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-menu-preview], [data-menu-currency]')) {
      // This bubbles after menu.js has rendered the new category or prices.
      scheduleRefresh();
    }
  });

  const band = document.querySelector('.coffee-band');
  const motionToggle = document.querySelector('#motion-toggle');
  const bandGroup = band.querySelector(':scope > div');
  const bandTrack = document.createElement('div');
  bandTrack.className = 'band-track';
  bandGroup.className = 'band-group';
  bandGroup.before(bandTrack);
  bandTrack.append(bandGroup);
  const repeatedGroup = bandGroup.cloneNode(true);
  repeatedGroup.setAttribute('aria-hidden', 'true');
  repeatedGroup.setAttribute('inert', '');
  repeatedGroup.classList.add('band-repeat');
  bandTrack.append(repeatedGroup);
  band.classList.add('has-marquee');
  new ResizeObserver(entries => {
    // ResizeObserver already measured the group; avoid a synchronous layout read.
    const width = entries[0].borderBoxSize?.[0]?.inlineSize || entries[0].contentRect.width;
    bandTrack.style.setProperty('--band-duration', `${Math.max(26, width / 32)}s`);
  }).observe(bandGroup);

  // Three small steam strokes belong to the coffee illustration, not the text.
  const cup = document.querySelector('.album-stamp svg');
  if (cup) {
    cup.querySelector('path').setAttribute('d', 'M6 12h17v7a8 8 0 0 1-16 0v-7Zm17 2h3a4 4 0 0 1 0 8h-4M5 28h21');
    [11, 16, 21].forEach((x, index) => {
      const steam = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      steam.setAttribute('d', `M${x} 8c-2-2 2-3 0-5`);
      steam.setAttribute('class', 'coffee-steam');
      steam.style.animationDelay = `${index * -.4}s`;
      cup.append(steam);
    });
  }
  let bandVisible = false;
  let heroVisible = false;
  const syncAmbient = () => {
    const running = canAnimate() && !document.hidden;
    root.dataset.bandRunning = String(running && bandVisible);
    root.dataset.heroRunning = String(running && heroVisible);
    if (motionToggle) {
      motionToggle.hidden = reduced.matches;
      motionToggle.setAttribute('aria-pressed', String(paused));
      motionToggle.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
      motionToggle.title = paused ? 'Play animations' : 'Pause animations';
    }
  };
  const ambientObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.target === band) bandVisible = entry.isIntersecting;
      else heroVisible = entry.isIntersecting;
    });
    syncAmbient();
  });
  ambientObserver.observe(band);
  ambientObserver.observe(document.querySelector('.hero'));

  const seen = new WeakSet();
  let heroPlayed = false;
  let sceneContext = null;
  let galleryObserver = null;
  let disposeDepth = () => {};
  let disposeLazyScenes = () => {};
  let scrollScenesReady = false;
  let refreshFrame = 0;
  let stoppingScenes = false;
  const motionStyles = new Map();
  const rememberStyles = elements => elements.forEach(element => {
    if (!motionStyles.has(element)) motionStyles.set(element, ['transform', 'opacity'].map(property => [
      property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)
    ]));
  });
  function scheduleRefresh() {
    if (!scrollScenesReady || !canAnimate() || !window.ScrollTrigger || refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      if (scrollScenesReady && canAnimate()) ScrollTrigger.refresh();
    });
  }
  const stopScenes = () => {
    stoppingScenes = true;
    disposeLazyScenes();
    disposeLazyScenes = () => {};
    scrollScenesReady = false;
    cancelAnimationFrame(refreshFrame);
    refreshFrame = 0;
    galleryObserver?.disconnect();
    galleryObserver = null;
    disposeDepth();
    disposeDepth = () => {};
    sceneContext?.revert();
    sceneContext = null;
    motionStyles.forEach((properties, element) => properties.forEach(([property, value, priority]) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }));
    motionStyles.clear();
    activeUI.forEach(animation => animation.cancel());
    activeUI.clear();
    stoppingScenes = false;
  };

  // A damped spring gives the photographs gentle depth, with no scroll hijack.
  // It runs only while the pointer is moving or the album is settling.
  function setupPhotoDepth() {
    if (!desktopPointer.matches) return () => {};
    const album = document.querySelector('.hero-album');
    const setTransform = value => { album.style.transform = value; };
    let x = 0, y = 0, vx = 0, vy = 0, targetX = 0, targetY = 0, ticking = false;
    const tick = (_time, delta) => {
      const dt = Math.min(delta / 1000, 1 / 30);
      vx += ((targetX - x) * 100 - vx * 20) * dt;
      vy += ((targetY - y) * 100 - vy * 20) * dt;
      x += vx * dt; y += vy * dt;
      setTransform(`perspective(1100px) rotateX(${x}deg) rotateY(${y}deg)`);
      if (Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(vx) + Math.abs(vy) < .015) {
        gsap.ticker.remove(tick); ticking = false;
        if (targetX === 0 && targetY === 0) album.style.removeProperty('transform');
      }
    };
    const start = () => { if (!ticking) { gsap.ticker.add(tick); gsap.ticker.wake(); ticking = true; } };
    const move = event => {
      if (event.pointerType !== 'mouse' || !canAnimate() || document.hidden) return;
      const bounds = album.getBoundingClientRect();
      targetX = -((event.clientY - bounds.top) / bounds.height - .5) * 5;
      targetY = ((event.clientX - bounds.left) / bounds.width - .5) * 7;
      start();
    };
    const reset = () => { targetX = targetY = 0; start(); };
    const stop = () => {
      gsap.ticker.remove(tick); ticking = false;
      x = y = vx = vy = targetX = targetY = 0;
      album.style.removeProperty('transform');
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    album.addEventListener('pointermove', move, { passive: true });
    album.addEventListener('pointerleave', reset, { passive: true });
    document.addEventListener('keydown', stop);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      album.removeEventListener('pointermove', move);
      album.removeEventListener('pointerleave', reset);
      document.removeEventListener('keydown', stop);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  function setupScenes() {
    if (!canAnimate() || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    sceneContext = gsap.context(context => {
      if (!heroPlayed && window.scrollY < window.innerHeight) {
        heroPlayed = true;
        rememberStyles(document.querySelectorAll('.hero h1 > *, .hero-copy > p, .hero-actions, .hero-footnote, .photo-main, .photo-small, .album-stamp'));
        gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
          .from('.hero h1 > *', { y: 28, opacity: .4, duration: .8, stagger: .075 }, 0)
          .from('.hero-copy > p, .hero-actions, .hero-footnote', { y: 16, opacity: .5, duration: .65, stagger: .07 }, .16)
          .from('.photo-main', { y: 32, rotation: 0, duration: 1 }, .08)
          .from('.photo-small', { y: 42, rotation: -3, opacity: .45, duration: 1 }, .2)
          .from('.album-stamp', { scale: .9, rotation: -12, opacity: .5, duration: .75 }, .38);
      }
      let setupFrame = 0;
      const prepareScrollScenes = () => {
        disposeLazyScenes();
        if (!canAnimate()) return;
        scrollScenesReady = true;
        context.add(() => {
          const reveal = (trigger, targets, distance = 22) => {
            const elements = [...targets].filter(element => element && !seen.has(element));
            if (!elements.length || !trigger) return;
            ScrollTrigger.create({
              trigger, start: 'top 96%', once: true,
              onEnter: () => {
                // Reverting ScrollTrigger can fire callbacks. It must never mark
                // unseen sections as played or instantiate a new starting state.
                if (stoppingScenes || !canAnimate()) return;
                elements.forEach(element => seen.add(element));
                if (root.dataset.input === 'keyboard') return;
                rememberStyles(elements);
                // Construct the tween only on entrance; dormant sections have
                // no paused from-state that can leak into pause/resume cleanup.
                context.add(() => gsap.fromTo(elements, { y: distance, opacity: .3 }, {
                  y: 0, opacity: 1, duration: .7, stagger: .065, ease: 'power3.out', clearProps: 'transform,opacity'
                }));
              }
            });
          };
          reveal(document.querySelector('.welcome'), document.querySelectorAll('.welcome-heading, .welcome-copy > *'));
          document.querySelectorAll('.section-heading').forEach(heading => reveal(heading, heading.children));
          if (window.matchMedia('(min-width: 851px)').matches) reveal(document.querySelector('.menu-photo'), document.querySelectorAll('.menu-photo'), 30);
          reveal(document.querySelector('.partners'), document.querySelectorAll('.partners > *'), 12);
          reveal(document.querySelector('.visit-copy'), document.querySelectorAll('.visit-copy > *'));
          reveal(document.querySelector('.visit-map'), document.querySelectorAll('.visit-map'), 28);
          reveal(document.querySelector('.footer-top'), document.querySelectorAll('.footer-top > *'), 16);
          reveal(document.querySelector('.footer-wordmark'), document.querySelectorAll('.footer-wordmark'), 24);

          // Observe each photo against the viewport, including horizontal clipping.
          // Offscreen gallery photos keep their first entrance until actually seen.
          galleryObserver = new IntersectionObserver(entries => {
            if (stoppingScenes || !canAnimate() || !galleryObserver) return;
            const entering = entries.filter(entry => entry.isIntersecting && !seen.has(entry.target)).map(entry => entry.target);
            entering.forEach(element => { seen.add(element); galleryObserver.unobserve(element); });
            if (!entering.length || root.dataset.input === 'keyboard') return;
            rememberStyles(entering);
            context.add(() => gsap.fromTo(entering, { y: 26, opacity: .35 }, {
              y: 0, opacity: 1, duration: .75, stagger: .065, ease: 'power3.out', clearProps: 'transform,opacity'
            }));
          }, { threshold: .12 });
          moments.forEach(moment => { if (!seen.has(moment)) galleryObserver.observe(moment); });
        });
      };
      // The rest of the page is visible by default. Prepare its motion only when
      // scrolling begins, keeping initial image rendering free of layout work.
      const startScrollScenes = () => {
        window.removeEventListener('scroll', startScrollScenes);
        setupFrame = requestAnimationFrame(prepareScrollScenes);
      };
      disposeLazyScenes = () => {
        window.removeEventListener('scroll', startScrollScenes);
        cancelAnimationFrame(setupFrame);
      };
      if (window.scrollY > 80 || location.hash) startScrollScenes();
      else window.addEventListener('scroll', startScrollScenes, { once: true, passive: true });
    });
    disposeDepth = setupPhotoDepth();
  }

  const refreshMotion = () => { stopScenes(); syncAmbient(); setupScenes(); };
  motionToggle?.addEventListener('click', () => {
    paused = !paused;
    root.dataset.motionPaused = String(paused);
    try { sessionStorage.setItem('lastazione-motion-paused', String(paused)); } catch (_) { /* Storage is optional. */ }
    refreshMotion();
  });
  reduced.addEventListener('change', refreshMotion);
  desktopPointer.addEventListener('change', refreshMotion);
  document.addEventListener('visibilitychange', () => {
    syncAmbient();
    // Finish one-time entrances when the tab is hidden; never leave half-revealed content.
    if (document.hidden) sceneContext?.getTweens().forEach(tween => { if (tween.isActive()) tween.progress(1); });
  });
  syncAmbient();
  setupScenes();
  // ScrollTrigger handles load/resize itself; font readiness only refreshes an
  // already active page, and multiple mutation requests share one frame.
  document.fonts.ready.then(scheduleRefresh);
})();
