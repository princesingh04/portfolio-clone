/* =========================================
   Helpers
   ========================================= */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================
   Custom cursor
   ========================================= */
const cursorDot = document.getElementById('cursor-dot');
const cursorOutline = document.getElementById('cursor-outline');

if (window.matchMedia('(pointer: fine)').matches) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let outlineX = targetX;
  let outlineY = targetY;
  let rafId = null;
  let positioned = false;

  const renderCursor = () => {
    outlineX += (targetX - outlineX) * 0.2;
    outlineY += (targetY - outlineY) * 0.2;
    cursorDot.style.transform =
      `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
    cursorOutline.style.transform =
      `translate3d(${outlineX}px, ${outlineY}px, 0) translate(-50%, -50%)`;

    if (Math.abs(targetX - outlineX) > 0.2 || Math.abs(targetY - outlineY) > 0.2) {
      rafId = requestAnimationFrame(renderCursor);
    } else {
      rafId = null;
    }
  };

  window.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!positioned) {
      positioned = true;
      outlineX = targetX;
      outlineY = targetY;
    }
    if (rafId === null) rafId = requestAnimationFrame(renderCursor);
  }, { passive: true });

  cursorDot.style.transform =
    `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
  cursorOutline.style.transform =
    `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;

  const hoverSelector =
    'a, button, .work-card, .service-row, .social-link, .filter-btn, .t-dot, input, select, textarea';

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverSelector)) document.body.classList.add('cursor-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverSelector)) document.body.classList.remove('cursor-hover');
  });
} else {
  cursorDot.style.display = 'none';
  cursorOutline.style.display = 'none';
}

/* =========================================
   Three.js — dot globe
   ========================================= */
let scene, camera, renderer, clock;
let sphereGroup, dotSphere, outlineCore;
let floats = [];
let mouseTarget = { x: 0, y: 0 };
let mouse = { x: 0, y: 0 };
let heroVisible = true;
let elapsed = 0;

function initThree() {
  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('hero-canvas');
  const mobile = window.innerWidth < 900;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8.6);

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  clock = new THREE.Clock();

  sphereGroup = new THREE.Group();
  scene.add(sphereGroup);

  /* Fibonacci sphere of points */
  const count = mobile ? 850 : 1800;
  const radius = 2.55;
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    size: mobile ? 0.03 : 0.022,
    color: 0xd9ff3f,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });

  dotSphere = new THREE.Points(geo, mat);
  sphereGroup.add(dotSphere);

  /* Faint inner wireframe */
  outlineCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf3f0e8,
      wireframe: true,
      transparent: true,
      opacity: 0.045
    })
  );
  sphereGroup.add(outlineCore);

  /* Orbit rings */
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(3.0, 0.005, 6, 140),
    new THREE.MeshBasicMaterial({ color: 0xd9ff3f, transparent: true, opacity: 0.3 })
  );
  ring1.rotation.x = Math.PI / 2.15;
  ring1.rotation.y = 0.25;
  sphereGroup.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.004, 6, 140),
    new THREE.MeshBasicMaterial({ color: 0xf3f0e8, transparent: true, opacity: 0.1 })
  );
  ring2.rotation.x = Math.PI / 1.65;
  ring2.rotation.y = -0.4;
  sphereGroup.add(ring2);

  /* Small floating wireframe accents */
  const limeWire = () =>
    new THREE.MeshBasicMaterial({
      color: 0xd9ff3f,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });

  const octa = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), limeWire());
  octa.position.set(2.1, 1.8, 0.7);
  sphereGroup.add(octa);
  floats.push(octa);

  const tetra = new THREE.Mesh(
    new THREE.TetrahedronGeometry(0.28),
    new THREE.MeshBasicMaterial({
      color: 0xf3f0e8,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    })
  );
  tetra.position.set(-2.1, -1.6, 1);
  sphereGroup.add(tetra);
  floats.push(tetra);

  /* Background dust */
  const dustCount = mobile ? 80 : 140;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 24;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.02,
      color: 0xf3f0e8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  );
  scene.add(dust);

  layoutScene();

  const heroSection = document.getElementById('home');
  if (heroSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
    }, { threshold: 0 }).observe(heroSection);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    layoutScene();
  });

  window.addEventListener('mousemove', (e) => {
    mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  animate();
}

function layoutScene() {
  if (!sphereGroup) return;
  const w = window.innerWidth;

  if (w > 1200) {
    sphereGroup.position.set(3.4, 0, -0.6);
    sphereGroup.scale.setScalar(1);
  } else if (w > 900) {
    sphereGroup.position.set(2.7, 0, -0.4);
    sphereGroup.scale.setScalar(0.9);
  } else {
    sphereGroup.position.set(0.9, -1.5, -1);
    sphereGroup.scale.setScalar(0.6);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  if (!heroVisible || document.hidden) return;

  elapsed += dt;
  const t = elapsed;

  mouse.x += (mouseTarget.x - mouse.x) * 0.04;
  mouse.y += (mouseTarget.y - mouse.y) * 0.04;

  sphereGroup.rotation.y = t * 0.12 + mouse.x * 0.4;
  sphereGroup.rotation.x = 0.16 + mouse.y * 0.18 + Math.sin(t * 0.3) * 0.04;

  floats.forEach((f, i) => {
    f.rotation.x += dt * 0.36;
    f.rotation.y += dt * 0.48;
    f.position.y += Math.sin(t * 1.1 + i * 2) * dt * 0.048;
  });

  camera.position.x = mouse.x * 0.4;
  camera.position.y = mouse.y * 0.3;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

/* =========================================
   Preloader + hero reveal
   ========================================= */
function initPreloader() {
  const pre = document.getElementById('preloader');
  const hasGSAP = typeof gsap !== 'undefined';

  if (!pre || reduceMotion || !hasGSAP) {
    if (pre) pre.style.display = 'none';
    document.body.classList.remove('loading');
    if (hasGSAP) showHero();
    return;
  }

  const num = document.getElementById('loader-count');
  const bar = document.querySelector('.loader-bar span');
  const state = { v: 0 };

  gsap.to(state, {
    v: 100,
    duration: 1.35,
    ease: 'power2.inOut',
    onUpdate() {
      num.textContent = Math.round(state.v);
      bar.style.width = `${state.v}%`;
    },
    onComplete() {
      const tl = gsap.timeline({
        onComplete() {
          pre.style.display = 'none';
          document.body.classList.remove('loading');
          showHero();
        }
      });

      tl.to('.loader-center', { opacity: 0, y: -30, duration: 0.4, ease: 'power2.in' })
        .to('#preloader', { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '-=0.1');
    }
  });
}

function showHero() {
  if (lenis) lenis.start();

  if (reduceMotion) {
    gsap.set('.hero-kicker, .hero-sub, .hero-cta, .hero-meta, .hero-bottom', { opacity: 1, y: 0 });
    gsap.set('.line-inner', { yPercent: 0 });
    return;
  }

  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .to('.hero-kicker', { opacity: 1, y: 0, duration: 0.8 })
    .to('.line-inner', { yPercent: 0, duration: 1.1, stagger: 0.12 }, '-=0.45')
    .to('.hero-sub', { opacity: 1, y: 0, duration: 0.8 }, '-=0.65')
    .to('.hero-cta', { opacity: 1, y: 0, duration: 0.8 }, '-=0.65')
    .to('.hero-meta', { opacity: 1, y: 0, duration: 0.8 }, '-=0.7')
    .to('.hero-bottom', { opacity: 1, duration: 0.9 }, '-=0.6');
}

/* =========================================
   GSAP section reveals
   ========================================= */
function initGSAP() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  /* initial hero states (hidden behind preloader) */
  gsap.set('.hero-kicker, .hero-sub, .hero-cta, .hero-meta', { opacity: 0, y: 26 });
  gsap.set('.hero-bottom', { opacity: 0 });
  gsap.set('.line-inner', { yPercent: 110 });

  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 46 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      }
    );
  });

  /* service rows */
  gsap.fromTo('.service-row',
    { opacity: 0, y: 34 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.service-list', start: 'top 82%', once: true }
    }
  );

  /* experience timeline */
  gsap.fromTo('.timeline-item',
    { opacity: 0, y: 34 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.timeline', start: 'top 82%', once: true }
    }
  );

  gsap.fromTo('.resume-side > *',
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.resume-side', start: 'top 85%', once: true }
    }
  );

  /* about orb */
  gsap.fromTo('.orb-wrap',
    { scale: 0.86, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 1.3,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.about-grid', start: 'top 78%', once: true }
    }
  );
}

/* =========================================
   Smooth scrolling (Lenis)
   ========================================= */
let lenis = null;

function initSmoothScroll() {
  if (reduceMotion || typeof Lenis === 'undefined' || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  lenis = new Lenis({ duration: 0.9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -84 });
    });
  });
}

/* =========================================
   Active nav link on scroll
   ========================================= */
function initScrollSpy() {
  const links = new Map();
  document.querySelectorAll('.nav-link').forEach((a) => {
    links.set(a.getAttribute('href').slice(1), a);
  });

  const sections = ['about', 'experience', 'work', 'services', 'testimonials', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.remove('active'));
        const link = links.get(entry.target.id);
        if (link) link.classList.add('active');
      });
    },
    { rootMargin: '-35% 0px -55% 0px' }
  );

  sections.forEach((s) => observer.observe(s));
}

/* =========================================
   Testimonials
   ========================================= */
function initTestimonials() {
  const slides = document.querySelectorAll('.testimonial');
  const dots = document.querySelectorAll('.t-dot');
  if (!slides.length || !dots.length) return;

  let index = 0;
  let timer;

  const show = (i) => {
    index = i;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  };

  const start = () => {
    clearInterval(timer);
    timer = setInterval(() => show((index + 1) % slides.length), 7000);
  };

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      show(i);
      start();
    });
  });

  const slider = document.querySelector('.testimonial-slider');
  if (slider && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else clearInterval(timer);
    }, { threshold: 0.1 }).observe(slider);
  }

  start();
}

/* =========================================
   Navigation + scroll progress
   ========================================= */
function initNav() {
  const nav = document.getElementById('nav');
  const progress = document.getElementById('scroll-progress');
  let ticking = false;

  const update = () => {
    const y = window.pageYOffset;

    nav.classList.toggle('is-scrolled', y > 40);

    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docH > 0 ? Math.min(Math.max(y / docH, 0), 1) : 0;
    progress.style.transform = `scaleX(${ratio})`;

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  update();
}

/* =========================================
   Projects
   ========================================= */
const projects = [
  {
    title: 'Lumen Analytics',
    category: 'saas',
    client: 'Lumen Labs',
    year: '2026',
    glyph: 'L',
    featured: true,
    desc: 'Real-time product analytics platform with funnels, retention cohorts, and a custom dashboard builder — ingesting 2M+ events a day.',
    tech: ['React', 'Node.js', 'PostgreSQL'],
    gradient: 'linear-gradient(135deg, #eaffa6 0%, #cdf24a 52%, #8fb81f 100%)'
  },
  {
    title: 'Cartly Commerce',
    category: 'web',
    client: 'Cartly',
    year: '2025',
    glyph: 'C',
    desc: 'Headless commerce platform with a storefront builder, Stripe checkout, and an admin dashboard serving 40+ merchants.',
    tech: ['Next.js', 'Prisma', 'Stripe'],
    gradient: 'linear-gradient(135deg, #ffc59f 0%, #ff7a45 55%, #c43a17 100%)'
  },
  {
    title: 'Nimbus Chat',
    category: 'web',
    client: 'Nimbus',
    year: '2025',
    glyph: 'N',
    light: true,
    desc: 'Realtime team messaging app with presence, typing indicators, threads, and end-to-end encrypted direct messages.',
    tech: ['Socket.IO', 'Redis', 'React'],
    gradient: 'linear-gradient(135deg, #a9c1ff 0%, #5872ff 55%, #2335a5 100%)'
  },
  {
    title: 'Frameflow AI',
    category: 'saas',
    client: 'Frameflow',
    year: '2024',
    glyph: 'F',
    desc: 'AI video repurposing tool that turns long-form content into short clips with auto captions and smart cropping.',
    tech: ['OpenAI', 'Node.js', 'FFmpeg'],
    gradient: 'linear-gradient(135deg, #ecdcff 0%, #b78cff 55%, #7b45e0 100%)'
  },
  {
    title: 'Trailhead',
    category: 'mobile',
    client: 'Trailhead Co.',
    year: '2024',
    glyph: 'T',
    desc: 'Trip planning app with offline maps, collaborative itineraries, and live expense splitting for groups.',
    tech: ['React Native', 'Expo', 'Supabase'],
    gradient: 'linear-gradient(135deg, #ffedc9 0%, #e8c583 52%, #bc8d45 100%)'
  },
  {
    title: 'DevPulse',
    category: 'web',
    client: 'DevPulse',
    year: '2023',
    glyph: 'D',
    desc: 'Developer productivity dashboard aggregating GitHub activity, PR review times, and deployment metrics in one view.',
    tech: ['TypeScript', 'GitHub API', 'D3'],
    gradient: 'linear-gradient(135deg, #ffd9e5 0%, #ff85ad 55%, #d33f76 100%)'
  },
  {
    title: 'Aperture 3D',
    category: 'web',
    client: 'Aperture Studio',
    year: '2023',
    glyph: 'A',
    light: true,
    desc: 'Interactive 3D product showcase for a design studio — WebGL scenes, scroll storytelling, and smooth 60fps transitions.',
    tech: ['Three.js', 'GSAP', 'Vite'],
    gradient: 'linear-gradient(135deg, #e2e2dd 0%, #a3a39c 50%, #4c4c47 100%)'
  }
];

const categoryLabels = { web: 'Web App', saas: 'SaaS', mobile: 'Mobile' };

const uiByTitle = {
  'Lumen Analytics': 'dash',
  'Cartly Commerce': 'shop',
  'Nimbus Chat': 'chat',
  'Frameflow AI': 'video',
  'Trailhead': 'phone',
  'DevPulse': 'dash',
  'Aperture 3D': 'shop'
};

projects.forEach((p) => { p.ui = uiByTitle[p.title] || 'dash'; });

function mockupHTML(type) {
  const chrome = `<div class="mockup__chrome"><i></i><i></i><i></i><span class="mockup__url"></span></div>`;

  if (type === 'chat') {
    return `<div class="mockup mockup--chat" aria-hidden="true">${chrome}<div class="mockup__content">
      <div class="m-chat">
        <div class="m-bubble"><span></span><span></span></div>
        <div class="m-bubble me"><span></span></div>
        <div class="m-bubble"><span></span></div>
        <div class="m-bubble me"><span></span><span></span></div>
      </div>
    </div></div>`;
  }

  if (type === 'shop') {
    return `<div class="mockup mockup--shop" aria-hidden="true">${chrome}<div class="mockup__content">
      <div class="m-shop">
        <div class="m-product is-featured"></div><div class="m-product"></div><div class="m-product"></div>
        <div class="m-product"></div><div class="m-product"></div><div class="m-product"></div>
      </div>
    </div></div>`;
  }

  if (type === 'phone') {
    return `<div class="mockup mockup--phone" aria-hidden="true">${chrome}<div class="mockup__content">
      <div class="m-phone">
        <div class="m-phone__head"><span></span><em></em></div>
        <div class="m-phone__hero"></div>
        <div class="m-phone__row"><span></span><span></span></div>
        <div class="m-phone__block"></div>
      </div>
    </div></div>`;
  }

  if (type === 'video') {
    return `<div class="mockup mockup--video" aria-hidden="true">${chrome}<div class="mockup__content">
      <div class="m-video">
        <div class="m-video__preview"></div>
        <div class="m-video__timeline"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </div></div>`;
  }

  return `<div class="mockup mockup--dash" aria-hidden="true">${chrome}<div class="mockup__content">
    <div class="m-side"><span></span><span></span><span></span><span></span></div>
    <div class="m-main">
      <div class="m-stats"><div class="m-stat"></div><div class="m-stat"></div><div class="m-stat"></div></div>
      <div class="m-chart">
        <i style="height:42%"></i><i style="height:64%"></i><i style="height:38%"></i>
        <i style="height:78%"></i><i style="height:56%"></i><i style="height:88%"></i><i style="height:66%"></i>
      </div>
    </div>
  </div></div>`;
}

function renderProjects(filter = 'all') {
  const grid = document.getElementById('work-grid');
  grid.innerHTML = '';

  const filtered = filter === 'all'
    ? projects
    : projects.filter((p) => p.category === filter);

  filtered.forEach((p, i) => {
    const isFeatured = filter === 'all' && p.featured;
    const card = document.createElement('article');
    card.className = `work-card${isFeatured ? ' featured' : ''}`;
    card.innerHTML = `
      <div class="work-card__media">
        <div class="work-card__thumb" style="background:${p.gradient}"></div>
        <span class="work-card__glyph${p.light ? ' light' : ''}">${p.glyph}</span>
        ${mockupHTML(p.ui)}
        <span class="work-card__num">${String(i + 1).padStart(2, '0')}</span>
        <span class="work-card__year">${p.year}</span>
      </div>
      <div class="work-card__content">
        <div class="work-card__tags">
          <span class="work-card__tag">${categoryLabels[p.category] || p.category}</span>
          ${p.tech.map((t) => `<span class="work-card__tag">${t}</span>`).join('')}
        </div>
        <h3 class="work-card__title">${p.title}</h3>
        <p class="work-card__desc">${p.desc}</p>
        <div class="work-card__meta">
          <span class="work-card__client">${p.client}</span>
          <span class="work-card__arrow">↗</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  bindTilt();

  if (!reduceMotion && typeof gsap !== 'undefined') {
    gsap.fromTo('.work-card',
      { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }
    );
  }

  if (window.ScrollTrigger) ScrollTrigger.refresh();
}

/* =========================================
   Card tilt
   ========================================= */
function bindTilt() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  document.querySelectorAll('.work-card').forEach((card) => {
    let frame = null;
    let rect = null;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = null;
      if (!rect) return;
      const x = (px - rect.left) / rect.width - 0.5;
      const y = (py - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(1100px) rotateX(${-y * 4}deg) rotateY(${x * 5}deg) translate3d(0, -5px, 0)`;
    };

    card.addEventListener('mouseenter', () => {
      rect = card.getBoundingClientRect();
    });

    card.addEventListener('mousemove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    });

    card.addEventListener('mouseleave', () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      card.style.transform = '';
    });
  });
}

/* =========================================
   Filters
   ========================================= */
function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderProjects(btn.dataset.filter);
    });
  });
}

/* =========================================
   Mobile menu
   ========================================= */
function initMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const links = document.querySelector('.nav-links');
  let open = false;

  const toggle = (state) => {
    open = state;
    if (open) {
      Object.assign(links.style, {
        display: 'flex',
        position: 'absolute',
        top: 'var(--nav-h)',
        left: '1rem',
        right: '1rem',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0.2rem',
        padding: '1rem',
        background: 'rgba(15, 15, 15, 0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--line)',
        borderRadius: '18px'
      });
      links.querySelectorAll('.nav-link').forEach((l) => {
        l.style.cssText = 'padding:0.9rem 1rem;text-align:center;font-size:0.95rem;';
      });
    } else {
      links.removeAttribute('style');
    }

    btn.querySelectorAll('span').forEach((s, i) => {
      if (open) {
        if (i === 0) s.style.transform = 'translateX(-50%) rotate(45deg) translate(0, 5px)';
        if (i === 1) s.style.opacity = '0';
        if (i === 2) s.style.transform = 'translateX(-50%) rotate(-45deg) translate(0, -5px)';
      } else {
        s.style.transform = 'translateX(-50%)';
        s.style.opacity = '1';
      }
    });
  };

  btn.addEventListener('click', () => toggle(!open));
  links.querySelectorAll('.nav-link').forEach((l) =>
    l.addEventListener('click', () => toggle(false))
  );

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && open) {
      toggle(false);
      links.removeAttribute('style');
    }
  });
}

/* =========================================
   Form
   ========================================= */
function initForm() {
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.form-btn');
    const original = btn.innerHTML;

    btn.innerHTML = 'Sending…';
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = 'Message sent ✓';
      btn.style.background = 'var(--ink)';
      btn.style.color = 'var(--bg)';

      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
        form.reset();
      }, 2200);
    }, 1200);
  });
}

/* =========================================
   Magnetic buttons
   ========================================= */
function initMagnetic() {
  if (!window.matchMedia('(pointer: fine)').matches || reduceMotion || typeof gsap === 'undefined') return;

  document.querySelectorAll('.magnetic').forEach((el) => {
    let rect = null;

    el.addEventListener('mouseenter', () => {
      rect = el.getBoundingClientRect();
    });

    el.addEventListener('mousemove', (e) => {
      if (!rect) return;
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * 0.22, y: y * 0.3, duration: 0.4, ease: 'power3.out' });
    });

    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

/* =========================================
   San Francisco clock
   ========================================= */
function initClock() {
  const local = document.getElementById('local-time');
  const footer = document.getElementById('footer-time');

  const update = () => {
    const t = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    if (local) local.textContent = `LOCAL — ${t}`;
    if (footer) footer.textContent = t;
  };

  update();
  setInterval(update, 30000);
}

/* =========================================
   Init
   ========================================= */
window.addEventListener('DOMContentLoaded', () => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  document.body.classList.add('loading');

  initThree();
  initGSAP();
  initSmoothScroll();
  initScrollSpy();
  initTestimonials();
  initNav();
  renderProjects();
  initFilters();
  initMenu();
  initForm();
  initMagnetic();
  initClock();
  initPreloader();
});