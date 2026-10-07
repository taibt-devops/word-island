'use strict';
/* Word Island — offline English vocabulary game. Runs from file:// : no fetch, no network.
   game.js   shared helpers, progress, sound, home, island map, wardrobe, free-practice modes
   levels.js level mode: rounds, hearts, boss, rewards */

const DATA = window.WORD_ISLAND;
const QUIZ_LEN = 8;
const SPELL_LEN = 5;
const SCORED = ['listen', 'look', 'spell'];
const TILTS = [-3, 2, -1.5, 2.5, -2.5, 1.5];
const LEVEL_COUNT = 9;   // 8 levels + the boss, per island

// ---------------------------------------------------------------- helpers
const $ = sel => document.querySelector(sel);
const PROPS = new Set(['value', 'checked', 'disabled']);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n) => shuffle(arr).slice(0, n);

const ICONS = {
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2v5.6h3.8l5 4.2V5l-5 4.2z" fill="currentColor"/><path d="M15.6 8.6a4.6 4.6 0 0 1 0 6.8M18.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5 16.5 12 9 19.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 5.6c2.7-1.5 5.8-1.4 9.2.6 3.4-2 6.5-2.1 9.2-.6v13c-2.7-1.4-5.8-1.3-9.2.7-3.4-2-6.5-2.1-9.2-.7z M12 6.2v13.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  ear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5a5 5 0 1 1 10 0c0 3.2-3 4.1-3 6.6a2.9 2.9 0 0 1-5.6 1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 10a2 2 0 1 1 3.6 1.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.6 10-6.6S22 12 22 12s-3.6 6.6-10 6.6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
  letters: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="9" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="12.5" y="7" width="9" height="12" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><text x="7" y="14.4" font-size="8" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Baloo 2, sans-serif">A</text><text x="17" y="16.4" font-size="8" font-weight="800" text-anchor="middle" fill="currentColor" font-family="Baloo 2, sans-serif">b</text></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4 14.9 8.5l6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6s-8.6-5.2-8.6-11.2A4.9 4.9 0 0 1 12 6.3a4.9 4.9 0 0 1 8.6 3.1c0 6-8.6 11.2-8.6 11.2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
  hat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.5h16M6.5 17.5c0-6 2.2-10 5.5-10s5.5 4 5.5 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
};

function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.innerHTML = ICONS[name];   // static, trusted markup
  return span;
}

const starIcon = on => icon('star', on ? 'star' : 'star off');
const starsRow = (n, max = 3) => h('span', { class: 'stars', 'aria-label': `${n} trên ${max} sao` },
  Array.from({ length: max }, (_, i) => starIcon(i < n)));
const art = (w, alt = '') => h('span', { class: 'sticker-art' }, h('img', { src: w.img, alt }));

// ---------------------------------------------------------------- progress
const SAVE_KEY = 'wordisland.v2';
const OLD_KEY = 'wordisland.v1';   // v1.0: practice stars per topic, no levels

const progress = (() => {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* corrupt or blocked */ }
  if (!p || p.v !== 2) {
    p = { v: 2, levels: {}, practice: {}, opened: [], hats: [], hat: null };
    try {   // carry v1.0 progress over: a played island opens, and its old stars clear that many levels
      const old = JSON.parse(localStorage.getItem(OLD_KEY)) || {};
      for (const t of DATA.topics) {
        const o = old[t.id];
        if (!o) continue;
        p.practice[t.id] = o;
        const stars = SCORED.reduce((s, m) => s + (o[m] || 0), 0);
        if (stars || o.learned) p.opened.push(t.id);
        p.levels[t.id] = Array.from({ length: LEVEL_COUNT }, (_, i) => (i < Math.min(8, stars) ? 1 : 0));
      }
    } catch { /* nothing to migrate */ }
  }
  for (const k of ['levels', 'practice', 'find']) p[k] = p[k] || {};
  for (const k of ['opened', 'hats']) p[k] = p[k] || [];
  return p;
})();
const saveProgress = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage off: play on */ } };

const practiceOf = id => progress.practice[id] || (progress.practice[id] = { learned: false, listen: 0, look: 0, spell: 0 });
const practiceStars = id => SCORED.reduce((sum, m) => sum + ((progress.practice[id] || {})[m] || 0), 0);
const levelStars = id => {
  const a = progress.levels[id] || (progress.levels[id] = []);
  while (a.length < LEVEL_COUNT) a.push(0);
  return a;
};
const islandStars = id => levelStars(id).reduce((a, b) => a + b, 0);
const islandCleared = id => levelStars(id).filter(Boolean).length;
const bossBeaten = t => levelStars(t.id)[LEVEL_COUNT - 1] > 0;
function islandUnlocked(t) {
  const i = DATA.topics.indexOf(t);
  return i === 0 || progress.opened.includes(t.id) || bossBeaten(DATA.topics[i - 1]);
}
const levelUnlocked = (t, i) => islandUnlocked(t) && (i === 0 || levelStars(t.id)[i - 1] > 0);
const totalStars = () => DATA.topics.reduce((sum, t) => sum + islandStars(t.id), 0);
const currentHat = () => (DATA.topics.find(t => t.hat && t.hat.id === progress.hat) || {}).hat || null;

// ---------------------------------------------------------------- sound
let audioCtx = null;
function tone(freq, start, dur, type = 'triangle', gain = 0.16) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* no audio device */ }
}
const sfx = {
  tap: () => tone(700, 0, 0.07, 'sine', 0.07),
  tick: () => tone(880, 0, 0.09, 'triangle', 0.1),
  pop: () => { tone(520, 0, 0.05, 'square', 0.06); tone(1040, 0.03, 0.08, 'sine', 0.1); },
  correct: () => [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.08, 0.2)),
  wrong: () => { tone(233, 0, 0.16, 'square', 0.05); tone(175, 0.14, 0.26, 'square', 0.05); },
  stars: n => [783.99, 987.77, 1174.66, 1567.98].slice(0, n + 1).forEach((f, i) => tone(f, 0.25 * i + 0.1, 0.3, 'sine', 0.12)),
  fanfare: () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.13, 0.28, 'triangle', 0.14)),
};

let playing = null;
function speak(src, text) {
  if (playing) playing.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (src) {
    playing = new Audio(src);
    playing.play().catch(() => robotSpeak(text));
  } else robotSpeak(text);
}
function robotSpeak(text) {   // fallback when an mp3 is missing
  if (!text || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}
const sayWord = w => speak(w.audio, w.en);
const saySentence = w => speak(w.sentence_audio, w.sentence);
const PHRASE_TEXT = {
  great: 'Great job!', excellent: 'Excellent!', 'well-done': 'Well done!', 'try-again': 'Oops! Try again.',
  welcome: "Hello! I'm Ollie. Let's learn English together!", ready: 'Ready? Go!', 'level-complete': 'Level complete!',
  'time-up': "Time's up!", 'oh-no': "Oh no! Let's try again.", boss: 'Here comes the boss! You can do it!',
  'you-win': 'You did it! Hooray!', treasure: 'Wow! A treasure chest!',
};
const sayPhrase = key => speak(DATA.phrases[key], PHRASE_TEXT[key]);

// ---------------------------------------------------------------- screen plumbing
let keyHandler = null;
let leaveHook = null;     // set by a screen that owns extra work (level loops) to stop it on navigation
let screenId = 0;
const timers = new Set();
function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; }
/** requestAnimationFrame loop for the current screen; dt in seconds, capped so a hidden app pauses time. */
function frameLoop(fn) {
  const id = screenId;
  let last = performance.now();
  const step = now => {
    if (id !== screenId) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fn(dt, now) !== false) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function show(scene, ...nodes) {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  keyHandler = null;
  screenId += 1;
  if (leaveHook) { const hook = leaveHook; leaveHook = null; hook(); }
  document.body.style.setProperty('--scene', `url("${DATA.backgrounds[scene] || DATA.backgrounds.island}")`);
  const app = $('#app');
  app.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));   // optional parts may be null
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

document.addEventListener('keydown', e => {
  if (keyHandler && !e.ctrlKey && !e.metaKey && !e.altKey) keyHandler(e);
});

const coverOf = t => t.words.find(w => w.id === t.cover) || t.words[0];

/** Cú Ollie with the hat he is wearing. `.pose('happy')` swaps the expression in place. */
function ollie(pose = 'base', cls = '') {
  const img = h('img', { src: DATA.mascot[pose] || DATA.mascot.base, alt: 'Cú Ollie' });
  const hat = currentHat();
  const wrap = h('span', { class: `ollie-wrap ${cls}`.trim() }, img, hat ? h('img', { class: 'hat', src: hat.img, alt: '' }) : null);
  wrap.pose = p => { img.src = DATA.mascot[p] || DATA.mascot.base; };
  return wrap;
}

function bar(title, sub, onBack, extra, color) {
  return h('header', { class: 'topbar', style: color ? `--topic:${color}` : null },
    h('button', { class: 'press round', 'aria-label': 'Quay lại', onclick: () => { sfx.tap(); onBack(); } }, icon('back')),
    h('h1', {}, title, sub ? h('small', {}, sub) : null),
    h('span', { class: 'spacer' }),
    extra || null);
}
const starPill = (n, max) => h('span', { class: 'pill', 'aria-label': `${n} sao` }, starIcon(true), `${n}/${max}`);
const topbar = (t, onBack, extra) => bar(t.en, t.vi, onBack, extra || starPill(practiceStars(t.id), 9), t.color);

// ---------------------------------------------------------------- home
function home(message) {
  const total = totalStars();
  const max = DATA.topics.length * LEVEL_COUNT * 3;
  const bubble = h('p', { class: 'bubble' }, message || (total === 0
    ? 'Chào bạn, mình là cú Ollie! Bắt đầu từ đảo Động vật nhé.'
    : `Bạn đã có ${total} ngôi sao. Vượt ải tiếp nào!`));
  const hats = DATA.topics.filter(t => t.hat).length;
  show('island',
    h('header', { class: 'home-head' },
      h('h1', { class: 'logo' }, 'Word Island', h('small', {}, 'Đảo Từ Vựng')),
      h('div', { class: 'ollie-say' },
        h('button', { class: 'ollie', 'aria-label': 'Nghe cú Ollie chào', onclick: () => sayPhrase('welcome') }, ollie('wave')),
        bubble),
      h('div', { class: 'home-side' },
        starPill(total, max),
        h('button', { class: 'press btn small', onclick: () => { sfx.tap(); wardrobe(); } }, icon('hat'), `Tủ mũ ${progress.hats.length}/${hats}`))),
    h('main', { class: 'topics' }, DATA.topics.map((t, i) => {
      const open = islandUnlocked(t);
      const card = h('button', {
        class: `sticker topic${open ? '' : ' locked'}`, style: `--tilt:${TILTS[i % TILTS.length]}deg; --topic:${t.color}`,
        'aria-label': open ? `${t.en}, ${t.vi}, đã qua ${islandCleared(t.id)} trên ${LEVEL_COUNT} ải` : `${t.en}, đang khoá`,
        onclick: () => {
          if (open) { sfx.tap(); islandScreen(t); return; }
          sfx.wrong();
          card.classList.remove('nope');
          void card.offsetWidth;
          card.classList.add('nope');
          bubble.textContent = `Đảo ${t.vi} còn khoá. Hãy đánh bại boss của đảo ${DATA.topics[i - 1].vi} trước nhé!`;
        },
      },
      h('span', { class: 'sticker-art' }, h('img', { src: coverOf(t).img, alt: '' }), open ? null : icon('lock', 'lock-badge')),
      h('span', { class: 'topic-en' }, t.en),
      h('span', { class: 'topic-vi' }, t.vi),
      open
        ? h('span', { class: 'topic-progress' }, `${islandCleared(t.id)}/${LEVEL_COUNT} ải`, starIcon(true), islandStars(t.id))
        : h('span', { class: 'topic-progress muted' }, 'Đang khoá'));
      return card;
    })));
}

// ---------------------------------------------------------------- island map
const NODE_GRID = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2]];   // snake path
const PATH_SVG = `<svg viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true"><polyline points="${
  NODE_GRID.map(([c, r]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ')}" /></svg>`;

function islandScreen(t) {
  const stars = levelStars(t.id);
  const current = LEVEL_PLAN.findIndex((_, i) => levelUnlocked(t, i) && !stars[i]);
  const pos = i => NODE_GRID[i].map(v => ((v * 2 + 1) / 6) * 100);
  const path = h('span', { class: 'map-path' });
  path.innerHTML = PATH_SVG;   // static markup built from constants
  const nodes = LEVEL_PLAN.map((p, i) => {
    const [x, y] = pos(i);
    const open = levelUnlocked(t, i);
    return h('button', {
      class: `node${p.boss ? ' boss' : ''}${open ? '' : ' locked'}${i === current ? ' current' : ''}`,
      style: `left:${x}%; top:${y}%`, disabled: !open,
      'aria-label': p.boss ? `Ải boss: ${t.boss.vi}` : `Ải ${i + 1}: ${p.title}`,
      onclick: () => { sfx.tap(); startLevel(t, i); },
    },
    p.boss ? h('img', { src: t.boss.img, alt: '' }) : h('span', { class: 'num' }, i + 1),
    open ? (stars[i] ? starsRow(stars[i]) : null) : icon('lock', 'lock-badge'));
  });
  let marker = null;
  if (current >= 0) {
    const [x, y] = pos(current);
    marker = h('span', { class: 'map-ollie', style: `left:${x}%; top:${y}%` }, ollie('wave'));
  }
  show(t.id,
    topbar(t, () => home(), starPill(islandStars(t.id), LEVEL_COUNT * 3)),
    h('main', { class: 'map', style: `--topic:${t.color}` }, path, nodes, marker),
    h('div', { class: 'map-actions' },
      current < 0 ? h('p', { class: 'bubble flat' }, 'Bạn đã vượt hết các ải của đảo này!') : null,
      h('button', { class: 'press btn go', onclick: () => { sfx.tap(); findScreen(t); } }, icon('eye'), ' Tìm đồ vật',
        (progress.find[t.id] || {}).stars ? starsRow(progress.find[t.id].stars) : null),
      h('button', { class: 'press btn', onclick: () => { sfx.tap(); practiceScreen(t); } }, icon('book'), ' Luyện tập tự do')));
  keyHandler = e => { if (e.key === 'Enter' && current >= 0) startLevel(t, current); };
}

// ---------------------------------------------------------------- wardrobe
function wardrobe() {
  const owned = DATA.topics.filter(t => t.hat && progress.hats.includes(t.hat.id));
  const wear = id => { sfx.tap(); progress.hat = id; saveProgress(); wardrobe(); };
  show('island',
    bar('Tủ mũ của Ollie', `${owned.length} mũ`, () => home(), null),
    h('main', { class: 'wardrobe' },
      h('div', { class: 'wardrobe-ollie' }, ollie('happy', 'ollie-big')),
      h('div', { class: 'hat-grid' },
        h('button', { class: `press hat-card${progress.hat ? '' : ' on'}`, onclick: () => wear(null) },
          h('span', { class: 'hat-art none' }, icon('cross')), h('span', {}, 'Không đội mũ')),
        DATA.topics.filter(t => t.hat).map(t => {
          const has = progress.hats.includes(t.hat.id);
          return h('button', {
            class: `press hat-card${progress.hat === t.hat.id ? ' on' : ''}${has ? '' : ' locked'}`, disabled: !has,
            onclick: () => wear(t.hat.id),
          },
          h('span', { class: 'hat-art' }, h('img', { src: t.hat.img, alt: '' })),
          h('span', {}, has ? t.hat.vi : `Thắng boss đảo ${t.vi}`));
        }))));
}

// ---------------------------------------------------------------- free practice (the v1.0 modes)
function practiceScreen(t) {
  const p = practiceOf(t.id);
  const modes = [
    { id: 'learn', title: 'Học từ mới', desc: 'Xem hình, nghe cách đọc', icon: 'book', go: () => learn(t, 0) },
    { id: 'listen', title: 'Nghe và chọn', desc: 'Nghe từ, chọn đúng hình', icon: 'ear', go: () => quiz(t, 'listen') },
    { id: 'look', title: 'Nhìn và chọn', desc: 'Nhìn hình, chọn đúng từ', icon: 'eye', go: () => quiz(t, 'look') },
    { id: 'spell', title: 'Đánh vần', desc: 'Xếp chữ cái thành từ', icon: 'letters', go: () => spell(t) },
  ];
  show(t.id,
    topbar(t, () => islandScreen(t)),
    h('main', { class: 'modes', style: `--topic:${t.color}` }, modes.map(m =>
      h('button', { class: 'press mode', onclick: () => { sfx.tap(); m.go(); } },
        h('span', { class: 'mode-icon' }, icon(m.icon)),
        h('span', { class: 'mode-title' }, m.title),
        h('span', { class: 'mode-desc' }, m.desc),
        m.id === 'learn'
          ? (p.learned ? h('span', { class: 'mode-done' }, 'Đã học xong') : null)
          : starsRow(p[m.id] || 0)))),
    h('section', { class: 'shelf', style: `--topic:${t.color}` },
      h('h2', {}, `${t.words.length} từ trong đảo này`),
      h('div', { class: 'shelf-row' }, t.words.map((w, i) =>
        h('button', { class: 'sticker', style: `--tilt:${TILTS[i % TILTS.length] / 2}deg`, 'aria-label': w.en,
          onclick: () => { sfx.tap(); learn(t, i); } }, art(w))))));
}

function learn(t, i) {
  const w = t.words[i];
  const last = t.words.length - 1;
  if (i === last) { practiceOf(t.id).learned = true; saveProgress(); }
  const go = k => { if (k >= 0 && k <= last) { sfx.tap(); learn(t, k); } };
  show(t.id,
    topbar(t, () => practiceScreen(t)),
    h('main', { class: 'learn', style: `--topic:${t.color}` },
      h('button', { class: 'sticker big-card', style: `--tilt:${i % 2 ? 1.5 : -1.5}deg`, 'aria-label': `Nghe từ ${w.en}`, onclick: () => sayWord(w) },
        art(w, w.en)),
      h('div', { class: 'word-block' },
        h('div', { class: 'word-row' },
          h('h2', { class: 'word', lang: 'en' }, w.en),
          h('button', { class: 'press round', 'aria-label': 'Nghe lại', onclick: () => sayWord(w) }, icon('speaker'))),
        h('p', { class: 'meaning' }, w.vi),
        h('button', { class: 'press sentence', lang: 'en', onclick: () => saySentence(w) }, icon('speaker'), w.sentence),
        h('p', { class: 'sentence-vi' }, w.sentence_vi)),
      h('nav', { class: 'pager', 'aria-label': 'Chuyển thẻ' },
        h('button', { class: 'press round', 'aria-label': 'Thẻ trước', disabled: i === 0, onclick: () => go(i - 1) }, icon('back')),
        h('div', { class: 'dots' }, t.words.map((_, k) => h('span', { class: k === i ? 'on' : '' }))),
        i < last
          ? h('button', { class: 'press round', 'aria-label': 'Thẻ tiếp', onclick: () => go(i + 1) }, icon('next'))
          : h('button', { class: 'press btn go', onclick: () => { sfx.tap(); quiz(t, 'listen'); } }, 'Chơi thử ngay'))));
  keyHandler = e => {
    if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === ' ') { e.preventDefault(); sayWord(w); }
  };
  later(() => sayWord(w), 300);
}

function quiz(t, mode) {
  quizQuestion({ t, mode, order: sample(t.words, QUIZ_LEN), i: 0, results: [] });
}

function quizQuestion(q) {
  const { t, mode } = q;
  const w = q.order[q.i];
  const options = shuffle([w, ...sample(t.words.filter(x => x !== w), 3)]);
  const mascot = ollie('base', 'ollie-mini');
  let answered = false;

  const choose = (opt, btn) => {
    if (answered) return;
    answered = true;
    const ok = opt === w;
    q.results.push(ok);
    if (ok) { sfx.correct(); btn.classList.add('right'); mascot.pose('happy'); }
    else {
      sfx.wrong();
      btn.classList.add('wrong');
      grid.querySelector(`[data-id="${w.id}"]`).classList.add('right');
      mascot.pose('sad');
    }
    track.children[q.i].className = ok ? 'right' : 'wrong';
    later(() => sayWord(w), 450);
    later(() => {
      q.i += 1;
      if (q.i < q.order.length) quizQuestion(q);
      else { const right = q.results.filter(Boolean).length; finish(t, mode, quizStars(right, q.order.length), `Đúng ${right}/${q.order.length} câu`); }
    }, ok ? 1500 : 2400);
  };

  const track = h('div', { class: 'track', 'aria-hidden': 'true' }, q.order.map((_, k) =>
    h('span', { class: k < q.i ? (q.results[k] ? 'right' : 'wrong') : k === q.i ? 'now' : '' })));
  const grid = mode === 'listen'
    ? h('div', { class: 'options' }, options.map((o, k) =>
      h('button', { class: 'sticker opt-pic', 'data-id': o.id, style: `--tilt:${TILTS[k]}deg`, 'aria-label': `Lựa chọn ${k + 1}`,
        onclick: e => choose(o, e.currentTarget) }, art(o))))
    : h('div', { class: 'options words' }, options.map(o =>
      h('button', { class: 'press opt-word', 'data-id': o.id, lang: 'en', onclick: e => choose(o, e.currentTarget) }, o.en)));

  const prompt = mode === 'listen'
    ? h('button', { class: 'press speak-big', 'aria-label': 'Nghe lại', onclick: () => sayWord(w) }, icon('speaker'))
    : h('div', { class: 'sticker', style: '--tilt:-2deg' }, art(w, 'Hình cần đoán'));

  show(t.id,
    topbar(t, () => practiceScreen(t)),
    track,
    h('main', { class: `quiz ${mode}`, style: `--topic:${t.color}` },
      h('p', { class: 'ask' }, mode === 'listen' ? 'Nghe và chọn hình đúng' : 'Đây là gì? Chọn từ đúng'),
      h('div', { class: 'prompt' }, prompt),
      grid),
    mascot);
  keyHandler = e => {
    const k = Number(e.key);
    if (k >= 1 && k <= 4) choose(options[k - 1], grid.children[k - 1]);
    else if (e.key === ' ') { e.preventDefault(); sayWord(w); }
  };
  if (mode === 'listen') later(() => sayWord(w), 350);
}

const quizStars = (right, total) => (right === total ? 3 : right >= total - 2 ? 2 : right >= Math.ceil(total / 2) ? 1 : 0);

/**
 * Letter tiles + slots for spelling `w`. Used by free practice and by level rounds.
 * opts: decoys (extra wrong letters), onWrong(), onSolved(), onHint(), canHint() -> bool, hintLabel.
 */
function spellBoard(w, opts) {
  const chars = [...w.en.toLowerCase()];                       // includes spaces for "ice cream"
  const slotsIdx = chars.map((c, k) => (c === ' ' ? null : k)).filter(k => k !== null);
  const letters = slotsIdx.map(k => chars[k]);
  const decoyPool = [...'abcdefghijklmnopqrstuvwxyz'].filter(c => !letters.includes(c));
  let tiles = shuffle([...letters, ...sample(decoyPool, opts.decoys || 0)].map(ch => ({ ch, used: false })));
  if (!opts.decoys && tiles.length > 2 && tiles.map(x => x.ch).join('') === letters.join('')) tiles = tiles.reverse();
  const filled = {};          // slot char index -> tile index
  const locked = new Set();   // slot char index confirmed correct
  let done = false;

  const slotsEl = h('div', { class: 'slots', lang: 'en', 'aria-label': 'Ô chữ' });
  const tilesEl = h('div', { class: 'tiles', lang: 'en' });
  const nextEmpty = () => slotsIdx.find(k => filled[k] === undefined);

  const place = ti => {
    if (done || tiles[ti].used) return;
    const k = nextEmpty();
    if (k === undefined) return;
    sfx.tap();
    tiles[ti].used = true;
    filled[k] = ti;
    draw();
    if (nextEmpty() === undefined) later(check, 250);
  };
  const unplace = k => {
    if (done || filled[k] === undefined || locked.has(k)) return;
    tiles[filled[k]].used = false;
    delete filled[k];
    draw();
  };
  const backspace = () => {
    const k = [...slotsIdx].reverse().find(x => filled[x] !== undefined && !locked.has(x));
    if (k !== undefined) unplace(k);
  };
  const hint = () => {
    if (done) return;
    if (opts.canHint && !opts.canHint()) { sfx.wrong(); return; }
    const k = slotsIdx.find(x => !locked.has(x) && (filled[x] === undefined || tiles[filled[x]].ch !== chars[x]));
    if (k === undefined) return;
    if (filled[k] !== undefined) { tiles[filled[k]].used = false; delete filled[k]; }
    let ti = tiles.findIndex(x => !x.used && x.ch === chars[k]);
    if (ti < 0) {   // the right letter sits in a wrong slot: take it back
      const from = slotsIdx.find(x => filled[x] !== undefined && !locked.has(x) && tiles[filled[x]].ch === chars[k]);
      ti = filled[from];
      delete filled[from];
    }
    tiles[ti].used = true;
    filled[k] = ti;
    locked.add(k);
    sfx.tap();
    if (opts.onHint) opts.onHint();
    draw();
    if (nextEmpty() === undefined) later(check, 250);
  };
  const check = () => {
    if (done) return;
    if (slotsIdx.every(k => tiles[filled[k]].ch === chars[k])) {
      done = true;
      slotsEl.classList.add('solved');
      opts.onSolved();
      return;
    }
    for (const k of slotsIdx) {   // keep the right letters (green), send the wrong ones back
      if (tiles[filled[k]].ch === chars[k]) locked.add(k);
      else { tiles[filled[k]].used = false; delete filled[k]; }
    }
    slotsEl.classList.remove('wrong-shake');
    void slotsEl.offsetWidth;
    slotsEl.classList.add('wrong-shake');
    draw();
    opts.onWrong();
  };

  function draw() {
    slotsEl.replaceChildren(...chars.map((c, k) => {
      if (c === ' ') return h('span', { class: 'slot gap' });
      const ti = filled[k];
      return h('button', {
        class: `slot${ti !== undefined ? ' filled' : ''}${locked.has(k) ? ' locked' : ''}`,
        'aria-label': ti !== undefined ? `Chữ ${tiles[ti].ch}, bấm để bỏ` : 'Ô trống', onclick: () => unplace(k),
      }, ti !== undefined ? tiles[ti].ch : '');
    }));
    tilesEl.replaceChildren(...tiles.map((x, ti) =>
      h('button', { class: `press tile${x.used ? ' used' : ''}`, 'data-letter': x.ch, 'aria-label': `Chữ ${x.ch}`, onclick: () => place(ti) }, x.ch)));
  }
  draw();

  const keys = e => {
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
    else if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      const ti = tiles.findIndex(x => !x.used && x.ch === e.key.toLowerCase());
      if (ti >= 0) place(ti);
    }
  };
  const actions = h('div', { class: 'spell-actions' },
    h('button', { class: 'press btn', onclick: backspace }, 'Xoá chữ'),
    h('button', { class: 'press btn', onclick: hint }, opts.hintLabel || 'Gợi ý 1 chữ'));
  return { nodes: [slotsEl, tilesEl, actions], keys };
}

function spell(t) {
  spellWord({ t, words: sample(t.words, SPELL_LEN), i: 0, mistakes: 0 });
}

function spellWord(s) {
  const { t } = s;
  const w = s.words[s.i];
  const mascot = ollie('base', 'ollie-mini');
  const board = spellBoard(w, {
    onHint: () => { s.mistakes += 1; },
    onWrong: () => {
      s.mistakes += 1;
      sfx.wrong();
      mascot.pose('sad');
      later(() => mascot.pose('base'), 1200);
    },
    onSolved: () => {
      sfx.correct();
      mascot.pose('happy');
      later(() => sayWord(w), 300);
      later(() => {
        s.i += 1;
        if (s.i < s.words.length) spellWord(s);
        else finish(t, 'spell', spellStars(s.mistakes), s.mistakes ? `Sai hoặc gợi ý ${s.mistakes} lần` : 'Không sai chữ nào!');
      }, 1700);
    },
  });

  show(t.id,
    topbar(t, () => practiceScreen(t), h('span', { class: 'pill' }, `Từ ${s.i + 1}/${s.words.length}`)),
    h('main', { class: 'spell', style: `--topic:${t.color}` },
      h('div', { class: 'spell-top' },
        h('div', { class: 'sticker', style: '--tilt:-2deg' }, art(w, 'Hình cần đánh vần')),
        h('button', { class: 'press speak-big', 'aria-label': 'Nghe từ', onclick: () => sayWord(w) }, icon('speaker'))),
      h('p', { class: 'ask' }, `Xếp chữ cái để viết tên hình này (nghĩa: ${w.vi})`),
      board.nodes),
    mascot);
  keyHandler = board.keys;
  later(() => sayWord(w), 350);
}

const spellStars = m => (m === 0 ? 3 : m <= 2 ? 2 : 1);

function finish(t, mode, stars, detail) {
  const p = practiceOf(t.id);
  const before = p[mode] || 0;
  p[mode] = Math.max(before, stars);
  saveProgress();
  const title = ['Thử lại nhé!', 'Cố lên nào!', 'Giỏi lắm!', 'Tuyệt vời!'][stars];
  const replay = { listen: () => quiz(t, 'listen'), look: () => quiz(t, 'look'), spell: () => spell(t) }[mode];
  show(t.id,
    topbar(t, () => practiceScreen(t)),
    h('main', { class: 'result', style: `--topic:${t.color}` },
      ollie(stars >= 2 ? 'happy' : stars === 1 ? 'base' : 'sad', 'ollie-big'),
      h('div', { class: 'big-stars', 'aria-label': `${stars} sao` }, [0, 1, 2].map(k => starIcon(k < stars))),
      h('h2', {}, title),
      h('p', {}, detail),
      stars > before ? h('p', { class: 'new-best' }, 'Kỷ lục mới!') : null,
      h('div', { class: 'actions' },
        h('button', { class: 'press btn go', onclick: () => { sfx.tap(); replay(); } }, 'Chơi lại'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); practiceScreen(t); } }, 'Chọn trò khác'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); islandScreen(t); } }, 'Về bản đồ ải'))));
  sfx.stars(stars);
  later(() => sayPhrase(stars === 3 ? 'excellent' : stars === 2 ? 'great' : stars === 1 ? 'well-done' : 'try-again'), 1100);
}

// ---------------------------------------------------------------- Android wrapper hooks
// MainActivity calls these: system Back = the on-screen back button; stop sound when the app is hidden.
window.wordIslandBack = () => {
  const back = document.querySelector('.topbar .round');
  if (!back) return false;   // already on the home screen: let the app close
  back.click();
  return true;
};
window.wordIslandPause = () => {
  if (playing) playing.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) window.wordIslandPause(); });

// ---------------------------------------------------------------- boot (after levels.js has loaded)
document.addEventListener('DOMContentLoaded', () => {
  if (!DATA || !DATA.topics) {
    document.getElementById('app').textContent = 'Thiếu file data.js — hãy chạy tools/assets.py export.';
    return;
  }
  saveProgress();   // persist a v1.0 → v2 migration right away
  home();
});
