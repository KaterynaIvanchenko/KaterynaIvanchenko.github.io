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
  var zones = document.querySelectorAll('.zone');
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
    // Shift-Tab off the first link, or Tab off the last, returns to the toggle.
    var edge = e.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement === edge) {
      e.preventDefault();
      hamburger.focus();
    }
  });

  // The hamburger sits outside .nav, so the trap above never sees a Tab from it.
  // Both directions are handled: forward lands on the first link, backward on the
  // last — otherwise Shift+Tab fell through to the page behind the open panel.
  hamburger.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !nav.classList.contains('nav--open')) return;
    var items = nav.querySelectorAll('.nav__link');
    if (!items.length) return;
    e.preventDefault();
    (e.shiftKey ? items[items.length - 1] : items[0]).focus();
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
    .map(function (l) {
      // Only in-page anchors. querySelector throws on anything else, and one
      // throw here would take down every concern below it in this IIFE.
      var href = l.getAttribute('href') || '';
      return /^#[A-Za-z][\w-]*$/.test(href) ? document.getElementById(href.slice(1)) : null;
    })
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

      // An unfilled facade keeps its poster: replacing it with an empty
      // <video>/<iframe> is destructive and cannot be undone without a reload.
      if (provider === 'file' ? !box.dataset.src : !id) return;

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
        // Explicit, not left to the browser default: YouTube refuses playback
        // (error 153) when it cannot see an origin it trusts.
        node.referrerPolicy = 'strict-origin-when-cross-origin';
        node.setAttribute('allowfullscreen', '');
      }

      box.innerHTML = '';
      box.appendChild(node);
    });
  });

  /* ---------- 6. Drifting light flares, scattered by the pointer ----------
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

    // .zone-blobs is display:none below 768px. Without this the rAF loop still
    // ran full tilt on phones, writing transforms to nodes that never render.
    var wide = window.matchMedia('(min-width: 769px)');

    function sync() {
      var anyVisible = wide.matches && zoneList.some(function (z) { return z.visible; });
      if (anyVisible) start(); else stop();
    }

    if (wide.addEventListener) {
      wide.addEventListener('change', function () { measure(); sync(); });
    }

    measure();
    // Base positions are captured at parse time, before web fonts swap and shift
    // everything below the fold. Re-measure once the layout has actually settled,
    // otherwise the pointer repulsion is offset by however far the page moved.
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }

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

  /* ---------- 7. Contact form ----------
     Progressive enhancement: the form posts on its own without JS. Here we
     intercept it so the visitor stays on the page and gets an inline status. */
  var cForm = document.querySelector('.contact-form');
  if (cForm) {
    var cStatus = cForm.querySelector('.contact-form__status');
    var cSubmit = cForm.querySelector('.contact-form__submit');
    var cSubmitLabel = cSubmit && cSubmit.querySelector('.contact-form__submit-label');
    var cSubmitText = cSubmitLabel ? cSubmitLabel.textContent : '';
    var sending = false;

    // The status paragraph is never `hidden` and never emptied by JS: a live
    // region has to be in the accessibility tree BEFORE its text changes, or the
    // announcement is unreliable. `:empty` in the CSS hides the resting state.
    var setStatus = function (text, ok) {
      if (!cStatus) return;
      cStatus.classList.toggle('contact-form__status--ok', ok);
      cStatus.classList.toggle('contact-form__status--err', !ok);
      // A failure is assertive: the visitor is about to walk away believing the
      // message was sent.
      cStatus.setAttribute('role', ok ? 'status' : 'alert');
      cStatus.textContent = text;
    };

    var setSending = function (on) {
      sending = on;
      if (!cSubmit) return;
      // aria-disabled, not `disabled`: disabling the focused element throws focus
      // back to <body>, so a keyboard visitor loses their place mid-submit.
      cSubmit.setAttribute('aria-disabled', String(on));
      if (cSubmitLabel) cSubmitLabel.textContent = on ? 'Sending…' : cSubmitText;
    };

    cForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      setSending(true);

      // A stalled connection must not leave the button reading "Sending…" for
      // ever — without a deadline the promise can simply never settle.
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl && window.setTimeout(function () { ctrl.abort(); }, 15000);

      fetch(cForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(cForm),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (data) {
          if (data && data.success) {
            cForm.reset();
            setStatus('Thanks — your message is on its way. I usually reply within a day or two.', true);
          } else {
            setStatus('Something went wrong — the message did not send. Please try again, or reach me on LinkedIn.', false);
          }
        })
        .catch(function () {
          setStatus('Network error — the message did not send. Please try again, or reach me on LinkedIn.', false);
        })
        .then(function () {
          if (timer) window.clearTimeout(timer);
          setSending(false);
        });
    });
  }

  /* ---------- 8. Deferred mailto ----------
     The address is not published on the page, so the envelope icon carries it
     base64-encoded and the real href is written on the first hover, focus or
     click. Harvesters that grep the served HTML for `mailto:` find nothing;
     anyone who opens devtools still can — this is anti-scraping, not secrecy.
     Without JS the link falls back to its #contact href, which lands on the form. */
  document.querySelectorAll('[data-m]').forEach(function (a) {
    var armed = false;

    function arm() {
      if (armed) return;
      armed = true;
      try {
        a.href = 'mailto:' + atob(a.dataset.m);
      } catch (err) {
        armed = false;           // leave the #contact fallback in place
      }
    }

    // contextmenu/auxclick are in here so "copy link address" and middle-click
    // get the real address even when the cursor was already parked on the icon
    // at load and no pointerenter ever fired.
    ['pointerenter', 'focus', 'touchstart', 'contextmenu', 'auxclick'].forEach(function (evt) {
      a.addEventListener(evt, arm, { passive: true });
    });

    // A plain click can arrive with no prior hover. Arm, then navigate
    // explicitly — mutating href mid-click is not reliably picked up by the
    // default action. Modified clicks are left alone so the browser's own
    // open-in-new-tab / save behaviour still works.
    a.addEventListener('click', function (e) {
      arm();
      var plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
      if (armed && plain) {
        e.preventDefault();
        window.location.href = a.href;
      }
    });
  });

  /* ---------- 9. Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
