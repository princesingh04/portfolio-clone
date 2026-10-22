(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var revealsStarted = false;

  function rafThrottle(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        fn();
      });
    };
  }

  function initReveals() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  function startReveals() {
    if (revealsStarted) return;
    revealsStarted = true;
    initReveals();
  }

  function runIntro() {
    var intro = document.getElementById('intro');
    if (!intro || root.dataset.intro === 'seen' || reduceMotion) {
      if (intro) intro.style.display = 'none';
      startReveals();
      return;
    }

    var top = document.getElementById('intro-top');
    var bottom = document.getElementById('intro-bottom');
    var steps = 56;
    var seam = [];
    var i;

    for (i = 0; i <= steps; i++) {
      var x = (i / steps) * 100;
      var y = 50 + Math.sin(i * 0.7) * 1.1 + (Math.random() - 0.5) * 1.6;
      if (i === 0 || i === steps) y = 50;
      seam.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }

    function polygon(points) {
      return 'polygon(' + points.map(function (point) {
        return point[0] + '% ' + point[1] + '%';
      }).join(', ') + ')';
    }

    var reversed = seam.slice().reverse();
    var topShape = polygon([[0, 0], [100, 0]].concat(reversed));
    var bottomShape = polygon([[0, 100], [100, 100]].concat(reversed));

    if (top) {
      top.style.clipPath = topShape;
      top.style.webkitClipPath = topShape;
    }
    if (bottom) {
      bottom.style.clipPath = bottomShape;
      bottom.style.webkitClipPath = bottomShape;
    }

    requestAnimationFrame(function () {
      setTimeout(function () {
        intro.classList.add('intro--go');
      }, 480);
    });

    setTimeout(function () {
      root.dataset.intro = 'seen';
      intro.style.display = 'none';
      try {
        sessionStorage.setItem('intro-seen', '1');
      } catch (error) {}
      startReveals();
    }, 1680);
  }

  function createField() {
    var canvas = document.getElementById('field');
    if (!canvas || !canvas.getContext) return { refresh: function () {} };

    var ctx = canvas.getContext('2d');
    var width = 0;
    var height = 0;
    var dpr = 1;
    var gap = 20;
    var dots = [];
    var pointerX = -9999;
    var pointerY = -9999;
    var frame = 0;
    var resizeTimer = 0;
    var ink = [238, 230, 214];
    var amber = [214, 150, 44];
    var reduced = reduceMotion;
    var finePointer = window.matchMedia('(pointer: fine)').matches;

    function readPalette() {
      var inkRgb = getComputedStyle(root).getPropertyValue('--ink-rgb').trim().split(/\s+/).map(Number);
      var amberRgb = getComputedStyle(root).getPropertyValue('--amber-rgb').trim().split(/\s+/).map(Number);
      if (inkRgb.length === 3 && inkRgb.every(function (n) { return !isNaN(n); })) ink = inkRgb;
      if (amberRgb.length === 3 && amberRgb.every(function (n) { return !isNaN(n); })) amber = amberRgb;
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 1.5));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function build() {
      dots = [];
      for (var y = 10; y < height; y += gap) {
        for (var x = 10; x < width; x += gap) {
          dots.push({ x: x, y: y, dx: 0, dy: 0 });
        }
      }
    }

    function draw() {
      if (!width || !height) return false;
      ctx.clearRect(0, 0, width, height);

      if (pointerX > -1000) {
        var glow = ctx.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 204);
        glow.addColorStop(0, 'rgba(' + amber.join(',') + ', 0.10)');
        glow.addColorStop(1, 'rgba(' + amber.join(',') + ', 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(pointerX - 204, pointerY - 204, 408, 408);
      }

      var moving = false;
      var radius = 170;
      var force = 42;

      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var dx = dot.x - pointerX;
        var dy = dot.y - pointerY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var targetX = 0;
        var targetY = 0;
        var power = 0;

        if (dist < radius && dist > 0.01) {
          power = 1 - dist / radius;
          targetX = (dx / dist) * power * power * force;
          targetY = (dy / dist) * power * power * force;
        }

        dot.dx += (targetX - dot.dx) * 0.14;
        dot.dy += (targetY - dot.dy) * 0.14;

        if (Math.abs(dot.dx - targetX) > 0.05 || Math.abs(dot.dy - targetY) > 0.05) moving = true;

        var heat = Math.max(power, Math.min(1, Math.sqrt(dot.dx * dot.dx + dot.dy * dot.dy) / 25.2));
        var color = heat > 0.02 ? amber : ink;
        var alpha = heat > 0.02 ? 0.16 + 0.75 * heat : 0.14;
        var size = 1.4 + 1.8 * heat;

        ctx.fillStyle = 'rgba(' + color.join(',') + ', ' + alpha.toFixed(3) + ')';
        ctx.fillRect(dot.x + dot.dx - size / 2, dot.y + dot.dy - size / 2, size, size);
      }

      return moving;
    }

    function step() {
      frame = 0;
      if (reduced) {
        draw();
        return;
      }
      if (draw()) frame = requestAnimationFrame(step);
    }

    function start() {
      if (reduced || frame) return;
      frame = requestAnimationFrame(step);
    }

    function onPointerMove(event) {
      if (reduced || !finePointer || event.pointerType === 'touch') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      start();
    }

    function onPointerLeave() {
      pointerX = -9999;
      pointerY = -9999;
      start();
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        build();
        draw();
      }, 120);
    }

    function onVisibility() {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      } else {
        draw();
        start();
      }
    }

    function onMotionChange(event) {
      reduced = event.matches;
      if (reduced) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        for (var i = 0; i < dots.length; i++) {
          dots[i].dx = 0;
          dots[i].dy = 0;
        }
        pointerX = -9999;
        pointerY = -9999;
        draw();
      } else {
        start();
      }
    }

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', onMotionChange);
    } else if (motionQuery.addListener) {
      motionQuery.addListener(onMotionChange);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize, { passive: true });

    readPalette();
    resize();
    build();
    draw();

    return {
      refresh: function () {
        readPalette();
        draw();
        start();
      }
    };
  }

  function initTheme(field) {
    var toggle = document.getElementById('theme-toggle');

    function currentTheme() {
      return root.dataset.theme === 'light' ? 'light' : 'dark';
    }

    function applyTheme(theme, persist) {
      if (theme === 'light') {
        root.dataset.theme = 'light';
      } else {
        delete root.dataset.theme;
      }

      if (themeMeta) {
        themeMeta.setAttribute('content', theme === 'light' ? '#f7f1e6' : '#15120e');
      }

      if (toggle) {
        toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
        toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      }

      if (persist) {
        try {
          if (theme === 'light') {
            localStorage.setItem('theme', 'light');
          } else {
            localStorage.removeItem('theme');
          }
        } catch (error) {}
      }

      field.refresh();
    }

    applyTheme(currentTheme(), false);

    if (toggle) {
      toggle.addEventListener('click', function () {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
      });
    }
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initHeatmap() {
    var grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    var monthsEl = document.getElementById('heatmap-months');
    var totalEl = document.getElementById('contrib-total');
    var tip = document.getElementById('heatmap-tip');
    var scrollBox = grid.closest('.heatmap__scroll');

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - 52 * 7);

    var random = mulberry32(today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate());
    var cells = document.createDocumentFragment();
    var months = document.createDocumentFragment();
    var total = 0;

    function levelFor(count) {
      if (count <= 0) return 0;
      if (count <= 2) return 1;
      if (count <= 5) return 2;
      if (count <= 9) return 3;
      return 4;
    }

    function countFor(date) {
      if (date > today) return -1;
      if (random() < 0.1) return 0;
      var value = Math.pow(random(), 1.9) * 18;
      var day = date.getDay();
      if (day === 0 || day === 6) value *= 0.45;
      if (random() < 0.025) value += 7 + random() * 8;
      return Math.floor(value);
    }

    function dateLabel(date) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    for (var week = 0; week < 53; week++) {
      var hasFirst = false;

      for (var day = 0; day < 7; day++) {
        var date = new Date(start);
        date.setDate(start.getDate() + week * 7 + day);

        var cell = document.createElement('span');
        cell.className = 'heatmap__cell';
        cell.setAttribute('aria-hidden', 'true');

        if (date > today) {
          cell.classList.add('is-future');
        } else {
          var count = countFor(date);
          var level = levelFor(count);
          if (level) cell.classList.add('l' + level);
          if (date.getTime() === today.getTime()) cell.classList.add('is-today');
          total += count;
          cell.dataset.label = (count === 0 ? 'No contributions' : count + (count === 1 ? ' contribution' : ' contributions')) + ' on ' + dateLabel(date);
          cell.dataset.count = String(count);
        }

        cells.appendChild(cell);

        if (date.getDate() === 1) hasFirst = true;
      }

      if (hasFirst) {
        var first = new Date(start);
        first.setDate(start.getDate() + week * 7);
        var monthDate = null;
        for (var offset = 0; offset < 7; offset++) {
          var probe = new Date(first);
          probe.setDate(first.getDate() + offset);
          if (probe.getDate() === 1) {
            monthDate = probe;
            break;
          }
        }
        if (monthDate) {
          var label = document.createElement('span');
          label.textContent = monthDate.toLocaleDateString(undefined, { month: 'short' });
          label.style.gridColumn = String(week + 1);
          months.appendChild(label);
        }
      }
    }

    grid.appendChild(cells);
    if (monthsEl) monthsEl.appendChild(months);
    if (totalEl) totalEl.textContent = total.toLocaleString();
    grid.setAttribute('aria-label', total.toLocaleString() + ' contributions in the last year');

    if (tip && grid) {
      grid.addEventListener('pointerover', function (event) {
        var cell = event.target.closest('.heatmap__cell');
        if (!cell || !cell.dataset.label) {
          tip.classList.remove('is-on');
          return;
        }
        var rect = cell.getBoundingClientRect();
        tip.textContent = cell.dataset.label;
        tip.style.left = (rect.left + rect.width / 2) + 'px';
        tip.style.top = rect.top + 'px';
        tip.classList.add('is-on');
      });

      grid.addEventListener('pointerout', function (event) {
        var to = event.relatedTarget;
        if (to && to.closest && to.closest('.heatmap__cell')) return;
        tip.classList.remove('is-on');
      });

      if (scrollBox) {
        scrollBox.addEventListener('scroll', function () {
          tip.classList.remove('is-on');
        }, { passive: true });
      }
    }

    if (scrollBox) {
      requestAnimationFrame(function () {
        if (scrollBox.scrollWidth > scrollBox.clientWidth) {
          scrollBox.scrollLeft = scrollBox.scrollWidth;
        }
      });
    }
  }

  var CASES = {
    'role-independent': {
      path: '~/experience/independent',
      title: 'Senior Full-Stack Developer',
      meta: 'Independent · Remote · 2024 — Present',
      body: '<h3>Context</h3><p>After two years inside product teams I went independent to work closer to the decisions that shape a product. Most engagements start with a founder, a rough idea, and a deadline.</p><h3>What I owned</h3><ul><li>Architecture and delivery for SaaS analytics, headless commerce, and internal tools.</li><li>Database schemas, APIs, background workers, and the React interfaces on top of them.</li><li>Deployment, observability, and the boring parts that keep a product online.</li></ul><h3>How I work</h3><p>Short feedback loops. I ship a usable slice early, then harden it: indexes before dashboards get slow, loading and empty states before launch, tests around the paths that cost money when they break.</p><h3>Outcome</h3><p>The analytics platform I rebuilt now ingests more than two million events a day, and every engagement since has shipped without a hand-off team.</p>',
      stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS']
    },
    'role-northwind': {
      path: '~/experience/northwind',
      title: 'Full-Stack Developer',
      meta: 'Northwind Labs · Full-time · 2022 — 2024',
      body: '<h3>Context</h3><p>Northwind was moving from client sites to a product: a headless commerce platform that small merchants could run themselves.</p><h3>What I built</h3><ul><li>Storefront and checkout flow on Next.js, Prisma, and Stripe.</li><li>Admin dashboard for catalogue, orders, and discounts.</li><li>Redis-backed cart and session layer.</li><li>The first design-system primitives and CI pipeline.</li></ul><h3>The hard part</h3><p>Checkout latency was the conversion bottleneck. Profiling showed repeated product lookups and a serial payment path. Caching the read-heavy parts and trimming the request chain brought median checkout time down 38%.</p><h3>Outcome</h3><p>40+ merchants on the platform, a shared component library, and two junior developers who took over features without me in the room.</p>',
      stack: ['Next.js', 'Prisma', 'Stripe', 'Redis', 'TypeScript']
    },
    'role-pixel': {
      path: '~/experience/pixel-and-co',
      title: 'Frontend Developer',
      meta: 'Pixel & Co. · Full-time · 2021 — 2022',
      body: '<h3>Context</h3><p>Pixel & Co. built marketing sites and internal dashboards for fintech clients, usually on tight launch schedules.</p><h3>What I changed</h3><ul><li>Rebuilt the front-end stack around TypeScript, React, and a small set of shared components.</li><li>Introduced performance budgets and measured every build before hand-off.</li><li>Used GSAP for the few moments that needed motion, and CSS for everything else.</li></ul><h3>Outcome</h3><p>Every client build shipped at 98+ Lighthouse performance, and the component library cut the start of the next project from weeks to days.</p>',
      stack: ['TypeScript', 'React', 'GSAP', 'CSS']
    },
    'role-crafted': {
      path: '~/experience/crafted',
      title: 'Junior Web Developer',
      meta: 'Crafted Web Studio · Full-time · 2020 — 2021',
      body: '<h3>Context</h3><p>Crafted was a small studio where everyone touched every part of a project. My first year was fifteen client websites, from first call to launch.</p><h3>What I learned</h3><ul><li>Responsive builds in HTML, CSS, JavaScript, PHP, and WordPress.</li><li>Scoping with clients, handling content, and fixing launch-day surprises.</li><li>How to maintain a site after the invoice is paid.</li></ul><h3>Outcome</h3><p>15+ sites shipped, and the habit of owning a project end to end instead of waiting for a ticket.</p>',
      stack: ['JavaScript', 'PHP', 'MySQL', 'WordPress']
    },
    'project-lumen': {
      path: '~/work/lumen-analytics',
      title: 'Lumen Analytics',
      meta: 'Product analytics · 2026 · Built independently',
      body: '<h3>The problem</h3><p>Product teams needed funnels and retention answers without waiting on a data team. The first version had to stay useful at two million events a day.</p><h3>What I built</h3><ul><li>Event ingestion with idempotent writes and batched inserts.</li><li>Funnel, retention cohort, and segmentation queries over Postgres.</li><li>A dashboard builder with saved views and shareable links.</li><li>Realtime counters backed by Redis.</li></ul><h3>Hard parts</h3><p>Retention queries are expensive when written naively. Materialised daily rollups and careful indexing keep the common views under a second while raw events remain queryable.</p><h3>Outcome</h3><p>2M+ events a day, sub-second dashboards for the default views, and a query layer the team can extend without touching the UI.</p>',
      stack: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'TypeScript']
    },
    'project-cartly': {
      path: '~/work/cartly-commerce',
      title: 'Cartly Commerce',
      meta: 'Headless commerce · 2025 · Product work',
      body: '<h3>The problem</h3><p>Merchants wanted a storefront that looked custom but did not want to rebuild checkout, payments, and order management for every launch.</p><h3>What I built</h3><ul><li>A storefront builder with reusable sections and theme tokens.</li><li>Stripe checkout with subscriptions and one-off purchases.</li><li>Admin tooling for catalogue, orders, refunds, and discounts.</li><li>Multi-tenant routing and per-merchant domains.</li></ul><h3>Hard parts</h3><p>Checkout has to stay correct when a webhook arrives twice. Every payment path is keyed and replayed safely, and every failed step leaves the order in a state support can reason about.</p><h3>Outcome</h3><p>40+ merchants served on the platform, with checkout latency down 38% versus the original flow.</p>',
      stack: ['Next.js', 'Prisma', 'Stripe', 'PostgreSQL']
    },
    'project-nimbus': {
      path: '~/work/nimbus-chat',
      title: 'Nimbus Chat',
      meta: 'Realtime messaging · 2025 · Built with a small team',
      body: '<h3>The problem</h3><p>Team chat is easy to prototype and hard to make dependable: presence, ordering, reconnects, and notifications all compete for attention.</p><h3>What I built</h3><ul><li>Socket.IO gateway with a Redis adapter for horizontal scaling.</li><li>Optimistic message sends with server reconciliation.</li><li>Threads, typing indicators, and unread state.</li><li>End-to-end encrypted direct messages using per-device keys.</li></ul><h3>Hard parts</h3><p>Reconnect storms after deploys were the real boss fight. Exponential backoff, resume tokens, and idempotent message IDs made reconnects invisible instead of duplicating history.</p><h3>Outcome</h3><p>A messaging layer that survives deploys and slow networks, with history that stays ordered across devices.</p>',
      stack: ['Socket.IO', 'Redis', 'React', 'Node.js']
    },
    'project-frameflow': {
      path: '~/work/frameflow-ai',
      title: 'Frameflow AI',
      meta: 'AI video tool · 2024 · Built independently',
      body: '<h3>The problem</h3><p>Creators had hours of long-form video and no time to cut it into shorts. Existing tools made them choose between speed and control.</p><h3>What I built</h3><ul><li>Upload and transcription pipeline with progress updates.</li><li>Clip suggestions scored on speech density and scene changes.</li><li>Auto captions and crop paths that track the speaker.</li><li>FFmpeg render workers with a queue and retries.</li></ul><h3>Hard parts</h3><p>Video work is expensive and failure-prone. Jobs are resumable, renders are chunked, and every intermediate file is tracked so a failed worker does not restart the whole project.</p><h3>Outcome</h3><p>A workflow that turns a one-hour recording into ready-to-post clips without leaving the browser.</p>',
      stack: ['Node.js', 'OpenAI', 'FFmpeg', 'React']
    },
    'note-frames': {
      path: '~/writing/frames',
      title: "A portfolio that doesn't drop frames",
      meta: 'Performance note · Oct 2026 · 5 min read',
      body: '<h3>The brief</h3><p>This page has a dot field, reveals, a timeline, and a heatmap. None of it should cost a frame on an old laptop.</p><h3>What I did</h3><ul><li>One small canvas instead of a DOM node per dot, and it only animates while the pointer is nearby.</li><li>IntersectionObserver for reveals; elements are unobserved once they appear.</li><li>Scroll and resize work batched into a single rAF pass.</li><li>Device pixel ratio capped so the canvas stays sharp without doubling its pixel budget.</li></ul><h3>What I skipped</h3><p>No scroll hijacking, no permanent rAF loop, no animation library for four transitions. Reduced motion turns the whole thing down to a static field.</p><h3>Takeaway</h3><p>Most jank is work that runs when nothing is happening. Make idle mean idle and the page feels fast on hardware that is not.</p>',
      stack: ['HTML', 'CSS', 'JavaScript', 'Canvas', 'IntersectionObserver']
    },
    'note-idempotency': {
      path: '~/writing/idempotency',
      title: 'The webhook that charged twice',
      meta: 'Backend note · Aug 2026 · 6 min read',
      body: '<h3>What happened</h3><p>A customer was charged twice. The payment provider retried a webhook, the handler ran twice, and the second run created a new order.</p><h3>The fix</h3><ul><li>Store an idempotency key on every incoming event.</li><li>Add a unique constraint so only one handler can claim a key.</li><li>Make the handler transactional from claim to completion.</li><li>Return the original result when a duplicate arrives.</li></ul><h3>What changed in my process</h3><p>Retries are now part of the design, not an afterthought. I write the duplicate case into the first draft of any webhook handler.</p><h3>Takeaway</h3><p>At-least-once delivery is the default in distributed systems. Correctness lives in the handler, not in the hope that the provider sends once.</p>',
      stack: ['PostgreSQL', 'Stripe', 'Node.js']
    },
    'note-motion': {
      path: '~/writing/motion',
      title: 'Motion with manners',
      meta: 'Frontend note · Jun 2026 · 4 min read',
      body: '<h3>The usual mistake</h3><p>Reduced motion is often handled by removing every transition at the last minute. The page still works; it just loses the information the motion was carrying.</p><h3>A second design</h3><ul><li>Keep the hierarchy: content appears in the same order, just without the travel.</li><li>Replace movement with opacity or an instant state change.</li><li>Never hide content behind an animation that might not run.</li><li>Respect the setting before the first paint, not after hydration.</li></ul><h3>Takeaway</h3><p>Motion is a design material, not a garnish. If the reduced version feels unfinished, the original was doing too much.</p>',
      stack: ['CSS', 'Accessibility', 'Motion']
    }
  };

  function initDialog() {
    var dialog = document.getElementById('case-dialog');
    if (!dialog) return;

    var pathEl = document.getElementById('case-path');
    var titleEl = document.getElementById('case-title');
    var metaEl = document.getElementById('case-meta');
    var bodyEl = document.getElementById('case-body');
    var stackEl = document.getElementById('case-stack');
    var closeBtn = dialog.querySelector('.dialog__close');
    var opener = null;

    function openCase(key, trigger) {
      var data = CASES[key];
      if (!data) return;

      pathEl.textContent = data.path;
      titleEl.textContent = data.title;
      metaEl.textContent = data.meta;
      bodyEl.innerHTML = data.body;
      dialog.querySelector('.dialog__inner').scrollTop = 0;

      if (data.stack && data.stack.length) {
        stackEl.innerHTML = data.stack.map(function (item) {
          return '<span class="tag">' + item + '</span>';
        }).join('');
        stackEl.hidden = false;
      } else {
        stackEl.innerHTML = '';
        stackEl.hidden = true;
      }

      opener = trigger || null;

      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }

      document.body.classList.add('modal-open');
    }

    function closeCase() {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
        document.body.classList.remove('modal-open');
      }
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-case]');
      if (!trigger) return;
      event.preventDefault();
      openCase(trigger.dataset.case, trigger);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeCase);

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeCase();
    });

    dialog.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    });
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {}
    area.remove();
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }, function () {
        return legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function initCopyEmail() {
    var button = document.getElementById('copy-email');
    if (!button) return;

    var label = button.textContent.trim();
    var timer = 0;

    button.addEventListener('click', function () {
      var email = button.dataset.email || 'hello@princesingh.dev';
      button.style.minWidth = button.getBoundingClientRect().width + 'px';
      copyText(email).then(function (ok) {
        button.textContent = ok ? 'Copied!' : 'Copy failed';
        clearTimeout(timer);
        timer = setTimeout(function () {
          button.textContent = label;
          button.style.minWidth = '';
        }, 1600);
      });
    });
  }

  function initScrollUI() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.dock__link'));
    var sections = links.map(function (link) {
      return { link: link, target: document.getElementById(link.dataset.section) };
    }).filter(function (item) {
      return item.target;
    });

    var timeline = document.querySelector('.timeline');
    var fill = document.getElementById('timeline-fill');
    var tip = document.getElementById('heatmap-tip');

    function update() {
      var anchor = window.scrollY + window.innerHeight * 0.38;
      var activeId = 'top';

      sections.forEach(function (item) {
        var top = item.target.getBoundingClientRect().top + window.scrollY;
        if (top <= anchor) activeId = item.target.id;
      });

      links.forEach(function (link) {
        var active = link.dataset.section === activeId;
        link.classList.toggle('is-active', active);
        if (active) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });

      if (timeline && fill) {
        var rect = timeline.getBoundingClientRect();
        var top = rect.top + window.scrollY;
        var height = timeline.offsetHeight || 1;
        var progress = (window.scrollY + window.innerHeight * 0.62 - top) / height;
        progress = Math.max(0, Math.min(1, progress));
        fill.style.transform = 'scaleY(' + progress.toFixed(4) + ')';
      }

      if (tip) tip.classList.remove('is-on');
    }

    var onScroll = rafThrottle(update);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  var field = createField();

  initTheme(field);
  initHeatmap();
  initDialog();
  initCopyEmail();
  initScrollUI();
  runIntro();
})();
