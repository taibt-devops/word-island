'use strict';
/* Level mode: 8 levels + a boss per island. 3 hearts per level, a wrong answer costs one.
   Stars = hearts left. Uses the helpers in game.js (loaded first). */

// ---------------------------------------------------------------- round specs
const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz'];
const choices = (word, n, pool) => shuffle([word, ...sample(pool.filter(x => x !== word), n - 1)]);

const R = {
  intro: words => ({ type: 'intro', words }),
  pickPic: (word, n, pool) => ({ type: 'pickPic', word, options: choices(word, n, pool) }),
  pickWord: (word, n, pool) => ({ type: 'pickWord', word, options: choices(word, n, pool) }),
  hearSay: pool => {   // listen: is the word you hear the name of this picture?
    const word = pick(pool);
    const same = Math.random() < 0.5;
    return { type: 'hearSay', word, said: same ? word : pick(pool.filter(x => x !== word)), same };
  },
  missing: word => {
    const idx = pick([...word.en].map((c, k) => (c === ' ' ? -1 : k)).filter(k => k >= 0));
    const letter = word.en[idx].toLowerCase();
    return { type: 'missing', word, idx, letter, options: shuffle([letter, ...sample(ALPHABET.filter(c => c !== letter), 2)]) };
  },
  spell: (word, decoys) => ({ type: 'spell', word, decoys }),
  match: words => ({ type: 'match', words }),
  balloon: (pool, o) => {
    const order = shuffle(pool);
    return { type: 'balloon', pool, ...o, targets: Array.from({ length: o.targets }, (_, k) => order[k % order.length]) };
  },
  rush: (pool, o) => ({ type: 'rush', pool, ...o }),
};

const groups = t => {
  const w = t.words;
  return { A: w.slice(0, 3), B: w.slice(3, 6), C: w.slice(6), AB: w.slice(0, 6), all: w.slice() };
};

/* Difficulty climbs through the island; later levels always mix in earlier words (review). */
const LEVEL_PLAN = [
  { title: 'Làm quen', make: g => [R.intro(g.A), ...shuffle(g.A).map(w => R.pickPic(w, 2, g.A)), ...sample(g.A, 2).map(w => R.pickWord(w, 2, g.A))] },
  { title: 'Bạn mới', make: g => [R.intro(g.B), ...shuffle(g.B).map(w => R.pickPic(w, 3, g.AB)), R.hearSay(g.AB), R.hearSay(g.AB)] },
  { title: 'Thêm bạn nữa', make: g => [R.intro(g.C), ...shuffle([...g.C, pick(g.AB)]).map(w => R.pickWord(w, 3, g.all)), R.match(sample(g.all, 4))] },
  { title: 'Bóng bay', make: g => [R.balloon(g.all, { targets: 5, max: 4, speed: 1, time: 60 }), ...sample(g.all, 2).map(w => R.pickPic(w, 4, g.all))] },
  { title: 'Chữ bị mất', make: g => [...sample(g.all, 3).map(w => R.missing(w)), ...sample(g.all, 3).map(w => R.pickWord(w, 4, g.all))] },
  { title: 'Nhanh tay', make: g => [R.rush(g.all, { need: 6, time: 30 }), R.find(g.all, { targets: 4, extras: 4 })] },
  { title: 'Đánh vần', make: g => [...sample(g.all, 3).map(w => R.spell(w, 0)), R.match(sample(g.all, 4))] },
  { title: 'Bóng bay siêu tốc', make: g => [R.balloon(g.all, { targets: 6, max: 5, speed: 1.5, time: 50 }), ...sample(g.all, 2).map(w => R.spell(w, 2))] },
  {
    title: 'Boss', boss: true, time: 120, make: g => shuffle([
      R.find(g.all, { targets: 3, extras: 4 }), ...sample(g.all, 2).map(w => R.pickWord(w, 4, g.all)),
      R.hearSay(g.all), R.hearSay(g.all), ...sample(g.all, 2).map(w => R.missing(w)), ...sample(g.all, 2).map(w => R.spell(w, 1)),
    ]),
  },
];

// ---------------------------------------------------------------- level run
function startLevel(t, i) {
  const plan = LEVEL_PLAN[i];
  const run = { t, i, plan, rounds: plan.make(groups(t)), r: 0, hearts: 3, over: false, timers: new Set(), loop: 0 };
  window.wordIslandDebug = { run };   // read by the automated play-through test
  if (plan.boss) bossIntro(run);
  else { levelScreen(run); sayPhrase('ready'); }
}

/* Timers and animation loops that belong to the current round only. */
function roundLater(run, fn, ms) {
  const id = setTimeout(() => { run.timers.delete(id); if (!run.over) fn(); }, ms);
  run.timers.add(id);
}
function roundLoop(run, fn) {
  const token = ++run.loop;
  frameLoop((dt, now) => (run.loop === token && !run.over ? fn(dt, now) : false));
}
function clearRound(run) {
  for (const id of run.timers) clearTimeout(id);
  run.timers.clear();
  run.loop += 1;
  keyHandler = null;
}
function stopRun(run) { run.over = true; clearRound(run); }

function heartsEl(n) {
  return h('span', { class: 'hearts', 'aria-label': `Còn ${n} trái tim` }, [0, 1, 2].map(k => icon('heart', k < n ? 'heart' : 'heart off')));
}

function levelScreen(run) {
  const { t, plan } = run;
  const ui = run.ui = {
    hearts: heartsEl(run.hearts),
    track: h('div', { class: 'track', 'aria-hidden': 'true' }, run.rounds.map(() => h('span'))),
    stage: h('main', { class: 'stage', style: `--topic:${t.color}` }),
    mascot: ollie('base', 'ollie-mini'),
  };
  let bossBar = null;
  if (plan.boss) {
    run.bossHp = run.rounds.length;
    ui.hp = h('i', { style: 'width:100%' });
    ui.clock = h('i', { style: 'width:100%' });
    ui.bossImg = h('img', { src: t.boss.img, alt: t.boss.vi });
    bossBar = h('div', { class: 'boss-bar' }, ui.bossImg,
      h('div', { class: 'bars' },
        h('span', { class: 'meter hp', 'aria-label': 'Máu boss' }, ui.hp),
        h('span', { class: 'meter clock', 'aria-label': 'Thời gian' }, ui.clock)));
  }
  show(t.id,
    bar(plan.boss ? t.boss.vi : `Ải ${run.i + 1}`, plan.boss ? 'Đánh bại boss!' : plan.title, () => islandScreen(t), ui.hearts, t.color),
    bossBar, ui.track, ui.stage, ui.mascot);
  leaveHook = () => stopRun(run);

  if (plan.boss) {
    let left = plan.time;
    frameLoop(dt => {
      if (run.over) return false;
      left -= dt;
      ui.clock.style.width = `${Math.max(0, left / plan.time) * 100}%`;
      ui.clock.parentElement.classList.toggle('low', left < 20);
      if (left <= 0) { fail(run, 'time'); return false; }
      return true;
    });
  }
  renderRound(run);
}

function react(run, pose) {
  run.ui.mascot.pose(pose);
  later(() => { if (run.ui) run.ui.mascot.pose('base'); }, 1100);
}

function hit(run) { sfx.correct(); react(run, 'happy'); }

function loseHeart(run) {
  if (run.over) return;
  run.hearts -= 1;
  const fresh = heartsEl(run.hearts);
  fresh.classList.add('ouch');
  run.ui.hearts.replaceWith(fresh);
  run.ui.hearts = fresh;
  if (run.hearts <= 0) {
    run.over = true;
    later(() => fail(run, 'hearts'), 800);
  }
}
function miss(run) {
  if (run.over) return;
  sfx.wrong();
  react(run, 'sad');
  loseHeart(run);
}

function renderRound(run) {
  const spec = run.rounds[run.r];
  [...run.ui.track.children].forEach((d, k) => { d.className = k < run.r ? 'right' : k === run.r ? 'now' : ''; });
  run.ui.stage.replaceChildren();
  run.ui.stage.className = `stage round-${spec.type}`;
  run.ui.stage.dataset.round = run.r;
  ROUNDS[spec.type](run, spec, run.ui.stage);
}

function roundDone(run) {
  if (run.over) return;
  clearRound(run);
  run.r += 1;
  if (run.bossHp != null) {
    run.bossHp -= 1;
    run.ui.hp.style.width = `${(run.bossHp / run.rounds.length) * 100}%`;
    run.ui.bossImg.classList.remove('hit');
    void run.ui.bossImg.offsetWidth;
    run.ui.bossImg.classList.add('hit');
  }
  if (run.r >= run.rounds.length) {
    run.over = true;
    later(() => win(run), 500);
  } else {
    later(() => renderRound(run), 250);
  }
}

// ---------------------------------------------------------------- round renderers
const speakBtn = (w, big) => h('button', {
  class: big ? 'press speak-big' : 'press round', 'aria-label': 'Nghe lại', onclick: () => sayWord(w),
}, icon('speaker'));
const picCard = (w, tilt = -2) => h('div', { class: 'sticker prompt-card', style: `--tilt:${tilt}deg` }, art(w));

/** Pick-one rounds: a wrong pick greys out (and costs a heart); keep picking until right. */
function choiceRound(run, s, stage, prompt, ask, optionEl, gridClass) {
  let solved = false;
  const choose = (o, btn) => {
    if (run.over || solved || btn.disabled) return;
    if (o === s.word) {
      solved = true;
      btn.classList.add('right');
      hit(run);
      roundLater(run, () => sayWord(s.word), 250);
      roundLater(run, () => roundDone(run), 1200);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      miss(run);
    }
  };
  const grid = h('div', { class: gridClass }, s.options.map((o, k) => {
    const btn = optionEl(o, k);
    btn.dataset.id = o.id;
    btn.addEventListener('click', () => choose(o, btn));
    return btn;
  }));
  stage.append(h('p', { class: 'ask' }, ask), h('div', { class: 'prompt' }, prompt), grid);
  keyHandler = e => {
    const k = Number(e.key);
    if (k >= 1 && k <= s.options.length) choose(s.options[k - 1], grid.children[k - 1]);
    else if (e.key === ' ') { e.preventDefault(); sayWord(s.word); }
  };
}

const ROUNDS = {
  intro(run, s, stage) {
    let k = 0;
    const draw = () => {
      const w = s.words[k];
      const lastOne = k === s.words.length - 1;
      stage.replaceChildren(
        h('p', { class: 'ask' }, `Từ mới ${k + 1}/${s.words.length}: bấm vào hình để nghe`),
        h('div', { class: 'intro-card' },
          h('button', { class: 'sticker big-card', style: `--tilt:${k % 2 ? 1.5 : -1.5}deg`, onclick: () => sayWord(w) }, art(w, w.en)),
          h('div', { class: 'word-block' },
            h('div', { class: 'word-row' }, h('h2', { class: 'word', lang: 'en' }, w.en), speakBtn(w)),
            h('p', { class: 'meaning' }, w.vi),
            h('button', {
              class: 'press btn go intro-next', onclick: () => { sfx.tap(); k += 1; if (lastOne) roundDone(run); else draw(); },
            }, lastOne ? 'Bắt đầu chơi!' : 'Từ tiếp theo'))));
      roundLater(run, () => sayWord(w), 350);
    };
    draw();
    keyHandler = e => { if (e.key === 'Enter') stage.querySelector('.intro-next').click(); };
  },

  pickPic(run, s, stage) {
    choiceRound(run, s, stage, speakBtn(s.word, true), 'Nghe và chọn hình đúng',
      (o, k) => h('button', { class: 'sticker opt-pic', style: `--tilt:${TILTS[k]}deg`, 'aria-label': `Lựa chọn ${k + 1}` }, art(o)),
      `options n${s.options.length}`);
    roundLater(run, () => sayWord(s.word), 350);
  },

  pickWord(run, s, stage) {
    choiceRound(run, s, stage, picCard(s.word), 'Đây là gì? Chọn từ đúng',
      o => h('button', { class: 'press opt-word', lang: 'en' }, o.en), `options words n${s.options.length}`);
  },

  hearSay(run, s, stage) {
    let answered = false;
    const note = h('p', { class: 'note' });
    const answer = (yes, btn) => {
      if (answered || run.over) return;
      answered = true;
      const ok = yes === s.same;
      btn.classList.add(ok ? 'right' : 'wrong');
      if (ok) hit(run); else miss(run);
      note.textContent = s.same ? `Đây chính là "${s.word.en}".` : `Đây là "${s.word.en}", không phải "${s.said.en}".`;
      roundLater(run, () => sayWord(s.word), 400);
      roundLater(run, () => roundDone(run), 2000);
    };
    stage.append(
      h('p', { class: 'ask' }, 'Nghe rồi trả lời: có phải tên của hình này không?'),
      h('div', { class: 'hear-row' }, picCard(s.word),
        h('button', { class: 'press speak-big', 'aria-label': 'Nghe lại', onclick: () => sayWord(s.said) }, icon('speaker'))),
      h('div', { class: 'yes-no' },
        h('button', { class: 'press btn yes', 'data-answer': 'yes', onclick: e => answer(true, e.currentTarget) }, icon('check'), ' Đúng'),
        h('button', { class: 'press btn no', 'data-answer': 'no', onclick: e => answer(false, e.currentTarget) }, icon('cross'), ' Sai')),
      note);
    roundLater(run, () => sayWord(s.said), 350);
  },

  missing(run, s, stage) {
    let solved = false;
    const gap = h('span', { class: 'gap' }, '?');
    const wordEl = h('div', { class: 'gap-word', lang: 'en' },
      [...s.word.en].map((c, k) => (k === s.idx ? gap : h('span', {}, c === ' ' ? ' ' : c))));
    const choose = (letter, btn) => {
      if (solved || run.over || btn.disabled) return;
      if (letter === s.letter) {
        solved = true;
        gap.textContent = letter;
        gap.classList.add('filled');
        btn.classList.add('right');
        hit(run);
        roundLater(run, () => sayWord(s.word), 250);
        roundLater(run, () => roundDone(run), 1300);
      } else {
        btn.classList.add('wrong');
        btn.disabled = true;
        miss(run);
      }
    };
    const tiles = s.options.map(l => h('button', { class: 'press tile', 'data-letter': l, onclick: e => choose(l, e.currentTarget) }, l));
    stage.append(
      h('p', { class: 'ask' }, 'Chữ nào còn thiếu?'),
      h('div', { class: 'hear-row' }, picCard(s.word), speakBtn(s.word, true)),
      wordEl,
      h('div', { class: 'tiles' }, tiles));
    keyHandler = e => {
      const i = s.options.indexOf(e.key.toLowerCase());
      if (i >= 0) choose(s.options[i], tiles[i]);
    };
    roundLater(run, () => sayWord(s.word), 350);
  },

  spell(run, s, stage) {
    const board = spellBoard(s.word, {
      decoys: s.decoys,
      hintLabel: 'Gợi ý (mất 1 tim)',
      canHint: () => !run.over && run.hearts > 1,
      onHint: () => loseHeart(run),
      onWrong: () => miss(run),
      onSolved: () => {
        hit(run);
        roundLater(run, () => sayWord(s.word), 250);
        roundLater(run, () => roundDone(run), 1400);
      },
    });
    stage.append(
      h('div', { class: 'spell-top' }, picCard(s.word), speakBtn(s.word, true)),
      h('p', { class: 'ask' }, s.decoys ? `Xếp chữ thành từ (có ${s.decoys} chữ thừa!)` : `Xếp chữ thành từ (nghĩa: ${s.word.vi})`),
      ...board.nodes);
    keyHandler = board.keys;
    roundLater(run, () => sayWord(s.word), 350);
  },

  match(run, s, stage) {
    let sel = null;
    let left = s.words.length;
    const flash = el => { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };
    const choose = (side, w, el) => {
      if (run.over || el.classList.contains('matched')) return;
      if (!sel || sel.side === side) {
        if (sel) sel.el.classList.remove('sel');
        sel = { side, w, el };
        el.classList.add('sel');
        sfx.tap();
        if (side === 'pic') sayWord(w);
        return;
      }
      const other = sel;
      sel = null;
      other.el.classList.remove('sel');
      if (other.w === w) {
        el.classList.add('matched');
        other.el.classList.add('matched');
        hit(run);
        sayWord(w);
        left -= 1;
        if (!left) roundLater(run, () => roundDone(run), 900);
      } else {
        flash(el);
        flash(other.el);
        miss(run);
      }
    };
    stage.append(
      h('p', { class: 'ask' }, 'Nối mỗi hình với từ của nó'),
      h('div', { class: 'match' },
        h('div', { class: 'match-col' }, shuffle(s.words).map(w => {
          const el = h('button', { class: 'sticker match-pic', 'data-pic': w.id, 'aria-label': 'Hình' }, art(w));
          el.addEventListener('click', () => choose('pic', w, el));
          return el;
        })),
        h('div', { class: 'match-col' }, shuffle(s.words).map(w => {
          const el = h('button', { class: 'press match-word', 'data-word': w.id, lang: 'en' }, w.en);
          el.addEventListener('click', () => choose('word', w, el));
          return el;
        }))));
  },

  balloon(run, s, stage) {
    const COLORS = ['#ff6b5b', '#ffc93c', '#3dbb6a', '#1fb5c9', '#a77bff', '#ff8fc7'];
    let ti = 0;
    let target = s.targets[0];
    let finished = false;
    let elapsed = 0;
    const promptImg = h('img', { src: target.img, alt: '' });
    const counter = h('span', { class: 'pill' }, `0/${s.targets.length}`);
    const clock = h('i', { style: 'width:100%' });
    const sky = h('div', { class: 'sky', 'aria-label': 'Bầu trời bóng bay' });
    stage.append(
      h('div', { class: 'balloon-top' },
        h('div', { class: 'sticker mini' }, h('span', { class: 'sticker-art' }, promptImg)),
        h('button', { class: 'press round', 'aria-label': 'Nghe lại', onclick: () => sayWord(target) }, icon('speaker')),
        h('p', { class: 'ask' }, 'Bắn quả bóng có tên của hình này!'),
        counter),
      h('span', { class: 'meter clock' }, clock),
      sky);

    const balloons = new Set();
    let W = 0;
    let H = 0;
    let lanes = [];
    let first = true;
    const measure = () => { W = sky.clientWidth; H = sky.clientHeight; };
    const place = b => { b.el.style.left = `${b.x}px`; b.el.style.top = `${b.y}px`; };   // transform is left free for the pop animation
    const remove = b => { b.el.remove(); balloons.delete(b); };
    /* Each balloon rises in its own lane so labels never hide behind each other. */
    const freeLane = () => {
      const count = Math.max(2, Math.floor(W / 128));
      if (!lanes.length) lanes = shuffle([...Array(count).keys()]);
      const busy = new Set([...balloons].filter(b => !b.popped && b.y > H * 0.45).map(b => b.lane));
      const k = lanes.findIndex(l => !busy.has(l));
      return k >= 0 ? lanes.splice(k, 1)[0] : lanes.shift();
    };
    const spawn = (word, y) => {
      const el = h('button', {
        class: 'balloon', lang: 'en', 'data-id': word.id,
        style: `--bc:${pick(COLORS)}; font-size:${word.en.length > 7 ? 16 : 20}px`,
      }, word.en);
      const lane = freeLane();
      const laneW = W / Math.max(2, Math.floor(W / 128));
      const x = Math.min(W - 122, lane * laneW + Math.random() * Math.max(0, laneW - 122));
      const b = { el, word, lane, x: Math.max(0, x), y, v: ((H + 180) / (7 - Math.random() * 1.5)) * s.speed };
      el.addEventListener('pointerdown', e => { e.preventDefault(); tap(b); });
      sky.append(el);
      balloons.add(b);
      place(b);
    };
    const fill = () => {
      // First wave is spread over the sky so there is something to pop at once; later ones float up from below.
      let k = 0;   // first wave: staggered heights so balloons sharing a lane don't overlap
      const startY = () => (first ? H * (0.12 + (0.8 * k++) / s.max) : H + 10 + Math.random() * H * 0.5);
      const live = [...balloons].filter(b => !b.popped);
      if (!live.some(b => b.word === target)) spawn(target, first ? startY() : H + 10 + Math.random() * 60);
      const others = s.pool.filter(w => w !== target);
      while (balloons.size < s.max) spawn(pick(others), startY());
      first = false;
    };
    const tap = b => {
      if (finished || run.over || b.popped) return;
      b.popped = true;
      if (b.word === target) {
        b.el.classList.add('pop');
        sfx.pop();
        hit(run);
        ti += 1;
        counter.textContent = `${ti}/${s.targets.length}`;
        roundLater(run, () => remove(b), 300);
        if (ti >= s.targets.length) {
          finished = true;
          roundLater(run, () => roundDone(run), 800);
          return;
        }
        target = s.targets[ti];
        promptImg.src = target.img;
        roundLater(run, () => sayWord(target), 400);
      } else {
        b.el.classList.add('pop-wrong');
        miss(run);
        roundLater(run, () => remove(b), 350);
      }
    };
    run.balloonTarget = () => target;   // for the automated test

    let frames = 0;
    roundLoop(run, dt => {
      if (frames++ % 30 === 0) measure();
      for (const b of balloons) {
        if (b.popped) continue;
        b.y -= b.v * dt;
        if (b.y < -170) remove(b); else place(b);
      }
      if (finished) return true;
      fill();
      elapsed += dt;
      clock.style.width = `${Math.max(0, 1 - elapsed / s.time) * 100}%`;
      if (elapsed >= s.time) {
        finished = true;
        stage.querySelector('.ask').textContent = 'Hết giờ rồi!';
        miss(run);
        roundLater(run, () => roundDone(run), 1200);
      }
      return true;
    });
    roundLater(run, () => sayWord(target), 500);
  },

  rush(run, s, stage) {
    let count = 0;
    let elapsed = 0;
    let finished = false;
    let q = null;
    const img = h('img', { alt: '' });
    const wordEl = h('div', { class: 'rush-word', lang: 'en' });
    const counter = h('span', { class: 'pill' }, `0/${s.need}`);
    const clock = h('i', { style: 'width:100%' });
    const card = h('div', { class: 'sticker prompt-card' }, h('span', { class: 'sticker-art' }, img));
    const next = () => {
      const w = pick(s.pool);
      const same = Math.random() < 0.5;
      q = { w, shown: same ? w : pick(s.pool.filter(x => x !== w)), same };
      img.src = q.w.img;
      wordEl.textContent = q.shown.en;
      run.rushQuestion = q;   // for the automated test
    };
    const answer = yes => {
      if (finished || run.over) return;
      if (yes === q.same) {
        count += 1;
        counter.textContent = `${count}/${s.need}`;
        sfx.tick();
        if (count >= s.need) {
          finished = true;
          hit(run);
          roundLater(run, () => roundDone(run), 800);
          return;
        }
      } else {
        card.classList.remove('nope');
        void card.offsetWidth;
        card.classList.add('nope');
        miss(run);
      }
      next();
    };
    stage.append(
      h('div', { class: 'rush-top' }, h('p', { class: 'ask' }, `Nhanh tay! Chữ có đúng tên hình không? Cần ${s.need} câu đúng.`), counter),
      h('span', { class: 'meter clock' }, clock),
      h('div', { class: 'rush-card' }, card, wordEl),
      h('div', { class: 'yes-no' },
        h('button', { class: 'press btn yes', 'data-answer': 'yes', onclick: () => answer(true) }, icon('check'), ' Đúng'),
        h('button', { class: 'press btn no', 'data-answer': 'no', onclick: () => answer(false) }, icon('cross'), ' Sai')));
    keyHandler = e => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'y') answer(true);
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') answer(false);
    };
    next();
    roundLoop(run, dt => {
      if (finished) return false;
      elapsed += dt;
      clock.style.width = `${Math.max(0, 1 - elapsed / s.time) * 100}%`;
      if (elapsed >= s.time) {
        finished = true;
        stage.querySelector('.ask').textContent = 'Hết giờ rồi!';
        miss(run);
        roundLater(run, () => roundDone(run), 1200);
        return false;
      }
      return true;
    });
  },
};

// ---------------------------------------------------------------- boss, win, fail
function bossIntro(run) {
  const { t, plan } = run;
  show(t.id,
    bar(t.boss.vi, 'Ải boss', () => islandScreen(t), null, t.color),
    h('main', { class: 'boss-intro', style: `--topic:${t.color}` },
      h('img', { class: 'boss-big', src: t.boss.img, alt: t.boss.vi }),
      h('h2', {}, `${t.boss.vi} chặn đường!`),
      h('p', {}, `Trả lời đúng ${run.rounds.length} câu trong ${plan.time / 60} phút để đánh bại boss. Bạn có 3 trái tim.`),
      h('button', { class: 'press btn go big', onclick: () => { sfx.tap(); levelScreen(run); } }, 'Chiến thôi!')));
  sayPhrase('boss');
}

function saveLevel(run) {
  const stars = Math.max(1, run.hearts);
  const arr = levelStars(run.t.id);
  const before = arr[run.i];
  arr[run.i] = Math.max(before, stars);
  let newHat = false;
  if (run.plan.boss && run.t.hat && !progress.hats.includes(run.t.hat.id)) {
    progress.hats.push(run.t.hat.id);
    newHat = true;
  }
  saveProgress();
  return { stars, before, newHat };
}

function win(run) {
  const { t, i } = run;
  const { stars, before, newHat } = saveLevel(run);
  if (run.plan.boss) { bossWin(run, stars, newHat); return; }
  show(t.id,
    bar(`Ải ${i + 1}`, run.plan.title, () => islandScreen(t), null, t.color),
    h('main', { class: 'result', style: `--topic:${t.color}` },
      ollie('happy', 'ollie-big'),
      h('div', { class: 'big-stars', 'aria-label': `${stars} sao` }, [0, 1, 2].map(k => starIcon(k < stars))),
      h('h2', {}, ['', 'Qua ải rồi!', 'Giỏi lắm!', 'Tuyệt vời!'][stars]),
      h('p', {}, stars === 3 ? 'Không mất trái tim nào!' : `Còn ${run.hearts} trái tim.`),
      stars > before && before ? h('p', { class: 'new-best' }, 'Kỷ lục mới!') : null,
      h('div', { class: 'actions' },
        h('button', { class: 'press btn go', onclick: () => { sfx.tap(); startLevel(t, i + 1); } }, i + 1 === LEVEL_COUNT - 1 ? 'Đấu boss!' : 'Ải tiếp theo'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); startLevel(t, i); } }, 'Chơi lại'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); islandScreen(t); } }, 'Bản đồ ải'))));
  sfx.stars(stars);
  later(() => sayPhrase('level-complete'), 1000);
  keyHandler = e => { if (e.key === 'Enter') startLevel(t, i + 1); };
}

function bossWin(run, stars, newHat) {
  const { t } = run;
  const next = DATA.topics[DATA.topics.indexOf(t) + 1];
  const reward = h('div', { class: 'reward' });
  const chest = h('button', { class: 'chest', 'aria-label': 'Mở rương báu' }, h('img', { src: DATA.chest.closed, alt: 'Rương báu' }));
  chest.addEventListener('click', () => {
    if (chest.classList.contains('open')) return;
    chest.classList.add('open');
    chest.firstChild.src = DATA.chest.open;
    sfx.fanfare();
    sayPhrase('treasure');
    reward.replaceChildren(
      h('img', { class: 'hat-prize', src: t.hat.img, alt: t.hat.vi }),
      h('p', {}, newHat ? `Bạn nhận được ${t.hat.vi}!` : `Bạn đã có ${t.hat.vi} rồi.`),
      h('button', {
        class: 'press btn go', onclick: () => {
          sfx.tap();
          progress.hat = t.hat.id;
          saveProgress();
          reward.querySelector('p').textContent = `Ollie đang đội ${t.hat.vi}!`;
          reward.append(ollie('happy', 'ollie-preview'));
        },
      }, 'Đội cho Ollie'));
  });
  show(t.id,
    bar(t.boss.vi, 'Đã bị đánh bại!', () => islandScreen(t), null, t.color),
    h('main', { class: 'result boss-win', style: `--topic:${t.color}` },
      h('div', { class: 'boss-win-row' },
        h('img', { class: 'boss-big defeated', src: t.boss.defeated || t.boss.img, alt: `${t.boss.vi} bị hạ` }),
        h('div', {},
          h('div', { class: 'big-stars', 'aria-label': `${stars} sao` }, [0, 1, 2].map(k => starIcon(k < stars))),
          h('h2', {}, 'Chiến thắng!'),
          h('p', {}, `Bạn đã đánh bại ${t.boss.vi}.`),
          h('p', { class: 'tap-hint' }, 'Bấm vào rương để mở!'))),
      h('div', { class: 'treasure' }, chest, reward),
      h('div', { class: 'actions' },
        next ? h('button', { class: 'press btn go', onclick: () => { sfx.tap(); islandScreen(next); } }, `Sang đảo ${next.vi}`) : null,
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); home(next ? `Đảo ${next.vi} đã mở! Lên đường nào!` : 'Bạn đã chinh phục cả 6 hòn đảo!'); } }, 'Về đảo chính'))));
  sfx.fanfare();
  later(() => sayPhrase('you-win'), 900);
}

function fail(run, why) {
  stopRun(run);
  const { t, i } = run;
  show(t.id,
    bar(run.plan.boss ? t.boss.vi : `Ải ${i + 1}`, run.plan.title === 'Boss' ? 'Ải boss' : run.plan.title, () => islandScreen(t), null, t.color),
    h('main', { class: 'result', style: `--topic:${t.color}` },
      ollie('sad', 'ollie-big'),
      h('h2', {}, why === 'time' ? 'Hết giờ rồi!' : 'Hết tim rồi!'),
      h('p', {}, 'Không sao đâu, thử lại là qua thôi!'),
      h('div', { class: 'actions' },
        h('button', { class: 'press btn go', onclick: () => { sfx.tap(); startLevel(t, i); } }, 'Thử lại'),
        h('button', { class: 'press btn', onclick: () => { sfx.tap(); islandScreen(t); } }, 'Bản đồ ải'))));
  sayPhrase(why === 'time' ? 'time-up' : 'oh-no');
  keyHandler = e => { if (e.key === 'Enter') startLevel(t, i); };
}
