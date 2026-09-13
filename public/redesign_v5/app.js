(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopPointer = window.matchMedia('(min-width: 851px) and (hover: hover) and (pointer: fine)');
  const sceneDesktop = window.matchMedia('(min-width: 851px)');
  const root = document.documentElement;
  const uiEase = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const activeUI = new Map();
  let paused = false;
  let pageSuspended = false;
  try { paused = sessionStorage.getItem('lastazione-motion-paused') === 'true'; } catch (_) { /* Storage is optional. */ }
  root.dataset.motionPaused = String(paused);
  const canAnimate = () => !reduced.matches && !paused && !pageSuspended;
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
  [prev, next].forEach((button, index) => button.addEventListener('click', event => {
    const first = rail.querySelector('.moment');
    if (first) rail.scrollBy({ left: (index ? 1 : -1) * (first.offsetWidth + parseFloat(getComputedStyle(rail).gap)), behavior: canAnimate() && event.detail > 0 ? 'smooth' : 'instant' });
  }));
  rail.addEventListener('scroll', updateRail, { passive: true });
  new ResizeObserver(updateRail).observe(rail);
  updateRail();

  const getMoments = () => [...rail.querySelectorAll('[data-photo]')];
  const lightbox = document.querySelector('.lightbox');
  let photoIndex = 0, photoTrigger = null, previousOverflow = '';
  const updatePhoto = () => {
    const moments = getMoments();
    if (!moments.length) { if (lightbox.open) lightbox.close(); return; }
    photoIndex = Math.min(photoIndex, moments.length - 1);
    const selected = moments[photoIndex];
    lightbox.querySelector('img').src = selected.dataset.photo;
    lightbox.querySelector('img').alt = selected.querySelector('img').alt;
    lightbox.querySelector('figcaption').textContent = selected.dataset.caption;
    lightbox.querySelector('.lightbox-counter').textContent = `${photoIndex + 1} / ${moments.length}`;
  };
  const movePhoto = direction => { const count = getMoments().length; if (count) photoIndex = (photoIndex + direction + count) % count; updatePhoto(); };
  rail.addEventListener('click', event => {
    const button = event.target.closest('[data-photo]');
    if (!button || !rail.contains(button)) return;
    photoIndex = getMoments().indexOf(button); photoTrigger = button; updatePhoto();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; lightbox.showModal();
    if (event.detail > 0) animateUI(lightbox, [{ opacity: .4, transform: 'translateY(8px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]);
  });
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
    const pixelsPerSecond = innerWidth <= 620 ? 20 : 40;
    bandTrack.style.setProperty('--band-duration', `${Math.max(26, width / pixelsPerSecond)}s`);
  }).observe(bandGroup);

  // Sunbeam's rotating food composition, reinterpreted with our own drawings.
  // Only the drawings move; menu labels and prices always remain in place.
  const wheel = document.querySelector('.menu-wheel');
  const wheelArt = wheel ? [...wheel.querySelectorAll('.wheel-slot > .ink-art')] : [];
  let wheelVisible = false, wheelTimer = 0, wheelAngle = 0;
  let wheelAnimations = [];
  const stopWheel = () => {
    clearTimeout(wheelTimer);
    wheelTimer = 0;
    wheelAnimations.forEach(animation => animation.cancel());
    wheelAnimations = [];
    wheelAngle = 0;
  };
  const wheelCanRun = () => wheel && wheelVisible && canAnimate() && !document.hidden;
  const advanceWheel = () => {
    wheelTimer = 0;
    if (!wheelCanRun()) return;
    const previous = wheelAngle;
    wheelAngle -= 90;
    wheelAnimations.forEach(animation => animation.cancel());
    const timing = { duration: 720, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' };
    wheelAnimations = [wheel.animate([
      { transform: `rotate(${previous}deg)` }, { transform: `rotate(${wheelAngle}deg)` }
    ], timing), ...wheelArt.map(art => art.animate([
      { transform: `rotate(${-previous}deg)` }, { transform: `rotate(${-wheelAngle}deg)` }
    ], timing))];
    wheelTimer = setTimeout(advanceWheel, 4500);
  };
  const syncWheel = () => {
    if (!wheelCanRun()) stopWheel();
    else if (!wheelTimer) wheelTimer = setTimeout(advanceWheel, 4500);
  };

  // A bounded, explicit coffee-break flourish: seven drawings, no physics loop.
  const breakButton = document.querySelector('#coffee-break');
  const breakStatus = document.querySelector('#coffee-break-status');
  const confetti = document.querySelector('.coffee-confetti');
  let confettiAnimations = [], breakCount = 0;
  const clearConfetti = () => {
    confettiAnimations.forEach(animation => animation.cancel());
    confettiAnimations = [];
    confetti?.replaceChildren();
  };
  breakButton?.addEventListener('click', event => {
    breakCount += 1;
    if (breakStatus) breakStatus.textContent = breakCount % 2 ? 'A little joy, on the house.' : 'There is always time for a coffee break.';
    clearConfetti();
    if (!canAnimate() || document.hidden || event.detail === 0 || !confetti || !confetti.animate) return;
    const bounds = breakButton.getBoundingClientRect();
    const originX = Math.min(innerWidth - 40, Math.max(40, bounds.left + bounds.width / 2));
    const originY = bounds.top + bounds.height / 2;
    for (let index = 0; index < 7; index += 1) {
      const particle = document.createElement('span');
      particle.className = `coffee-particle ink-art ${index % 2 ? 'art-croissant' : 'art-cup'}`;
      particle.style.left = `${originX - 32}px`;
      particle.style.top = `${originY - 32}px`;
      confetti.append(particle);
      const direction = (index - 3) / 3;
      const velocityX = direction * Math.min(200, innerWidth * .42);
      const lift = 230 + (3 - Math.abs(index - 3)) * 25;
      const rotation = direction * 160;
      const frames = Array.from({ length: 9 }, (_, frame) => {
        const t = frame / 8;
        return {
          offset: t,
          transform: `translate3d(${velocityX * t}px, ${-lift * 2.5 * t + 800 * t * t}px, 0) rotate(${rotation * t}deg) scale(${.92 + .08 * t})`,
          opacity: t <= .75 ? 1 : 1 - (t - .75) * 4
        };
      });
      const animation = particle.animate(frames, { duration: 1100 + index * 35, easing: 'linear' });
      confettiAnimations.push(animation);
      animation.onfinish = () => {
        particle.remove();
        confettiAnimations = confettiAnimations.filter(current => current !== animation);
      };
    }
  });
  let bandVisible = false;
  let heroVisible = false;
  const syncAmbient = () => {
    const running = canAnimate() && !document.hidden;
    root.dataset.bandRunning = String(running && bandVisible);
    root.dataset.heroRunning = String(running && heroVisible);
    syncWheel();
    if (!running) clearConfetti();
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
      else if (entry.target === wheel) wheelVisible = entry.isIntersecting;
      else heroVisible = entry.isIntersecting;
    });
    syncAmbient();
  });
  ambientObserver.observe(band);
  ambientObserver.observe(document.querySelector('.hero'));
  if (wheel) ambientObserver.observe(wheel);

  const seen = new WeakSet();
  let heroPlayed = false;
  let heroTimeline = null;
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
    heroTimeline = null;
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
    if (!canAnimate() || document.hidden || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    sceneContext = gsap.context(context => {
      if (!heroPlayed && window.scrollY < window.innerHeight) {
        heroPlayed = true;
        rememberStyles(document.querySelectorAll('.hero h1 > *, .hero-copy > p, .hero-actions, .hero-footnote, .photo-main, .photo-small, .photo-chess, .hero-carousel-viewport, .hero .ink-piece'));
        heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
          .from('.hero h1 > *', { yPercent: 25, rotation: -3, opacity: .15, duration: .8, stagger: .085 }, 0)
          .from('.hero-copy > p, .hero-actions, .hero-footnote', { y: 18, opacity: .4, duration: .65, stagger: .065 }, .16);
        if (document.querySelector('.hero-carousel-viewport')) {
          heroTimeline.from('.hero-carousel-viewport', { y: 40, opacity: .35, duration: .95 }, .1);
        } else {
          heroTimeline.from('.photo-main', { y: 64, rotation: 0, opacity: .35, duration: .95 }, .1)
            .from('.photo-small', { y: 85, rotation: -12, opacity: .25, duration: .95 }, .19)
            .from('.photo-chess', { y: 72, rotation: 12, opacity: .25, duration: .95 }, .27);
        }
        heroTimeline.from('.hero .ink-piece', { y: 28, rotation: -10, scale: .92, opacity: .15, duration: .8, stagger: .065 }, .32);
      }
      let setupFrame = 0;
      const prepareScrollScenes = () => {
        disposeLazyScenes();
        if (!canAnimate()) return;
        // A quick scroll can interrupt entry; settle it before measuring spread.
        if (heroTimeline?.isActive()) heroTimeline.progress(1);
        scrollScenesReady = true;
        context.add(() => {
          // A gentle spread of the real photographs and drawings follows the
          // departing hero. Native scrolling stays in charge, without pinning.
          if (window.scrollY < document.querySelector('.hero').offsetHeight && root.dataset.input !== 'keyboard') {
            const hero = document.querySelector('.hero');
            const artwork = [...hero.querySelectorAll('.photo-main, .photo-small, .photo-chess, .ink-piece')];
            const amount = sceneDesktop.matches ? 1 : .4;
            rememberStyles(artwork);
            const spread = gsap.timeline({ scrollTrigger: {
              trigger: hero, start: 'top top', end: 'bottom top', scrub: .6,
              invalidateOnRefresh: true
            } });
            artwork.forEach((element, index) => {
              const direction = index % 2 ? 1 : -1;
              spread.to(element, {
                x: direction * (element.classList.contains('ink-piece') ? 48 : 34) * amount,
                y: (index % 3 === 0 ? -28 : 24) * amount,
                rotation: `+=${direction * (element.classList.contains('ink-piece') ? 14 : 5) * amount}`,
                ease: 'none', duration: 1
              }, 0);
            });
          }
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
          if (sceneDesktop.matches) reveal(document.querySelector('.menu-illustration, .menu-photo'), document.querySelectorAll('.menu-illustration, .menu-photo'), 30);
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
          getMoments().forEach(moment => { if (!seen.has(moment)) galleryObserver.observe(moment); });
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
  sceneDesktop.addEventListener('change', refreshMotion);
  // Safari can suspend GSAP between rendering a from-state and its first tick.
  // Completing nested from-tweens on visibilitychange leaves stale start values
  // in the context. Tear down the entire scene and restore its saved CSS instead.
  // No hero entry is replayed on return, including a bfcache restoration.
  const suspendPage = () => {
    pageSuspended = true;
    heroPlayed = true;
    root.dataset.pageSuspended = 'true';
    stopScenes();
    syncAmbient();
  };
  const restorePage = () => {
    if (document.hidden) return;
    if (pageSuspended) {
      stopScenes();
      pageSuspended = false;
      root.dataset.pageSuspended = 'false';
      setupScenes();
    }
    syncAmbient();
    scheduleRefresh();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspendPage(); else restorePage(); });
  window.addEventListener('pagehide', suspendPage);
  window.addEventListener('pageshow', event => { if (event.persisted) suspendPage(); restorePage(); });
  document.addEventListener('lastazione:content', () => {
    queueMicrotask(() => {
      updateRail();
      if (lightbox.open) updatePhoto();
      if (galleryObserver) getMoments().forEach(moment => { if (!seen.has(moment)) galleryObserver.observe(moment); });
      scheduleRefresh();
    });
  });
  syncAmbient();
  setupScenes();
  // ScrollTrigger handles load/resize itself; font readiness only refreshes an
  // already active page, and multiple mutation requests share one frame.
  document.fonts.ready.then(scheduleRefresh);
})();
