/* ============================================================
   KATERYNA IVANCHENKO — site behaviour
   Vanilla JS, no dependencies, no build step.
   ============================================================ */
(function () {
  'use strict';

  var header = document.getElementById('site-header');
  var nav = document.getElementById('nav');
  var hamburger = document.getElementById('hamburger');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. Header: scrolled state + zone-aware theme ---------- */
  var zones = Array.prototype.slice.call(document.querySelectorAll('.zone'));
  var ticking = false;

  function syncHeader() {
    ticking = false;
    if (window.scrollY > 24) header.setAttribute('data-scrolled', '');
    else header.removeAttribute('data-scrolled');

    // Which zone sits under the middle of the header band?
    var probe = header.offsetHeight / 2;
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        header.dataset.theme = zones[i].classList.contains('zone--dark') ? 'dark' : 'light';
        return;
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(syncHeader);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  syncHeader();

  /* ---------- 2. Mobile navigation ---------- */
  function setNav(open) {
    nav.classList.toggle('nav--open', open);
    hamburger.classList.toggle('hamburger--open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-lock', open);
  }

  hamburger.addEventListener('click', function () {
    setNav(!nav.classList.contains('nav--open'));
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('.nav__link')) setNav(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('nav--open')) {
      setNav(false);
      hamburger.focus();
    }
  });

  // Keep Tab inside the panel while the mobile menu is open.
  nav.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !nav.classList.contains('nav--open')) return;
    var items = nav.querySelectorAll('.nav__link');
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      hamburger.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      hamburger.focus();
    }
  });

  // A resize back to desktop must not leave the body scroll-locked.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && nav.classList.contains('nav--open')) setNav(false);
  });

  /* ---------- 3. Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 4. Scroll spy ---------- */
  var links = Array.prototype.slice.call(nav.querySelectorAll('.nav__link'));
  var targets = links
    .map(function (l) { return document.querySelector(l.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ---------- 5. Video facades ---------- */
  // Nothing is requested from Vimeo/YouTube until the visitor clicks play.
  document.querySelectorAll('.video-embed').forEach(function (box) {
    var btn = box.querySelector('.video-embed__btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var provider = box.dataset.provider;
      var id = box.dataset.id;
      var title = box.dataset.title || 'Video';
      var node;

      if (provider === 'file') {
        node = document.createElement('video');
        node.src = box.dataset.src;
        node.controls = true;
        node.autoplay = true;
        node.playsInline = true;
        node.setAttribute('aria-label', title);
      } else {
        node = document.createElement('iframe');
        node.src = provider === 'youtube'
          ? 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1'
          : 'https://player.vimeo.com/video/' + id + '?autoplay=1&dnt=1&title=0&byline=0&portrait=0';
        node.title = title;
        node.allow = 'autoplay; fullscreen; picture-in-picture';
        node.setAttribute('allowfullscreen', '');
        node.setAttribute('loading', 'lazy');
      }

      box.innerHTML = '';
      box.appendChild(node);
    });
  });

  /* ---------- 6. Hero reel: muted loop with an unmute control ---------- */
  var heroVideo = document.getElementById('hero-video');
  var unmute = document.getElementById('hero-unmute');

  if (heroVideo && reduceMotion.matches) {
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
  }

  if (heroVideo && unmute) {
    unmute.addEventListener('click', function () {
      heroVideo.muted = false;
      heroVideo.loop = false;
      heroVideo.controls = true;
      heroVideo.currentTime = 0;
      var p = heroVideo.play();
      if (p && p.catch) p.catch(function () { /* autoplay policy — controls are visible now */ });
      unmute.remove();
    });
  }

  /* ---------- 7. Drifting light flares, scattered by the pointer ----------
     Purely decorative, so it is built here instead of sitting in the markup.

     Performance contract — do not break it:
     · The loop WRITES nothing but `transform`. Each flare rasterises once
       (blur included) and every frame after that is a GPU composite.
     · The loop READS no geometry. Base positions are measured once (and on
       resize); `scrollY` is read once per frame, before any write, so the
       read/write phases never interleave and nothing forces a sync layout.
     · It runs only while a flare-bearing zone is on screen and the tab is
       visible. Off screen, the rAF loop is cancelled outright.
     · Skipped entirely under prefers-reduced-motion — the flares stay, frozen
       at their resting positions. */
  (function flares() {
    var hostZones = document.querySelectorAll('.zone--dark:not(.footer)');
    if (!hostZones.length) return;

    var REPEL_RADIUS = 360;   // px — how close the pointer must get
    var REPEL_FORCE = 4600;   // px/s² at the centre, easing to 0 at the radius
    var SPRING = 5.5;         // pull back toward the resting position
    var MAX_OFFSET = 420;     // px — hard cap so a fast pointer cannot fling one away

    var blobs = [];
    var zoneList = [];

    hostZones.forEach(function (zoneEl) {
      var wrap = document.createElement('div');
      wrap.className = 'zone-blobs';
      wrap.setAttribute('aria-hidden', 'true');

      var zone = { el: zoneEl, top: 0, left: 0, visible: false };
      zoneList.push(zone);

      for (var i = 1; i <= 7; i++) {
        var el = document.createElement('span');
        el.className = 'zone-blob zone-blob--' + i;
        wrap.appendChild(el);

        // Each flare gets its own Lissajous figure, so no two share a path and
        // the group never visibly loops.
        blobs.push({
          el: el, zone: zone,
          cx: 0, cy: 0,
          ampX: 90 + i * 22, ampY: 60 + i * 18,
          freqX: 2 * Math.PI / (9 + i * 2.5),
          freqY: 2 * Math.PI / (13 + i * 1.1),
          freqS: 2 * Math.PI / (11 + i * 3),
          freqR: 2 * Math.PI / (17 + i * 2),
          phase: i * 1.7,
          ox: 0, oy: 0, vx: 0, vy: 0
        });
      }
      zoneEl.appendChild(wrap);
    });

    if (reduceMotion.matches) return;   // flares stay, motion does not

    function measure() {
      zoneList.forEach(function (z) {
        var r = z.el.getBoundingClientRect();
        z.top = r.top + window.scrollY;
        z.left = r.left + window.scrollX;
      });
      blobs.forEach(function (b) {
        b.cx = b.el.offsetLeft + b.el.offsetWidth / 2;
        b.cy = b.el.offsetTop + b.el.offsetHeight / 2;
      });
    }

    var pointerX = 0, pointerY = 0, pointerOn = false;
    window.addEventListener('pointermove', function (e) {
      pointerX = e.clientX; pointerY = e.clientY; pointerOn = true;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { pointerOn = false; });

    var running = false, rafId = 0, last = 0, clock = 0;

    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += dt;

      var scrollTop = window.scrollY;           // single read, before any write
      var damp = Math.exp(-2.0 * dt);
      var pDocX = pointerX + window.scrollX;
      var pDocY = pointerY + scrollTop;

      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        if (!b.zone.visible) continue;

        var wanderX = b.ampX * Math.sin(clock * b.freqX + b.phase);
        var wanderY = b.ampY * Math.sin(clock * b.freqY + b.phase * 0.6);

        if (pointerOn) {
          var dx = b.zone.left + b.cx + wanderX + b.ox - pDocX;
          var dy = b.zone.top + b.cy + wanderY + b.oy - pDocY;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPEL_RADIUS && dist > 0.01) {
            var push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE * dt;
            b.vx += (dx / dist) * push;
            b.vy += (dy / dist) * push;
          }
        }

        b.vx = (b.vx - SPRING * b.ox * dt) * damp;
        b.vy = (b.vy - SPRING * b.oy * dt) * damp;
        b.ox = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, b.ox + b.vx * dt));
        b.oy = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, b.oy + b.vy * dt));

        var scale = 1 + 0.14 * Math.sin(clock * b.freqS + b.phase);
        var spin = 26 * Math.sin(clock * b.freqR + b.phase * 1.3);

        b.el.style.transform =
          'translate3d(' + (wanderX + b.ox).toFixed(1) + 'px,' +
          (wanderY + b.oy).toFixed(1) + 'px,0) rotate(' +
          spin.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';
      }
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running || document.hidden) return;
      running = true;
      last = performance.now();
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function sync() {
      var anyVisible = zoneList.some(function (z) { return z.visible; });
      if (anyVisible) start(); else stop();
    }

    measure();

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          zoneList.forEach(function (z) {
            if (z.el === entry.target) z.visible = entry.isIntersecting;
          });
        });
        sync();
      }, { rootMargin: '10% 0px' });
      zoneList.forEach(function (z) { io.observe(z.el); });
    } else {
      zoneList.forEach(function (z) { z.visible = true; });
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else sync();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 150);
    }, { passive: true });
  })();

  /* ---------- 8. Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
