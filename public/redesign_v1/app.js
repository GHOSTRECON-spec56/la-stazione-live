(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelector('#year').textContent = new Date().getFullYear();
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  const closeNav = (restore = false) => {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
    mobileNav.hidden = true;
    if (restore) navToggle.focus();
  };
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    mobileNav.hidden = isOpen;
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
  [prev, next].forEach((button, index) => button.addEventListener('click', () => rail.scrollBy({ left: (index ? 1 : -1) * (rail.querySelector('.moment').offsetWidth + 24), behavior: reduced.matches ? 'instant' : 'smooth' })));
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
  moments.forEach((button, index) => button.addEventListener('click', () => {
    photoIndex = index; photoTrigger = button; updatePhoto();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; lightbox.showModal();
  }));
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => movePhoto(-1));
  lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => movePhoto(1));
  lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); movePhoto(event.key === 'ArrowRight' ? 1 : -1); } });
  lightbox.addEventListener('click', event => { if (event.target === lightbox) { const rect = lightbox.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) lightbox.close(); } });
  lightbox.addEventListener('close', () => { document.body.style.overflow = previousOverflow; photoTrigger?.focus({ preventScroll: true }); });

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.hero h1 > *', { y: 24, opacity: .55, duration: .7, stagger: .065 }, 0)
        .from('.photo-main', { y: 22, rotation: 0, opacity: .75, duration: .9 }, .05)
        .from('.photo-small', { y: 32, rotation: -3, opacity: .55, duration: .9 }, .18)
        .from('.album-stamp', { scale: .9, rotation: -8, duration: .65 }, .3);
    });
    motion.add('(min-width: 851px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.to('.photo-small', { y: -36, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });
      gsap.fromTo('.visit-photo', { rotation: 1 }, { rotation: 3, ease: 'none', scrollTrigger: { trigger: '.visit-section', start: 'top bottom', end: 'center center', scrub: .7 } });
    });
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
})();
