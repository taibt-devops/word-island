'use strict';
/* "Tìm đồ vật" — hidden-object scenes built from the word stickers on top of the island backdrop.
   No extra art: every play shuffles where things are. Uses helpers from game.js and levels.js. */

const FIND_SKY = new Set(['bird', 'airplane']);
const FIND_BIG = new Set(['elephant', 'bus', 'train', 'truck', 'airplane', 'boat', 'bed', 'sofa', 'table', 'car',
  'motorbike', 'bicycle', 'lion', 'door', 'window', 'globe', 'backpack', 'watermelon', 'pineapple']);
const FIND_SMALL = new Set(['egg', 'candy', 'eraser', 'crayon', 'strawberry', 'grapes', 'apple', 'mango', 'orange',
  'pencil', 'ruler', 'scissors', 'milk', 'fish', 'bird', 'banana', 'cake', 'ice-cream', 'bread', 'rice', 'book', 'clock']);
const FIND_HINT_MS = 10000;

const sayFind = w => speak(w.find_audio, `Can you find the ${w.en}?`);

/**
 * Scatter `t`'s words plus `extras` decoys from other islands over the island picture.
 * opts: targets (words to find, in order), extras, schedule(fn, ms), onFound(w), onWrong(w), onDone()
 * Returns { el, current() }.
 */
function findScene(t, opts) {
  const narrow = window.innerWidth < 700;
  const ratio = narrow ? 4 / 5 : 3 / 2;   // scene width / height
  const decoys = sample(DATA.topics.filter(x => x !== t).flatMap(x => x.words), narrow ? Math.min(2, opts.extras) : opts.extras);
  const items = [...t.words, ...decoys];
  const placed = [];

  // Biggest first so the large things find room; positions and sizes in % of the scene.
  const sized = items.map(w => {
    const base = FIND_BIG.has(w.id) ? 17 : FIND_SMALL.has(w.id) ? 10 : 13;
    return { w, size: base * (narrow ? 1.55 : 1) * (0.9 + Math.random() * 0.2) };
  }).sort((a, b) => b.size - a.size);
  for (const it of sized) {
    let { size } = it;
    let spot = null;
    for (let attempt = 0; attempt < 400 && !spot; attempt++) {
      if (attempt && attempt % 100 === 0) size *= 0.88;   // crowded: shrink a little and keep trying
      const wPct = size;
      const hPct = size * ratio;                            // square sprites
      const sky = FIND_SKY.has(it.w.id);
      const yMin = sky ? 3 : 36;
      const yMax = (sky ? 42 : 98) - hPct;
      const x = 2 + Math.random() * (96 - wPct);
      const y = yMin + Math.random() * Math.max(0, yMax - yMin);
      const box = { x, y, w: wPct, h: hPct };
      const clash = placed.some(p => x < p.x + p.w - 1 && x + wPct - 1 > p.x && y < p.y + p.h - 1 && y + hPct - 1 > p.y);
      if (!clash || attempt === 399) spot = box;
    }
    placed.push({ ...spot, w0: it.w });
  }

  const els = new Map();
  const scene = h('div', {
    class: 'scene', style: `--ratio:${ratio}; background-image:url("${DATA.backgrounds[t.id]}")`,
    'aria-label': 'Bức tranh',
  }, placed.map(p => {
    const el = h('button', {
      class: 'find-item', 'data-id': p.w0.id, 'aria-label': 'Đồ vật',
      style: `left:${p.x}%; top:${p.y}%; width:${p.w}%; z-index:${Math.round(p.y + p.h)}; --rot:${(Math.random() * 20 - 10).toFixed(1)}deg`,
    }, h('img', { src: p.w0.img, alt: '' }));
    el.addEventListener('pointerdown', e => { e.preventDefault(); tap(p.w0, el); });
    els.set(p.w0, el);
    return el;
  }));

  let i = 0;
  let done = false;
  let hintTimer = 0;
  const wordEl = h('span', { class: 'find-word', lang: 'en' });
  const tray = h('div', { class: 'find-tray', 'aria-label': 'Đã tìm thấy' }, opts.targets.map(() => h('span', { class: 'slot-dot' })));
  const prompt = h('div', { class: 'find-prompt' },
    h('button', { class: 'press round', 'aria-label': 'Nghe lại', onclick: () => { if (!done) sayFind(opts.targets[i]); } }, icon('speaker')),
    h('span', { class: 'find-label' }, 'Tìm:'), wordEl, tray);

  const armHint = () => {
    const token = ++hintTimer;
    const w = opts.targets[i];
    opts.schedule(() => { if (token === hintTimer && !done) els.get(w).classList.add('hint'); }, FIND_HINT_MS);
  };
  const ask = () => {
    const w = opts.targets[i];
    wordEl.textContent = w.en;
    sayFind(w);
    armHint();
  };
  function tap(w, el) {
    if (done || el.classList.contains('found')) return;
    const target = opts.targets[i];
    if (w !== target) {
      el.classList.remove('nope');
      void el.offsetWidth;
      el.classList.add('nope');
      opts.onWrong(w);
      return;
    }
    el.classList.remove('hint');
    el.classList.add('found');
    tray.children[i].replaceChildren(h('img', { src: w.img, alt: '' }));
    tray.children[i].classList.add('got');
    opts.onFound(w);
    opts.schedule(() => sayWord(w), 200);
    i += 1;
    hintTimer += 1;
    if (i >= opts.targets.length) {
      done = true;
      opts.onDone();
    } else {
      opts.schedule(ask, 1400);
    }
  }
  // start() only once the scene is on screen: show() clears pending timers of the previous screen.
  return { el: h('div', { class: 'find' }, prompt, scene), current: () => opts.targets[i], start: () => opts.schedule(ask, 400) };
}

// ---------------------------------------------------------------- inside levels
R.find = (pool, o) => ({ type: 'find', targets: sample(pool, o.targets), extras: o.extras });

ROUNDS.find = (run, s, stage) => {
  const scene = findScene(run.t, {
    targets: s.targets, extras: s.extras,
    schedule: (fn, ms) => roundLater(run, fn, ms),
    onFound: () => hit(run),
    onWrong: () => miss(run),
    onDone: () => roundLater(run, () => roundDone(run), 1600),
  });
  run.findTarget = scene.current;   // for the automated test
  stage.append(scene.el);
  scene.start();
};

// ---------------------------------------------------------------- free play from the island map
const findOf = id => progress.find[id] || (progress.find[id] = { stars: 0, best: null });

function findScreen(t) {
  const mascot = ollie('base', 'ollie-mini');
  const started = Date.now();
  let mistakes = 0;
  const scene = findScene(t, {
    targets: shuffle(t.words), extras: 6,
    schedule: later,
    onWrong: () => { mistakes += 1; sfx.wrong(); mascot.pose('sad'); later(() => mascot.pose('base'), 1000); },
    onFound: () => { sfx.correct(); mascot.pose('happy'); later(() => mascot.pose('base'), 1000); },
    onDone: () => later(() => findResult(t, mistakes, Math.round((Date.now() - started) / 1000)), 1600),
  });
  window.wordIslandDebug = { findTarget: scene.current };   // for the automated test
  show(t.id, topbar(t, () => islandScreen(t), starPill(findOf(t.id).stars, 3)), scene.el, mascot);
  scene.start();
}

function findResult(t, mistakes, secs) {
  const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const rec = findOf(t.id);
  const newBest = rec.best == null || secs < rec.best;
  rec.stars = Math.max(rec.stars, stars);
  if (newBest) rec.best = secs;
  saveProgress();
  show(t.id,
    topbar(t, () => islandScreen(t), starPill(rec.stars, 3)),
    h('main', { class: 'result', style: `--topic:${t.color}` },
      ollie(stars >= 2 ? 'happy' : 'base', 'ollie-big'),
      h('div', { class: 'big-stars', 'aria-label': `${stars} sao` }, [0, 1, 2].map(k => starIcon(k < stars))),
      h('h2', {}, ['', 'Tìm ra hết rồi!', 'Giỏi lắm!', 'Mắt tinh quá!'][stars]),
      h('p', {}, `Tìm đủ ${t.words.length} đồ vật trong ${secs} giây${mistakes ? `, chạm nhầm ${mistakes} lần` : ', không nhầm lần nào'}.`),
      newBest ? h('p', { class: 'new-best' }, 'Kỷ lục thời gian mới!') : h('p', {}, `Kỷ lục: ${rec.best} giây`),
      h('div', { class: 'actions' },
        h('button', { class: 'press btn go', onclick: () => { sfx.tap(); findScreen(t); } }, 'Chơi lại'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); islandScreen(t); } }, 'Bản đồ ải'))));
  sfx.stars(stars);
  later(() => sayPhrase(stars === 3 ? 'excellent' : stars === 2 ? 'great' : 'well-done'), 1100);
  keyHandler = e => { if (e.key === 'Enter') findScreen(t); };
}
