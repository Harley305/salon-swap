'use strict';
/* =========================================================
   Myesha's Salon Swap — script.js
   ---------------------------------------------------------
   PHASE 1: board, salon tiles, phone layout, timing loop,
            tap-to-select, versioned saves with backup.
   PHASE 2: swap by swipe or tap-tap; invalid swaps snap back
            with a playful "oops" comment; 3 bad moves in a row
            → a "stuck" comment, then a hint.
   PHASE 3: matches of 3+ clear with a pop, score counts up.
   PHASE 4: gravity + refill from the top, cascades chain,
            dead boards reshuffle automatically.
   PHASE 5: special tiles + combos:
            4 in a row  → Line clear (whole row / column)
            5 in a row  → Glam Ball (clears one color)
            L / T shape → Glitter Blast (3×3 area)
            swap two specials together for bigger combos.
   PHASE 6: 30 handmade levels + endless generated levels, goals,
            move limit, 1–3 stars, blockers (gel, ice, chains, boxes),
            level map, win / lose screens.
   PHASE 7: original music + sound effects (Web Audio), mute, particles,
            floating scores, combo callouts, screen shake, boosters,
            daily gift, idle hint, confetti win celebration.
   Sections:
     1. CONFIG            (personal touches live here)
     2. TILE ART          (all icons drawn in code, original)
     3. SAVE SYSTEM
     4. TWEENS & TIMING   (same speed on 60 / 120 Hz)
     5. BOARD MODEL
     6. LEVELS            (edit / add levels here)
     7. BLOCKER ART
     8. RENDERING
     9. INPUT
    10. GAME
    11. SCREENS & UI
    12. BOOT
   ========================================================= */


/* ---------- 1. CONFIG ---------- */
const CONFIG = {
  playerName: 'Myesha',
  gameName: 'Salon Swap',
  cols: 8,
  rows: 8,
  kinds: 6,           // number of tile types in play (levels can lower this later)
  swapMs: 170,        // how long a swap slide takes
  popMs: 230,         // how long a cleared tile takes to pop away
  pointsPerTile: 60,  // base score per cleared tile (× cascade level)
  maxCascadeMultiplier: 5,
  specialBonus: 150,  // extra points each time a special tile goes off
  chainStepMs: 90,    // delay between links in a chain reaction
  // Stars (levels without a score goal): moves × points-per-move × factor.
  // Fewer tile types = bigger cascades, so they need more points per move.
  scorePerMove: { 4: 1100, 5: 800, 6: 600 },
  star2Factor: 0.85,
  star3Factor: 1.4,
  finaleMaxTiles: 8,  // leftover moves that become Line tiles when she wins
  leftoverBonus: 250, // points per leftover move
  masterVolume: 1.6, // overall loudness (phone speakers are small)
  musicVolume: 0.55,  // 0–1
  sfxVolume: 0.85,    // 0–1
  idleHintMs: 7000,   // show a quiet hint after this long without a move

  // She finished levels 1–30 on the old link before the game moved to GitHub.
  // First visit here marks them complete (1★ each) so she continues at 31.
  // Set to 0 to turn this off.
  alreadyBeatThrough: 30,
  showDebug: false,   // test info line under the board; tap the big title to toggle

  // ===== Chris's messages =====
  // {name} becomes her name (playerName above).

  // Bubble after a swap that doesn't match.
  oopsMessages: [
    'IKYFL!',
    "I'm gonna tell ur momma.",
    '{name}, really?',
  ],

  // After this many bad moves in a row she gets a "stuck" line, then a hint.
  stuckAfter: 3,
  stuckMessages: [
    "Do you know what you're doing?",
    'Need help?',
    'Hmm...',
  ],
  hintMessages: [
    'Here you go',
    'I gotcha',
    'Hint',
  ],

  // Win screen when she passes a level (wired up in Phase 6).
  winMessages: [
    'You always wanna be right',
    'Tell me you love me.',
    'Ready for another level?',
  ],
};


/* ---------- 2. TILE ART ----------
   Each icon is drawn in a 100×100 box, white on a glossy colored tile. */
const WHITE = '#FFFFFF';

function rr(ctx, x, y, w, h, r) {           // rounded rect path (works on older Safari)
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function withRotation(ctx, deg, fn) {
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate(deg * Math.PI / 180);
  ctx.translate(-50, -50);
  fn();
  ctx.restore();
}

function drawComb(ctx, t) {
  withRotation(ctx, -24, () => {
    ctx.fillStyle = WHITE;
    rr(ctx, 20, 30, 60, 15, 6); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const long = i % 2 === 0;
      rr(ctx, 22.5 + i * 6.5, 40, 3.8, long ? 30 : 24, 1.8); ctx.fill();
    }
    ctx.fillStyle = t.dark;
    rr(ctx, 26, 34.5, 48, 3, 1.5); ctx.fill();
  });
}

function drawScissors(ctx, t) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = WHITE;
  // blades
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(42, 58); ctx.lineTo(66, 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(58, 58); ctx.lineTo(34, 20); ctx.stroke();
  // finger loops
  ctx.lineWidth = 6.5;
  ctx.beginPath(); ctx.arc(36, 70, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(64, 70, 10, 0, Math.PI * 2); ctx.stroke();
  // pivot screw
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 45, 4, 0, Math.PI * 2); ctx.fill();
}

function drawBow(ctx, t) {
  ctx.fillStyle = WHITE;
  // tails
  ctx.beginPath();
  ctx.moveTo(47, 52); ctx.lineTo(34, 80); ctx.lineTo(41, 76); ctx.lineTo(45, 82); ctx.lineTo(52, 54);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(53, 52); ctx.lineTo(66, 80); ctx.lineTo(59, 76); ctx.lineTo(55, 82); ctx.lineTo(48, 54);
  ctx.closePath(); ctx.fill();
  // loops
  ctx.beginPath();
  ctx.moveTo(50, 48);
  ctx.bezierCurveTo(36, 24, 12, 26, 16, 46);
  ctx.bezierCurveTo(19, 64, 38, 60, 50, 48);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(50, 48);
  ctx.bezierCurveTo(64, 24, 88, 26, 84, 46);
  ctx.bezierCurveTo(81, 64, 62, 60, 50, 48);
  ctx.fill();
  // loop creases
  ctx.strokeStyle = t.dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(26, 42); ctx.quadraticCurveTo(36, 44, 42, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(74, 42); ctx.quadraticCurveTo(64, 44, 58, 48); ctx.stroke();
  // knot
  ctx.fillStyle = WHITE;
  rr(ctx, 43, 40, 14, 16, 5); ctx.fill();
  ctx.strokeStyle = t.dark; ctx.lineWidth = 2;
  rr(ctx, 43, 40, 14, 16, 5); ctx.stroke();
}

function drawCurler(ctx, t) {
  withRotation(ctx, -32, () => {
    ctx.fillStyle = WHITE;
    rr(ctx, 22, 34, 56, 32, 14); ctx.fill();
    // ridges
    ctx.strokeStyle = t.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = 33 + i * 8.5;
      ctx.beginPath(); ctx.moveTo(x, 38); ctx.lineTo(x, 62); ctx.stroke();
    }
    // bristle dots on the edges
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 6; i++) {
      const x = 28 + i * 8.8;
      ctx.beginPath(); ctx.arc(x, 30, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, 70, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function drawDryer(ctx, t) {
  ctx.fillStyle = WHITE;
  // handle
  withRotation(ctx, 0, () => {
    ctx.save();
    ctx.translate(40, 52); ctx.rotate(-0.22);
    rr(ctx, -8, 0, 16, 30, 6); ctx.fill();
    ctx.restore();
  });
  // body
  rr(ctx, 16, 24, 50, 34, 17); ctx.fill();
  // nozzle
  rr(ctx, 60, 30, 22, 22, 5); ctx.fill();
  // vent
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(33, 41, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(27, 41); ctx.lineTo(39, 41); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(33, 35); ctx.lineTo(33, 47); ctx.stroke();
  // airflow
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(87, 34); ctx.lineTo(93, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(87, 41); ctx.lineTo(94, 41); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(87, 48); ctx.lineTo(93, 50); ctx.stroke();
}

function drawSpray(ctx, t) {
  ctx.fillStyle = WHITE;
  // bottle
  rr(ctx, 30, 44, 34, 40, 9); ctx.fill();
  // neck
  rr(ctx, 39, 34, 16, 13, 3); ctx.fill();
  // trigger head
  ctx.beginPath();
  ctx.moveTo(34, 20); ctx.lineTo(62, 20); ctx.lineTo(70, 25); ctx.lineTo(62, 30);
  ctx.lineTo(58, 36); ctx.lineTo(36, 36); ctx.closePath(); ctx.fill();
  // trigger
  rr(ctx, 56, 30, 6, 12, 3); ctx.fill();
  // label
  ctx.fillStyle = t.dark;
  rr(ctx, 35, 56, 24, 14, 4); ctx.fill();
  // mist
  ctx.fillStyle = WHITE;
  [[77, 17, 2.6], [83, 24, 2.2], [78, 30, 2], [86, 15, 1.8], [88, 31, 1.6]].forEach(([x, y, r]) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
}

const TILE_TYPES = [
  { id: 'comb',     name: 'Comb', plural: 'Combs',        base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawComb },
  { id: 'scissors', name: 'Shears', plural: 'Shears',      base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawScissors },
  { id: 'bow',      name: 'Bow', plural: 'Bows',         base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawBow },
  { id: 'curler',   name: 'Curler', plural: 'Curlers',      base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawCurler },
  { id: 'dryer',    name: 'Blow Dryer', plural: 'Blow Dryers',  base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawDryer },
  { id: 'spray',    name: 'Spritz', plural: 'Spritz Bottles',      base: '#7CC243', light: '#B6E68C', dark: '#4A8420', draw: drawSpray },
];

const BOMB = -2;   // kind used by the Glam Ball (never matches by color)

function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/* Overlay drawn on top of a normal tile to mark it as special. */
function buildSpecialOverlay(type, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);

  if (type === 'lineH' || type === 'lineV') {
    if (type === 'lineV') { ctx.translate(50, 50); ctx.rotate(Math.PI / 2); ctx.translate(-50, -50); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    rr(ctx, 15, 22, 70, 6, 3); ctx.fill();
    rr(ctx, 15, 72, 70, 6, 3); ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(3, 50); ctx.lineTo(14, 41); ctx.lineTo(14, 59); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(97, 50); ctx.lineTo(86, 41); ctx.lineTo(86, 59); ctx.closePath(); ctx.fill();
  } else if (type === 'blast') {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 5]);
    rr(ctx, 9, 8, 82, 80, 19); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 2;
    [[13, 12], [87, 12], [13, 84], [87, 84]].forEach(([x, y]) => {
      sparkle(ctx, x, y, 9, '#FFE7A3');
      sparkle(ctx, x, y, 4, '#FFFFFF');
    });
  }
  return c;
}

/* The Glam Ball (color bomb): a little disco ball. */
function buildBombSprite(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, 6, 9, 88, 88, 22); ctx.fill();
  const g = ctx.createLinearGradient(0, 4, 0, 94);
  g.addColorStop(0, '#2F5C63');
  g.addColorStop(1, '#10242A');
  ctx.fillStyle = g;
  rr(ctx, 5, 4, 90, 88, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(58,175,169,0.95)';
  ctx.lineWidth = 3;
  rr(ctx, 6.5, 5.5, 87, 85, 21); ctx.stroke();

  // string
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(50, 8); ctx.lineTo(50, 22); ctx.stroke();

  // ball
  const bg = ctx.createRadialGradient(41, 40, 3, 50, 52, 31);
  bg.addColorStop(0, '#FFFFFF');
  bg.addColorStop(0.45, '#CBD8DE');
  bg.addColorStop(1, '#5B7380');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(50, 52, 30, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(50, 52, 30, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(30,50,60,0.35)';
  ctx.lineWidth = 1.2;
  for (let y = 26; y <= 80; y += 7) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(82, y); ctx.stroke(); }
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(50, 52, i * 9.5, 30, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(50, 20); ctx.lineTo(50, 84); ctx.stroke();
  [[37, 40, '#3AAFA9'], [57, 33, '#EC5FA5'], [45, 61, '#F4B83A'], [62, 54, '#8C7BEF'], [30, 54, '#FF7E5F'], [54, 69, '#7CC243']]
    .forEach(([x, y, col]) => { ctx.fillStyle = col; ctx.fillRect(x, y, 6, 5); });
  ctx.restore();

  sparkle(ctx, 77, 25, 9, '#FFFFFF');
  sparkle(ctx, 23, 31, 6, '#F4B83A');
  sparkle(ctx, 80, 78, 5, '#8BE6DF');
  return c;
}

/* Pre-render each tile once at screen resolution → fast, crisp drawing. */
function buildTileSprite(type, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);

  // drop shadow under the tile
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, 6, 9, 88, 88, 22); ctx.fill();

  // tile body
  const g = ctx.createLinearGradient(0, 4, 0, 94);
  g.addColorStop(0, type.light);
  g.addColorStop(0.5, type.base);
  g.addColorStop(1, type.dark);
  ctx.fillStyle = g;
  rr(ctx, 5, 4, 90, 88, 22); ctx.fill();

  // rim
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  rr(ctx, 6, 5, 88, 86, 21); ctx.stroke();

  // gloss
  const gl = ctx.createLinearGradient(0, 6, 0, 46);
  gl.addColorStop(0, 'rgba(255,255,255,0.45)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  rr(ctx, 12, 8, 76, 36, 16); ctx.fill();

  // icon, slightly shrunk and with a soft shadow
  ctx.save();
  ctx.translate(50, 49); ctx.scale(0.8, 0.8); ctx.translate(-50, -50);
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2.5;
  type.draw(ctx, type);
  ctx.restore();
  return c;
}


/* ---------- 3. SAVE SYSTEM ----------
   Versioned save + automatic backup of the last good save.
   If the main save is ever corrupted, the backup loads instead. */
const Save = (() => {
  const KEY = 'msalon.save';
  const BACKUP_KEY = 'msalon.save.bak';
  const VERSION = 1;

  const defaults = () => ({
    v: VERSION,
    createdAt: Date.now(),
    savedAt: 0,
    settings: { muted: false, showDebug: CONFIG.showDebug },
    progress: { unlocked: 1, stars: {}, best: {}, fails: {} },
    help: { howTo: false, seen: {}, carriedOver: false },
    boosters: { hammer: 2, shuffle: 2, moves: 2 },    // Phase 7
    daily: { lastClaim: null, streak: 0 },            // Phase 7
    stats: { levelsWon: 0 },
  });

  let data = null;
  let available = true;

  function parse(raw) {
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      return d && typeof d === 'object' && typeof d.v === 'number' ? d : null;
    } catch (e) { return null; }
  }

  // Fill any missing fields from defaults (so new features never break old saves).
  function mergeDefaults(base, saved) {
    for (const k in saved) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) &&
          saved[k] && typeof saved[k] === 'object') {
        mergeDefaults(base[k], saved[k]);
      } else {
        base[k] = saved[k];
      }
    }
    return base;
  }

  function migrate(d) {
    // Future versions go here, oldest first, e.g.:
    // if (d.v === 1) { d.newThing = ...; d.v = 2; }
    const merged = mergeDefaults(defaults(), d);
    merged.v = VERSION;
    return merged;
  }

  function load() {
    let main = null, backup = null;
    try {
      main = parse(localStorage.getItem(KEY));
      backup = parse(localStorage.getItem(BACKUP_KEY));
    } catch (e) { available = false; }
    data = main ? migrate(main) : backup ? migrate(backup) : defaults();
    if (!main && backup) write();   // restore from backup right away
    return data;
  }

  function write() {
    if (!available || !data) return false;
    try {
      const current = localStorage.getItem(KEY);
      if (parse(current)) localStorage.setItem(BACKUP_KEY, current); // keep last good copy
      data.savedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      available = false;  // private mode / storage full — game still plays
      return false;
    }
  }

  return {
    load, write,
    get data() { return data; },
    get ok() { return available; },
    VERSION,
  };
})();


/* ---------- 4. TWEENS & TIMING ----------
   Everything moves by elapsed milliseconds, never by frame count,
   so animations run the same speed on 60 Hz and 120 Hz screens. */
const Ease = {
  linear: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: t => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inCubic: t => t * t * t,
  // Falling: speeds up like gravity, lands, then a tiny bounce.
  fall: t => t < 0.8 ? Math.pow(t / 0.8, 2) : 1 - Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.07,
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

const Tweens = {
  list: [],
  speed: 1,           // testing only: >1 fast-forwards every animation
  // Animate numeric props of obj to target values. Returns a Promise.
  to(obj, props, duration, { delay = 0, ease = Ease.outCubic } = {}) {
    return new Promise(resolve => {
      this.list.push({ obj, props, duration, delay, ease, elapsed: 0, from: null, resolve });
      Loop.wake();
    });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.elapsed += dt;
      if (tw.elapsed < tw.delay) continue;
      if (!tw.from) {
        tw.from = {};
        for (const k in tw.props) tw.from[k] = tw.obj[k];
      }
      const p = Math.min(1, (tw.elapsed - tw.delay) / tw.duration);
      const e = tw.ease(p);
      for (const k in tw.props) tw.obj[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (p >= 1) { this.list.splice(i, 1); tw.resolve(); }
    }
  },
  get busy() { return this.list.length > 0; },
};

/* Short-lived visual effects (beams, rings, zaps). Driven by tweens. */
const FX = {
  list: [],
  play(e, dur, delay = 0) {
    e.p = 0;
    this.list.push(e);
    return Tweens.to(e, { p: 1 }, dur, { delay, ease: Ease.linear }).then(() => {
      const i = this.list.indexOf(e);
      if (i >= 0) this.list.splice(i, 1);
    });
  },
};

const wait = ms => new Promise(r => setTimeout(r, ms));

const Loop = {
  running: false,
  last: 0,
  fps: 0, _fpsAcc: 0, _fpsFrames: 0,
  wake() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },
  frame(now) {
    const dt = Math.min(now - this.last, 50);   // clamp after tab switches
    this.last = now;

    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc >= 500) {
      this.fps = Math.round(this._fpsFrames * 1000 / this._fpsAcc);
      this._fpsAcc = 0; this._fpsFrames = 0;
      UI.updateDebug();
    }

    // A bad frame must never stop the loop — the game would freeze.
    try {
      Tweens.update(dt * Tweens.speed);
      Particles.update(dt);
      Shake.update(dt);
      Confetti.update(dt);
      Render.draw(now);
    } catch (err) {
      console.error(err);
    }

    // Keep running only while something is moving (saves her battery).
    if (Tweens.busy || Game.selected || Game.hint || Particles.list.length || Shake.amt > 0 ||
        Confetti.active || Save.data.settings.showDebug) {
      requestAnimationFrame(t => this.frame(t));
    } else {
      this.running = false;
    }
  },
};


/* ---------- 4b. SOUND & MUSIC ----------
   Everything is synthesized live with Web Audio — no sound files.
   Both tunes are original, written in a sparkly Broadway-pop spirit. */
const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function noteFreq(name) {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const Sound = {
  ctx: null,
  ready: false,

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = Save.data.settings.muted ? 0 : CONFIG.masterVolume;
    // Gentle limiter so lots of sounds at once never crackle.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = CONFIG.musicVolume;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = CONFIG.sfxVolume;
    this.sfxBus.connect(this.master);

    // Sparkle echo shared by the bell sounds.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    this.echo.connect(fb); fb.connect(this.echo);
    this.echo.connect(wet); wet.connect(this.master);

    // White noise for whooshes, clicks and shakers.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return true;
  },

  // iPhone only allows sound after a tap — this runs on her first touch.
  unlock() {
    if (!this.init()) return;
    if (this.ctx.state !== 'running') this.ctx.resume();
    if (!this.ready) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, 22050);
      s.connect(this.ctx.destination);
      s.start(0);
      this.ready = true;
      Music.resume();
    }
  },

  setMuted(m) {
    Save.data.settings.muted = m;
    Save.write();
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : CONFIG.masterVolume, this.ctx.currentTime, 0.05);
    UI.updateSoundButtons();
  },

  now() { return this.ctx ? this.ctx.currentTime : 0; },
  ok() { return this.ready && this.ctx && this.ctx.state === 'running' && !Save.data.settings.muted; },

  // One note with a smooth envelope.
  tone(freq, at, dur, o = {}) {
    const ctx = this.ctx;
    const t = this.now() + Math.max(0, at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || this.sfxBus);
    if (o.echo) g.connect(this.echo);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noiseHit(at, dur, o = {}) {
    const ctx = this.ctx;
    const t = this.now() + Math.max(0, at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol == null ? 0.15 : o.vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },

  // A magical bell: pure tone + a quiet shimmering overtone.
  bell(freq, at = 0, vol = 0.15, dur = 0.9, bus) {
    this.tone(freq, at, dur, { vol, echo: !bus, bus });
    this.tone(freq * 2.76, at, dur * 0.45, { vol: vol * 0.16, bus });
    this.tone(freq * 2, at, dur * 0.4, { type: 'triangle', vol: vol * 0.1, bus });
  },

  pluck(freq, at = 0, vol = 0.12, dur = 0.3, bus) {
    this.tone(freq, at, dur, { type: 'triangle', vol, bus, lowpass: 3200 });
    this.tone(freq * 2, at, dur * 0.5, { vol: vol * 0.22, bus });
  },

  play(name, at = 0, arg) {
    if (!this.ok()) return;
    const fn = SFX[name];
    if (fn) { try { fn(this, at, arg); } catch (e) { /* never let a sound break the game */ } }
  },
};

const SPARKLE = ['G5', 'A5', 'B5', 'D6', 'E6', 'G6', 'A6', 'B6', 'D7', 'E7'].map(noteFreq);

const SFX = {
  tap:     (S, at) => S.pluck(noteFreq('E6'), at, 0.07, 0.14),
  button:  (S, at) => S.pluck(noteFreq('B5'), at, 0.09, 0.2),
  swap:    (S, at) => S.noiseHit(at, 0.16, { freq: 700, sweep: 2600, q: 1.2, vol: 0.2 }),
  nope:    (S, at) => {
    S.tone(noteFreq('E5'), at, 0.16, { type: 'triangle', vol: 0.13, glide: noteFreq('D#5') });
    S.tone(noteFreq('C5'), at + 0.15, 0.3, { type: 'triangle', vol: 0.13, glide: noteFreq('A#4') });
  },
  // Each wave of a cascade sparkles a little higher.
  match:   (S, at, cascade = 1) => {
    const i = Math.min(SPARKLE.length - 3, cascade - 1);
    S.bell(SPARKLE[i], at, 0.11, 0.55);
    S.bell(SPARKLE[i + 2], at + 0.06, 0.09, 0.55);
    S.noiseHit(at, 0.06, { freq: 2500, vol: 0.05 });
  },
  special: (S, at) => [0, 2, 4, 7].forEach((k, j) => S.bell(SPARKLE[k], at + j * 0.05, 0.1, 0.5)),
  zap:     (S, at) => {
    S.tone(1400, at, 0.32, { type: 'sawtooth', vol: 0.05, glide: 220, lowpass: 2400 });
    S.noiseHit(at, 0.3, { freq: 3000, sweep: 600, vol: 0.09 });
  },
  blast:   (S, at) => {
    S.tone(150, at, 0.45, { vol: 0.32, glide: 45 });
    S.noiseHit(at, 0.35, { filter: 'lowpass', freq: 900, sweep: 120, vol: 0.22 });
    S.bell(SPARKLE[4], at + 0.02, 0.07, 0.6);
  },
  glam:    (S, at) => {
    for (let i = 0; i < 9; i++) S.bell(SPARKLE[i], at + i * 0.04, 0.08, 0.6);
    S.noiseHit(at, 0.6, { freq: 6000, q: 0.7, vol: 0.05 });
  },
  boom:    (S, at) => {
    S.tone(110, at, 0.8, { vol: 0.36, glide: 35 });
    S.noiseHit(at, 0.7, { filter: 'lowpass', freq: 1200, sweep: 80, vol: 0.26 });
  },
  thud:    (S, at) => {
    S.tone(190, at, 0.18, { type: 'triangle', vol: 0.2, glide: 90 });
    S.noiseHit(at, 0.1, { filter: 'lowpass', freq: 700, vol: 0.1 });
  },
  crack:   (S, at) => {
    S.noiseHit(at, 0.09, { filter: 'highpass', freq: 3500, vol: 0.16 });
    S.tone(2400, at, 0.08, { vol: 0.04 });
  },
  clink:   (S, at) => {
    S.tone(2093, at, 0.25, { vol: 0.06 });
    S.tone(3136, at + 0.03, 0.22, { vol: 0.045 });
  },
  squish:  (S, at) => S.tone(260, at, 0.16, { vol: 0.14, glide: 520 }),
  // A little twister.
  twister: (S, at) => {
    S.noiseHit(at, 0.9, { freq: 300, sweep: 2400, q: 2.5, vol: 0.28, attack: 0.25 });
    S.noiseHit(at + 0.3, 0.6, { freq: 2400, sweep: 400, q: 2.5, vol: 0.18 });
  },
  twinkle: (S, at) => { S.bell(SPARKLE[5], at, 0.06, 0.5); S.bell(SPARKLE[7], at + 0.12, 0.05, 0.5); },
  // Click, click, click…
  heelClicks: (S, at) => {
    for (let i = 0; i < 3; i++) {
      S.noiseHit(at + i * 0.17, 0.05, { filter: 'highpass', freq: 2500, vol: 0.22 });
      S.tone(1800, at + i * 0.17, 0.05, { type: 'square', vol: 0.025 });
    }
  },
  fanfare: (S, at) => {
    ['G4', 'B4', 'D5', 'G5', 'B5', 'D6'].forEach((n, i) => S.bell(noteFreq(n), at + i * 0.07, 0.11, 1.2));
    ['G3', 'D4', 'B4'].forEach(n => S.tone(noteFreq(n), at + 0.45, 1.4, { type: 'triangle', vol: 0.06, attack: 0.04 }));
  },
  star:    (S, at, i = 1) => S.bell(noteFreq(['D6', 'G6', 'B6'][Math.min(2, i - 1)]), at, 0.14, 1.1),
  lose:    (S, at) => ['D5', 'Bb4', 'G4', 'D4'].forEach((n, i) =>
    S.tone(noteFreq(n), at + i * 0.22, 0.5, { type: 'triangle', vol: 0.1, lowpass: 2000 })),
  gift:    (S, at) => [0, 2, 4, 5, 7, 9].forEach((k, i) => S.bell(SPARKLE[k], at + i * 0.06, 0.09, 0.8)),
  hammer:  (S, at) => { SFX.thud(S, at); S.bell(SPARKLE[3], at + 0.03, 0.08, 0.5); },
};

/* Original tunes. Each bar has 8 eighth notes; '-' means rest/hold.
   chord = [bass, then the chord notes]. */
const SONGS = {
  // "The Road to the Salon" — bouncy march for the title and map.
  road: { bpm: 112, style: 'march', bars: [
    { chord: ['G2', 'B3', 'D4', 'G4'],  mel: ['D5', '-', 'G5', '-', 'B5', '-', 'A5', 'G5'] },
    { chord: ['E2', 'B3', 'E4', 'G4'],  mel: ['E5', '-', 'G5', '-', 'B5', '-', '-', '-'] },
    { chord: ['C3', 'C4', 'E4', 'G4'],  mel: ['C6', '-', 'B5', 'A5', 'G5', '-', 'E5', '-'] },
    { chord: ['D2', 'A3', 'D4', 'F#4'], mel: ['F#5', '-', 'A5', '-', 'D6', '-', '-', '-'] },
    { chord: ['G2', 'B3', 'D4', 'G4'],  mel: ['B5', '-', 'D6', '-', 'G6', '-', 'F#6', 'E6'] },
    { chord: ['B2', 'A3', 'D#4', 'F#4'], mel: ['D#6', '-', 'B5', '-', 'F#5', '-', 'A5', '-'] },
    { chord: ['C3', 'C4', 'Eb4', 'G4'], mel: ['G5', '-', 'Eb5', '-', 'G5', '-', 'C6', '-'] },
    { chord: ['D2', 'A3', 'C4', 'F#4'], mel: ['D6', '-', 'C6', '-', 'A5', '-', 'F#5', '-'] },
  ] },
  // "Emerald Evening" — dreamy, sparkly loop while she plays.
  emerald: { bpm: 88, style: 'dream', bars: [
    { chord: ['D2', 'A3', 'D4', 'F#4'],  mel: ['A5', '-', '-', '-', 'F#5', '-', '-', '-'] },
    { chord: ['B1', 'F#3', 'B3', 'D4'],  mel: ['B5', '-', '-', '-', 'D6', '-', 'C#6', '-'] },
    { chord: ['G2', 'D4', 'G4', 'B4'],   mel: ['B5', '-', 'A5', '-', 'G5', '-', '-', '-'] },
    { chord: ['A2', 'E4', 'A4', 'C#5'],  mel: ['A5', '-', '-', '-', 'E5', '-', '-', '-'] },
    { chord: ['F#2', 'C#4', 'F#4', 'A4'], mel: ['F#5', '-', 'A5', '-', 'C#6', '-', '-', '-'] },
    { chord: ['B1', 'D4', 'F#4', 'B4'],  mel: ['D6', '-', 'C#6', '-', 'B5', '-', 'F#5', '-'] },
    { chord: ['G2', 'B3', 'D4', 'G4'],   mel: ['G5', '-', 'B5', '-', 'D6', '-', 'E6', '-'] },
    { chord: ['G2', 'Bb3', 'D4', 'G4'],  mel: ['D6', '-', '-', '-', 'Bb5', '-', 'A5', '-'] },
  ] },
};

const Music = {
  want: null,
  playing: null,
  song: null,
  step: 0,
  next: 0,
  timer: 0,

  play(name) {
    this.want = name;
    if (this.playing === name) return;
    this.stop();
    this.resume();
  },

  resume() {
    if (!this.want || this.playing === this.want || !Sound.ready) return;
    this.playing = this.want;
    this.song = SONGS[this.want];
    this.step = 0;
    this.next = Sound.now() + 0.15;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 30);
  },

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.playing = null;
  },

  // Look-ahead scheduler: notes are booked slightly ahead on the audio clock,
  // so the beat stays steady even if the screen stutters.
  tick() {
    if (!Sound.ctx || Sound.ctx.state !== 'running') return;
    const eighth = 60 / this.song.bpm / 2;
    if (this.next < Sound.now() - 0.3) this.next = Sound.now() + 0.05;   // after a pause
    while (this.next < Sound.now() + 0.15) {
      if (!Save.data.settings.muted) this.schedule(this.step, this.next - Sound.now(), eighth);
      this.next += eighth;
      this.step = (this.step + 1) % (this.song.bars.length * 8);
    }
  },

  schedule(step, at, eighth) {
    const S = Sound, bus = S.musicBus, song = this.song;
    const bar = song.bars[Math.floor(step / 8)];
    const s = step % 8;
    const ch = bar.chord.map(noteFreq);
    const mel = bar.mel[s];
    if (song.style === 'march') {
      if (s === 0) S.tone(ch[0], at, eighth * 1.8, { type: 'triangle', vol: 0.22, bus });
      if (s === 4) S.tone(ch[0] * 1.5, at, eighth * 1.8, { type: 'triangle', vol: 0.17, bus });
      if (s === 2 || s === 6) ch.slice(1).forEach(f => S.pluck(f, at, 0.045, eighth * 1.4, bus));
      if (s % 2 === 1) S.noiseHit(at, 0.04, { filter: 'highpass', freq: 7000, vol: 0.02, bus });
      if (mel !== '-') S.bell(noteFreq(mel), at, 0.07, eighth * 3, bus);
    } else {
      if (s === 0) {
        S.tone(ch[0], at, eighth * 7, { vol: 0.17, attack: 0.05, bus });
        ch.slice(1).forEach(f => {
          S.tone(f, at, eighth * 8.5, { type: 'triangle', vol: 0.03, attack: 0.35, bus, lowpass: 1800 });
          S.tone(f, at, eighth * 8.5, { vol: 0.025, attack: 0.4, detune: 8, bus });
        });
      }
      const arp = ch.slice(1);
      S.pluck(arp[[0, 1, 2, 1, 0, 1, 2, 1][s]] * 2, at, 0.03, eighth * 1.6, bus);
      if (mel !== '-') S.bell(noteFreq(mel), at, 0.065, eighth * 4, bus);
    }
  },
};


/* ---------- 4c. PARTICLES, SHAKE, CONFETTI ---------- */
const Particles = {
  list: [],
  // x, y in board cells
  burst(x, y, color, n, o = {}) {
    for (let i = 0; i < n && this.list.length < 360; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 4) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.lift == null ? 2 : o.lift),
        life: 0,
        max: (o.life || 650) * (0.7 + Math.random() * 0.6),
        size: (o.size || 0.08) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color,
        star: !!o.star,
      });
    }
    Loop.wake();
  },
  update(dt) {
    const s = dt / 1000;
    const drag = Math.exp(-2.2 * s);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life >= p.max) { this.list.splice(i, 1); continue; }
      p.vy += 12 * s;
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * s; p.y += p.vy * s;
    }
  },
  draw(ctx, cell) {
    for (const p of this.list) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      const r = p.size * cell * (0.5 + 0.5 * a);
      if (p.star) {
        sparkle(ctx, p.x * cell, p.y * cell, r * 1.8, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x * cell, p.y * cell, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};

const Shake = {
  amt: 0,
  el: null,
  add(v) { this.amt = Math.min(1, Math.max(this.amt, v)); Loop.wake(); },
  update(dt) {
    if (!this.el) this.el = document.querySelector('.board-frame');
    if (!this.el || this.amt <= 0) return;
    this.amt = Math.max(0, this.amt - dt / 400);
    const m = this.amt * 9;
    this.el.style.transform = this.amt > 0
      ? `translate(${((Math.random() * 2 - 1) * m).toFixed(1)}px, ${((Math.random() * 2 - 1) * m).toFixed(1)}px)`
      : '';
  },
};

// Green-and-pink confetti for the win screen.
const Confetti = {
  list: [],
  canvas: null,
  ctx: null,
  colors: ['#2ECC71', '#7CE0A3', '#F7A8D8', '#EC5FA5', '#F4B83A', '#3AAFA9', '#FFFFFF'],
  burst(n = 150) {
    if (!this.canvas) { this.canvas = document.getElementById('confetti'); this.ctx = this.canvas.getContext('2d'); }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      this.list.push({
        x: fromLeft ? -10 : w + 10,
        y: h * (0.35 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 320),
        vy: -(380 + Math.random() * 420),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
        size: 6 + Math.random() * 7,
        color: this.colors[i % this.colors.length],
        life: 0, max: 2600 + Math.random() * 1200,
      });
    }
    Loop.wake();
  },
  get active() { return this.list.length > 0; },
  update(dt) {
    if (!this.list.length) return;
    const s = dt / 1000;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life > p.max || p.y > this.h + 40) { this.list.splice(i, 1); continue; }
      p.vy += 700 * s;
      p.vx *= Math.exp(-1.2 * s);
      p.vy = Math.min(p.vy, 260);
      p.x += p.vx * s; p.y += p.vy * s;
      p.rot += p.vr * s;
    }
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);          // also wipes the last frame when it ends
    for (const p of this.list) {
      c.save();
      c.globalAlpha = Math.min(1, (p.max - p.life) / 500);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(p.rot * 2))));
      c.restore();
    }
  },
};

const COMBO_WORDS = { 3: 'Gorgeous!', 4: 'Fabulous!', 5: 'Popular!', 6: 'Wicked!' };


/* ---------- 4d. DAILY GIFT ---------- */
const Daily = {
  // Day 1 → 7, then the streak starts over. Missing a day resets to day 1.
  REWARDS: [
    { hammer: 1 },
    { shuffle: 1 },
    { moves: 1 },
    { hammer: 1, shuffle: 1 },
    { moves: 2 },
    { hammer: 2 },
    { hammer: 2, shuffle: 2, moves: 2 },
  ],
  key(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  today() { return this.key(new Date()); },
  yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return this.key(d); },
  available() { return Save.data.daily.lastClaim !== this.today(); },
  nextDay() {
    const dl = Save.data.daily;
    return dl.lastClaim === this.yesterday() ? (dl.streak % 7) + 1 : 1;
  },
  claim() {
    const day = this.nextDay();
    const reward = this.REWARDS[day - 1];
    Object.keys(reward).forEach(k => { Save.data.boosters[k] = (Save.data.boosters[k] || 0) + reward[k]; });
    Save.data.daily = { lastClaim: this.today(), streak: day };
    Save.write();
    return { day, reward };
  },
};

/* ---------- 5. BOARD MODEL ----------
   grid[r][c]  → the tile in that cell (or null)
   cells[r][c] → what's under/around it: { gel, box, shake }
   tile.lock   → { type: 'ice' | 'chain', layers } — locked tiles can't
                 be swapped and don't fall, but still match by color. */
let nextTileId = 1;

function makeTile(kind, r, c) {
  return {
    id: nextTileId++,
    kind,
    r, c,          // logical cell
    x: c, y: r,    // drawn position in cell units (animated)
    scale: 1,
    alpha: 1,
    shake: 0,      // wobble when a lock cracks
    special: null, // 'lineH' | 'lineV' | 'bomb' | 'blast'
    lock: null,    // { type: 'ice' | 'chain', layers }
  };
}

function blankSpec(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ gel: 0, box: 0, lock: null })));
}

const Board = {
  rows: CONFIG.rows,
  cols: CONFIG.cols,
  grid: [],
  cells: [],
  kinds: CONFIG.kinds,

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; },
  kindAt(r, c) { const t = this.inBounds(r, c) && this.grid[r] && this.grid[r][c]; return t ? t.kind : -1; },
  movable(r, c) { const t = this.inBounds(r, c) && this.grid[r][c]; return !!t && !t.lock; },
  randomKind() { return Math.floor(Math.random() * this.kinds); },

  // Build the board for a level: blockers from the layout, tiles everywhere else.
  setup(spec, kinds) {
    this.kinds = kinds;
    spec = spec || blankSpec(this.rows, this.cols);
    this.cells = spec.map(row => row.map(s => ({ gel: s.gel, box: s.box, shake: 0 })));
    this.grid = spec.map(row => row.map(() => null));

    // No starting matches, and at least one move.
    for (let attempt = 0; attempt < 300; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.cells[r][c].box) { this.grid[r][c] = null; continue; }
          let k, guard = 0;
          do {
            k = this.randomKind();
            guard++;
          } while (guard < 60 && (
            (this.kindAt(r, c - 1) === k && this.kindAt(r, c - 2) === k) ||
            (this.kindAt(r - 1, c) === k && this.kindAt(r - 2, c) === k)
          ));
          const t = makeTile(k, r, c);
          if (spec[r][c].lock) t.lock = { type: spec[r][c].lock.type, layers: spec[r][c].lock.layers };
          this.grid[r][c] = t;
        }
      }
      if (!this.hasAnyMatch() && this.findMoves().length) return;
    }
  },

  // Plain board with no blockers (used by tests / free play).
  generate(kinds = CONFIG.kinds) { this.setup(null, kinds); },

  // Length of the run of same-kind tiles through (r,c) in one direction pair.
  runLength(kinds, r, c, dr, dc) {
    const k = kinds[r][c];
    if (k < 0) return 0;
    let n = 1;
    for (let i = 1; this.inBounds(r + dr * i, c + dc * i) && kinds[r + dr * i][c + dc * i] === k; i++) n++;
    for (let i = 1; this.inBounds(r - dr * i, c - dc * i) && kinds[r - dr * i][c - dc * i] === k; i++) n++;
    return n;
  },

  matchesAt(kinds, r, c) {
    return this.runLength(kinds, r, c, 0, 1) >= 3 || this.runLength(kinds, r, c, 1, 0) >= 3;
  },

  kindsMatrix() {
    return this.grid.map(row => row.map(t => (t ? t.kind : -1)));
  },

  hasAnyMatch() {
    const k = this.kindsMatrix();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.matchesAt(k, r, c)) return true;
    return false;
  },

  // Every swap that would do something. Used for hints + dead-board detection.
  findMoves() {
    const k = this.kindsMatrix();
    const moves = [];
    const trySwap = (r1, c1, r2, c2) => {
      if (!this.inBounds(r2, c2)) return;
      if (!this.movable(r1, c1) || !this.movable(r2, c2)) return;
      const t1 = this.grid[r1][c1], t2 = this.grid[r2][c2];
      if (t1.special === 'bomb' || t2.special === 'bomb' || (t1.special && t2.special)) {
        moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });   // special combos always work
        return;
      }
      const a = k[r1][c1], b = k[r2][c2];
      if (a < 0 || b < 0 || a === b) return;
      k[r1][c1] = b; k[r2][c2] = a;
      if (this.matchesAt(k, r1, c1) || this.matchesAt(k, r2, c2)) {
        moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });
      }
      k[r1][c1] = a; k[r2][c2] = b;
    };
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        trySwap(r, c, r, c + 1);
        trySwap(r, c, r + 1, c);
      }
    return moves;
  },

  // All runs of 3+ in a row or column (with length + direction for specials).
  findMatches() {
    const k = this.kindsMatrix();
    const runs = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const kind = k[r][c];
        let e = c + 1;
        while (kind >= 0 && e < this.cols && k[r][e] === kind) e++;
        if (kind >= 0 && e - c >= 3) {
          const cells = [];
          for (let i = c; i < e; i++) cells.push({ r, c: i });
          runs.push({ dir: 'h', kind, len: e - c, cells });
        }
        c = e;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const kind = k[r][c];
        let e = r + 1;
        while (kind >= 0 && e < this.rows && k[e][c] === kind) e++;
        if (kind >= 0 && e - r >= 3) {
          const cells = [];
          for (let i = r; i < e; i++) cells.push({ r: i, c });
          runs.push({ dir: 'v', kind, len: e - r, cells });
        }
        r = e;
      }
    }
    return runs;
  },

  swap(a, b) {
    const t1 = this.grid[a.r][a.c], t2 = this.grid[b.r][b.c];
    this.grid[a.r][a.c] = t2; this.grid[b.r][b.c] = t1;
    t1.r = b.r; t1.c = b.c;
    t2.r = a.r; t2.c = a.c;
  },

  forEachTile(fn) {
    for (let r = 0; r < this.grid.length; r++)
      for (let c = 0; c < this.grid[r].length; c++)
        if (this.grid[r][c]) fn(this.grid[r][c], r, c);
  },
};


/* ---------- 6. LEVELS ----------
   Edit freely! Each level is one entry.

   moves  — how many moves she gets
   kinds  — how many tile types appear (4 = easy, 6 = hardest)
   goals  — ['collect', 'bow', 20]   clear 20 bows
              (comb, scissors, bow, curler, dryer, spray)
            ['score', 5000]          reach 5,000 points
            blockers in the layout automatically become goals too
   tip    — optional bubble at the start of the level
   layout — 8 rows × 8 characters:
     .  normal
     j  gel            J  double gel      (clear tiles on top of it)
     i  ice            I  double ice      (match the frozen tile)
     h  chain          H  double chain    (match the chained tile)
     b  box            B  2-hit box     X  3-hit box   (match next to it)
*/
const LEVELS = [
  /* 1 */ { moves: 15, kinds: 4, goals: [['collect', 'comb', 30]], tip: 'Swipe two tiles to match 3!' },
  /* 2 */ { moves: 18, kinds: 4, goals: [['collect', 'bow', 30], ['collect', 'scissors', 30]] },
  /* 3 */ { moves: 18, kinds: 5, goals: [['score', 12000]], tip: 'Cascades score extra!' },
  /* 4 */ { moves: 20, kinds: 5, goals: [['collect', 'curler', 26]], tip: 'Match 4 to make a Line tile!' },
  /* 5 */ { moves: 18, kinds: 5, goals: [], tip: 'Match on top of the gel to clear it.', layout: [
    '........',
    '........',
    '........',
    '..jjjj..',
    '..jjjj..',
    '........',
    '........',
    '........'] },
  /* 6 */ { moves: 20, kinds: 5, goals: [], tip: 'Match frozen tiles to crack the ice.', layout: [
    '........',
    '........',
    '.i....i.',
    '........',
    '........',
    '.i....i.',
    '........',
    '........'] },
  /* 7 */ { moves: 22, kinds: 5, goals: [], tip: 'Make an L or T shape for a Glitter Blast!', layout: [
    '........',
    '.jj..jj.',
    '.jj..jj.',
    '........',
    '........',
    '.jj..jj.',
    '.jj..jj.',
    '........'] },
  /* 8 */ { moves: 22, kinds: 5, goals: [['collect', 'comb', 32], ['collect', 'bow', 32]], tip: 'Line up 5 for a Glam Ball!' },
  /* 9 */ { moves: 18, kinds: 5, goals: [], tip: 'Match next to boxes to break them.', layout: [
    '........',
    '........',
    '........',
    'bbb..bbb',
    '........',
    '........',
    '........',
    '........'] },
  /* 10 */ { moves: 25, kinds: 5, goals: [['score', 22000]], breather: true },
  /* 11 */ { moves: 21, kinds: 5, goals: [], tip: 'Pink gel takes two hits!', layout: [
    '........',
    '........',
    '..JJJJ..',
    '..JJJJ..',
    '..JJJJ..',
    '..JJJJ..',
    '........',
    '........'] },
  /* 12 */ { moves: 22, kinds: 5, goals: [], layout: [
    '........',
    '.I....I.',
    '........',
    '...ii...',
    '...ii...',
    '........',
    '.I....I.',
    '........'] },
  /* 13 */ { moves: 26, kinds: 6, goals: [['collect', 'dryer', 22]], tip: 'All six styles are in the salon now!' },
  /* 14 */ { moves: 22, kinds: 5, goals: [], tip: "Chained tiles can't move. Match them to break free!", layout: [
    '........',
    '........',
    '.hh..hh.',
    '........',
    '........',
    '.hh..hh.',
    '........',
    '........'] },
  /* 15 */ { moves: 20, kinds: 5, goals: [], breather: true, layout: [
    '........',
    '........',
    '........',
    'jjjjjjjj',
    '........',
    '........',
    '........',
    '........'] },
  /* 16 */ { moves: 29, kinds: 6, goals: [['collect', 'spray', 18]], layout: [
    '........',
    '........',
    'b......b',
    'bb....bb',
    'bb....bb',
    'b......b',
    '........',
    '........'] },
  /* 17 */ { moves: 27, kinds: 6, goals: [], layout: [
    '........',
    '.j....j.',
    '..j..j..',
    '...ii...',
    '...ii...',
    '..j..j..',
    '.j....j.',
    '........'] },
  /* 18 */ { moves: 28, kinds: 6, goals: [['collect', 'scissors', 18]], layout: [
    '........',
    '...hh...',
    '........',
    '.h....h.',
    '.h....h.',
    '........',
    '...hh...',
    '........'] },
  /* 19 */ { moves: 22, kinds: 6, goals: [], tip: 'Darker boxes take more hits.', layout: [
    '........',
    '........',
    '..BBBB..',
    '........',
    '........',
    '..BBBB..',
    '........',
    '........'] },
  /* 20 */ { moves: 28, kinds: 5, goals: [['score', 36000]], breather: true },
  /* 21 */ { moves: 26, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.J....J.',
    '.j....j.',
    '.j....j.',
    '.J....J.',
    '.jjjjjj.',
    '........'] },
  /* 22 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.I.bb.I.',
    '........',
    'i......i',
    'i......i',
    '........',
    '.I.bb.I.',
    '........'] },
  /* 23 */ { moves: 29, kinds: 6, goals: [], layout: [
    '........',
    '.jj..jj.',
    '.jh..hj.',
    '...hh...',
    '...hh...',
    '.jh..hj.',
    '.jj..jj.',
    '........'] },
  /* 24 */ { moves: 24, kinds: 6, goals: [['collect', 'comb', 20], ['collect', 'bow', 20], ['collect', 'curler', 20]] },
  /* 25 */ { moves: 28, kinds: 5, goals: [], breather: true, layout: [
    '........',
    '........',
    '...bb...',
    '.j....j.',
    '.j....j.',
    '...ii...',
    '........',
    '........'] },
  /* 26 */ { moves: 28, kinds: 6, goals: [], layout: [
    '........',
    '.BX..XB.',
    '.B....B.',
    '........',
    '........',
    '.B....B.',
    '.BX..XB.',
    '........'] },
  /* 27 */ { moves: 33, kinds: 6, goals: [], layout: [
    '.jjjjjj.',
    'j......j',
    'j......j',
    'j......j',
    'j......j',
    'j......j',
    'j......j',
    '.jjjjjj.'] },
  /* 28 */ { moves: 27, kinds: 6, goals: [['collect', 'spray', 20]], layout: [
    '........',
    '.i.hh.i.',
    '........',
    '.h....h.',
    '.h....h.',
    '........',
    '.i.hh.i.',
    '........'] },
  /* 29 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.jj..jj.',
    '.j.bb.j.',
    '.h.ii.h.',
    '.h.ii.h.',
    '.j.bb.j.',
    '.jj..jj.',
    '........'] },
  /* 30 */ { moves: 32, kinds: 6, goals: [['collect', 'bow', 20]], tip: 'Grand finale!', layout: [
    '...hh...',
    '.jjjjjj.',
    '.jI..Ij.',
    '.j.BB.j.',
    '.j.BB.j.',
    '.jI..Ij.',
    '.jjjjjj.',
    '...hh...'] },
];

/* Levels after the handmade ones are generated — the same level number
   always makes the same level, and they keep getting harder (gently). */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLevel(n) {
  const rnd = seededRandom(n * 7919 + 13);
  const tier = Math.min(1, (n - LEVELS.length) / 60);   // ramps over 60 levels, then holds
  const breather = n % 5 === 0;
  const kinds = breather ? 5 : 6;
  let moves = Math.round(29 - 3 * tier) + (breather ? 3 : 0);
  const density = (0.14 + 0.10 * tier) * (breather ? 0.6 : 1);

  const types = ['gel', 'ice', 'chain', 'box'];
  const howMany = rnd() < 0.35 + 0.35 * tier ? 2 : 1;
  const chosen = [];
  while (chosen.length < howMany) {
    const t = types[Math.floor(rnd() * types.length)];
    if (!chosen.includes(t)) chosen.push(t);
  }
  const heavy = !breather && rnd() < 0.3 + 0.35 * tier;
  const ch = { gel: heavy ? 'J' : 'j', ice: heavy ? 'I' : 'i', chain: heavy ? 'H' : 'h', box: heavy ? 'B' : 'b' };

  const grid = Array.from({ length: 8 }, () => Array(8).fill('.'));
  chosen.forEach(type => {
    const pairs = Math.max(2, Math.round((32 * density) / howMany));
    for (let placed = 0, tries = 0; placed < pairs && tries < 300; tries++) {
      const r = Math.floor(rnd() * 8), c = 1 + Math.floor(rnd() * 3);   // never the side edges
      if (grid[r][c] !== '.') continue;
      grid[r][c] = grid[r][7 - c] = ch[type];     // mirrored = nicer looking
      placed++;
    }
  });

  const goals = [];
  if (rnd() < 0.45) {
    goals.push(['collect', TILE_TYPES[Math.floor(rnd() * kinds)].id, Math.round(16 + 12 * tier)]);
    moves += 2;
  }
  return { moves, kinds, goals, breather, layout: grid.map(row => row.join('')) };
}

/* Turn a level entry into everything the game needs. */
function buildLevel(n) {
  const raw = n <= LEVELS.length ? LEVELS[n - 1] : generateLevel(n);
  const layout = raw.layout || [];
  const spec = blankSpec(CONFIG.rows, CONFIG.cols);
  const counts = { gel: 0, ice: 0, chain: 0, box: 0 };

  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      const s = spec[r][c];
      switch ((layout[r] || '')[c] || '.') {
        case 'j': s.gel = 1; counts.gel++; break;
        case 'J': s.gel = 2; counts.gel++; break;
        case 'i': s.lock = { type: 'ice', layers: 1 }; counts.ice++; break;
        case 'I': s.lock = { type: 'ice', layers: 2 }; counts.ice++; break;
        case 'h': s.lock = { type: 'chain', layers: 1 }; counts.chain++; break;
        case 'H': s.lock = { type: 'chain', layers: 2 }; counts.chain++; break;
        case 'b': s.box = 1; counts.box++; break;
        case 'B': s.box = 2; counts.box++; break;
        case 'X': s.box = 3; counts.box++; break;
      }
    }
  }

  const goals = raw.goals.map(g => {
    if (g[0] === 'collect') return { type: 'collect', kind: TILE_TYPES.findIndex(t => t.id === g[1]), need: g[2], have: 0 };
    if (g[0] === 'score') return { type: 'score', need: g[1], have: 0 };
    return { type: g[0], need: counts[g[0]] || 0, have: 0 };
  });
  ['gel', 'ice', 'chain', 'box'].forEach(t => {
    if (counts[t] && !goals.some(g => g.type === t)) goals.push({ type: t, need: counts[t], have: 0 });
  });

  const round100 = v => Math.round(v / 100) * 100;
  const perMove = CONFIG.scorePerMove[raw.kinds || 6] || 600;
  const scoreGoal = goals.find(g => g.type === 'score');
  const stars = scoreGoal
    ? [scoreGoal.need, round100(scoreGoal.need * 1.3), round100(scoreGoal.need * 1.6)]
    : [0, round100(raw.moves * perMove * CONFIG.star2Factor), round100(raw.moves * perMove * CONFIG.star3Factor)];

  return { n, moves: raw.moves, kinds: raw.kinds || 6, goals, spec, stars, tip: raw.tip || '' };
}

/* ---------- 7. BLOCKER ART ---------- */
function makeCanvas(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);
  return [c, ctx];
}

/* Pink styling gel under tiles. */
function buildGelSprite(px, layers) {
  const [c, ctx] = makeCanvas(px);
  const a = layers > 1 ? 0.62 : 0.36;
  const g = ctx.createLinearGradient(0, 0, 0, 100);
  g.addColorStop(0, `rgba(255,160,210,${a})`);
  g.addColorStop(1, `rgba(236,95,165,${a})`);
  ctx.fillStyle = g;
  rr(ctx, 2, 2, 96, 96, 20); ctx.fill();
  ctx.strokeStyle = `rgba(255,205,232,${Math.min(1, a + 0.25)})`;
  ctx.lineWidth = 3;
  rr(ctx, 3.5, 3.5, 93, 93, 19); ctx.stroke();
  if (layers > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2.5;
    rr(ctx, 10, 10, 80, 80, 14); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  [[14, 15, 4.5], [24, 10, 2.6], [86, 86, 3.5]].forEach(([x, y, r]) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  return c;
}

/* Ice frozen over a tile. */
function buildIceSprite(px, layers) {
  const [c, ctx] = makeCanvas(px);
  const a = layers > 1 ? 0.62 : 0.42;
  const g = ctx.createLinearGradient(0, 0, 100, 100);
  g.addColorStop(0, `rgba(240,252,255,${a + 0.1})`);
  g.addColorStop(1, `rgba(150,215,240,${a})`);
  ctx.fillStyle = g;
  rr(ctx, 4, 3, 92, 90, 21); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.5;
  rr(ctx, 5, 4, 90, 88, 20); ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(15, 30); ctx.lineTo(30, 15); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(15, 44); ctx.lineTo(44, 15); ctx.stroke();
  if (layers > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    rr(ctx, 12, 11, 76, 74, 15); ctx.stroke();
    sparkle(ctx, 80, 78, 9, '#FFFFFF');
    sparkle(ctx, 70, 86, 5, '#E6F8FF');
  }
  return c;
}

/* Silver chains crossing over a tile (+ a padlock when it's double). */
function buildChainSprite(px, layers) {
  const [c, ctx] = makeCanvas(px);
  const link = (x, y, ang) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#3E4852'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#E2E8ED'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
  };
  for (let i = 0; i < 7; i++) { const t = i / 6; link(10 + 80 * t, 10 + 80 * t, Math.PI / 4 + (i % 2 ? Math.PI / 2 : 0)); }
  for (let i = 0; i < 7; i++) { const t = i / 6; link(90 - 80 * t, 10 + 80 * t, -Math.PI / 4 + (i % 2 ? Math.PI / 2 : 0)); }
  if (layers > 1) {
    ctx.strokeStyle = '#3E4852'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(50, 46, 9, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#E2E8ED'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#F4B83A';
    rr(ctx, 37, 45, 26, 22, 5); ctx.fill();
    ctx.strokeStyle = '#A8730B'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#7A5208';
    ctx.beginPath(); ctx.arc(50, 54, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(48.5, 55, 3, 7);
  }
  return c;
}

/* Salon product box. Darker = more hits left. */
function buildBoxSprite(px, layers) {
  const [c, ctx] = makeCanvas(px);
  const shades = {
    1: ['#F6D6AE', '#DDAA78', '#B98552'],
    2: ['#E0A773', '#C08350', '#8E5A32'],
    3: ['#BC8350', '#946039', '#5E3B20'],
  }[Math.min(3, layers)];
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, 5, 8, 90, 90, 12); ctx.fill();
  const g = ctx.createLinearGradient(0, 4, 0, 94);
  g.addColorStop(0, shades[0]); g.addColorStop(1, shades[1]);
  ctx.fillStyle = g;
  rr(ctx, 4, 4, 92, 90, 12); ctx.fill();
  ctx.strokeStyle = shades[2]; ctx.lineWidth = 3;
  rr(ctx, 5.5, 5.5, 89, 87, 11); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(6, 30); ctx.lineTo(94, 30); ctx.stroke();
  ctx.fillStyle = 'rgba(58,175,169,0.92)';          // turquoise tape
  ctx.fillRect(42, 5, 16, 88);
  if (layers >= 2) { ctx.fillStyle = 'rgba(236,95,165,0.92)'; ctx.fillRect(5, 56, 90, 10); }
  if (layers >= 3) { sparkle(ctx, 50, 30, 13, '#FFE7A3'); sparkle(ctx, 50, 30, 6, '#FFFFFF'); }
  return c;
}


/* ---------- 8. RENDERING ---------- */
const Render = {
  canvas: null,
  ctx: null,
  cell: 40,
  dpr: 1,
  sprites: [],

  init() {
    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');
  },

  layout() {
    const area = document.getElementById('boardArea');
    if (!area || area.offsetParent === null) return;      // screen hidden
    const frame = area.firstElementChild;
    const cs = getComputedStyle(frame);
    const frameExtra = parseFloat(cs.paddingLeft) * 2 + parseFloat(cs.borderLeftWidth) * 2;
    const areaCs = getComputedStyle(area);
    const availW = area.clientWidth - frameExtra;
    const availH = area.clientHeight - parseFloat(areaCs.paddingTop) - parseFloat(areaCs.paddingBottom) - frameExtra;
    const size = Math.max(200, Math.min(availW, availH));

    const cell = Math.floor(size / Board.cols);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (cell === this.cell && dpr === this.dpr && this.sprites.length) { this.draw(performance.now()); return; }
    this.cell = cell;
    this.dpr = dpr;

    const css = this.cell * Board.cols;
    this.canvas.style.width = css + 'px';
    this.canvas.style.height = css + 'px';
    this.canvas.width = Math.round(css * this.dpr);
    this.canvas.height = Math.round(css * this.dpr);

    const px = Math.round(this.cell * this.dpr);
    this.sprites = TILE_TYPES.map(t => buildTileSprite(t, px));
    this.bombSprite = buildBombSprite(px);
    this.overlays = {
      lineH: buildSpecialOverlay('lineH', px),
      lineV: buildSpecialOverlay('lineV', px),
      blast: buildSpecialOverlay('blast', px),
    };
    this.gel = [null, buildGelSprite(px, 1), buildGelSprite(px, 2)];
    this.ice = [null, buildIceSprite(px, 1), buildIceSprite(px, 2)];
    this.chain = [null, buildChainSprite(px, 1), buildChainSprite(px, 2)];
    this.box = [null, buildBoxSprite(px, 1), buildBoxSprite(px, 2), buildBoxSprite(px, 3)];
    this.draw(performance.now());
  },

  drawFX(s, W, H) {
    const ctx = this.ctx;
    FX.list.forEach(e => {
      if (e.p <= 0) return;
      const a = 1 - e.p;
      ctx.save();
      if (e.type === 'beamH' || e.type === 'beamV') {
        const thick = s * (0.9 - 0.6 * e.p);
        ctx.globalAlpha = a;
        ctx.shadowColor = '#DEF2F1';
        ctx.shadowBlur = 16;
        if (e.type === 'beamH') {
          const cy = (e.r + 0.5) * s;
          const g = ctx.createLinearGradient(0, cy - thick / 2, 0, cy + thick / 2);
          g.addColorStop(0, 'rgba(58,175,169,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(58,175,169,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, cy - thick / 2, W, thick);
        } else {
          const cx = (e.c + 0.5) * s;
          const g = ctx.createLinearGradient(cx - thick / 2, 0, cx + thick / 2, 0);
          g.addColorStop(0, 'rgba(58,175,169,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(58,175,169,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - thick / 2, 0, thick, H);
        }
      } else if (e.type === 'ring') {
        const cx = (e.c + 0.5) * s, cy = (e.r + 0.5) * s;
        const rad = s * (0.4 + (e.R + 0.7) * Ease.outCubic(e.p));
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(244,184,58,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.shadowColor = '#F4B83A'; ctx.shadowBlur = 14;
        ctx.lineWidth = 2 + s * 0.16 * a;
        ctx.stroke();
      } else if (e.type === 'zap') {
        const cx = (e.c + 0.5) * s, cy = (e.r + 0.5) * s;
        const reach = Math.min(1, e.p * 2.5);
        ctx.globalAlpha = e.p < 0.5 ? 1 : a * 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.shadowColor = '#3AAFA9'; ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        e.targets.forEach(t => {
          const tx = (t.c + 0.5) * s, ty = (t.r + 0.5) * s;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (tx - cx) * reach, cy + (ty - cy) * reach); ctx.stroke();
        });
      } else if (e.type === 'text') {
        // floating "+score"
        const rise = Ease.outCubic(e.p) * 0.9;
        ctx.globalAlpha = e.p < 0.6 ? 1 : (1 - e.p) / 0.4;
        const size = s * (e.big ? 0.62 : 0.48) * (e.p < 0.15 ? 0.6 + (e.p / 0.15) * 0.4 : 1);
        ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, s * 0.1);
        ctx.strokeStyle = 'rgba(23,37,42,0.85)';
        const x = Math.min(W - s, Math.max(s, e.c * s)), y = (e.r - rise) * s;
        ctx.strokeText(e.text, x, y);
        ctx.fillStyle = e.big ? '#F4B83A' : '#FFFFFF';
        ctx.fillText(e.text, x, y);
      } else if (e.type === 'callout') {
        // big combo word
        const pop = e.p < 0.2 ? Ease.outBack(e.p / 0.2) : 1;
        ctx.globalAlpha = e.p < 0.7 ? 1 : (1 - e.p) / 0.3;
        const size = s * 1.05 * Math.max(0.1, pop);
        ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = s * 0.18;
        ctx.strokeStyle = '#17252A';
        const y = H * 0.42 - e.p * s * 0.5;
        ctx.strokeText(e.text, W / 2, y);
        const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
        g.addColorStop(0, '#FFF1C7'); g.addColorStop(0.5, '#F4B83A'); g.addColorStop(1, '#EC5FA5');
        ctx.fillStyle = g;
        ctx.fillText(e.text, W / 2, y);
      } else if (e.type === 'flash') {
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    });
  },

  draw(now) {
    const { ctx, cell: s, dpr } = this;
    if (!ctx || !this.gel) return;             // not laid out yet (game screen hidden)
    const W = s * Board.cols, H = s * Board.rows;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const hasCells = Board.cells.length > 0;
    const wobble = amt => Math.sin(now / 18) * amt * s * 0.07;

    // cell backdrop (checkerboard) + gel underneath tiles
    for (let r = 0; r < Board.rows; r++) {
      for (let c = 0; c < Board.cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? 'rgba(222,242,241,0.07)' : 'rgba(222,242,241,0.13)';
        rr(ctx, c * s + 1.5, r * s + 1.5, s - 3, s - 3, s * 0.18);
        ctx.fill();
        const gel = hasCells && Board.cells[r][c].gel;
        if (gel) ctx.drawImage(this.gel[Math.min(2, gel)], c * s, r * s, s, s);
      }
    }

    const sel = Game.selected;
    const pulse = 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 2 * 1.4);

    // Hint: glowing outline around the pair + tiles nudge toward each other.
    const h = Game.hint;
    let hA = null, hB = null, hdr = 0, hdc = 0, nudge = 0;
    if (h) {
      hA = Board.grid[h.a.r][h.a.c];
      hB = Board.grid[h.b.r][h.b.c];
      hdr = h.b.r - h.a.r; hdc = h.b.c - h.a.c;
      const phase = ((now - h.start) / 1000 * 1.1) % 1;
      nudge = phase < 0.45 ? Math.sin(phase / 0.45 * Math.PI) * 0.13 : 0;
      const hx = Math.min(h.a.c, h.b.c) * s, hy = Math.min(h.a.r, h.b.r) * s;
      const hw = (Math.abs(hdc) + 1) * s, hh = (Math.abs(hdr) + 1) * s;
      ctx.fillStyle = `rgba(244,184,58,${0.22 + 0.18 * pulse})`;
      rr(ctx, hx + 1, hy + 1, hw - 2, hh - 2, s * 0.28);
      ctx.fill();
    }

    const drawTile = t => {
      let scale = t.scale;
      if (t === sel) scale *= 1.06 + 0.04 * pulse;
      const size = s * scale;
      let x = t.x * s + (s - size) / 2 + wobble(t.shake);
      let y = t.y * s + (s - size) / 2;
      if (t === hA) { x += hdc * nudge * s; y += hdr * nudge * s; }
      if (t === hB) { x -= hdc * nudge * s; y -= hdr * nudge * s; }
      if (y > H || y + size < 0) return;
      ctx.globalAlpha = t.alpha;
      if (t.special === 'bomb') {
        ctx.drawImage(this.bombSprite, x, y, size, size);
      } else {
        ctx.drawImage(this.sprites[t.kind], x, y, size, size);
        if (t.special) ctx.drawImage(this.overlays[t.special], x, y, size, size);
      }
      if (t.lock) {
        const set = t.lock.type === 'ice' ? this.ice : this.chain;
        ctx.drawImage(set[Math.min(2, t.lock.layers)], x, y, size, size);
      }
    };

    // Moving tiles first, locked tiles on top, boxes on top of everything
    // (so falling tiles slide neatly behind them).
    Board.forEachTile(t => { if (!t.lock) drawTile(t); });
    Board.forEachTile(t => { if (t.lock) drawTile(t); });
    ctx.globalAlpha = 1;

    // Gel frame on top so it reads clearly even with a tile sitting on it.
    if (hasCells) {
      ctx.save();
      ctx.shadowColor = 'rgba(236,95,165,0.8)';
      ctx.shadowBlur = 6;
      for (let r = 0; r < Board.rows; r++) {
        for (let c = 0; c < Board.cols; c++) {
          const gel = Board.cells[r][c].gel;
          if (!gel) continue;
          ctx.strokeStyle = 'rgba(255,130,195,0.95)';
          ctx.lineWidth = Math.max(2.5, s * 0.07);
          rr(ctx, c * s + 2, r * s + 2, s - 4, s - 4, s * 0.22);
          ctx.stroke();
          if (gel > 1) {
            ctx.strokeStyle = 'rgba(255,215,236,0.95)';
            ctx.lineWidth = Math.max(1.5, s * 0.035);
            rr(ctx, c * s + s * 0.13, r * s + s * 0.13, s * 0.74, s * 0.74, s * 0.16);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    if (hasCells) {
      for (let r = 0; r < Board.rows; r++) {
        for (let c = 0; c < Board.cols; c++) {
          const cell = Board.cells[r][c];
          if (cell.box) ctx.drawImage(this.box[Math.min(3, cell.box)], c * s + wobble(cell.shake), r * s, s, s);
        }
      }
    }

    if (h) {
      const hx = Math.min(h.a.c, h.b.c) * s, hy = Math.min(h.a.r, h.b.r) * s;
      const hw = (Math.abs(hdc) + 1) * s, hh = (Math.abs(hdr) + 1) * s;
      ctx.save();
      ctx.shadowColor = 'rgba(244,184,58,0.9)';
      ctx.shadowBlur = 8 + 8 * pulse;
      ctx.strokeStyle = '#F4B83A';
      ctx.lineWidth = 3.5;
      rr(ctx, hx + 1, hy + 1, hw - 2, hh - 2, s * 0.28);
      ctx.stroke();
      ctx.restore();
    }

    // selection ring
    if (sel) {
      const x = sel.x * s, y = sel.y * s;
      ctx.save();
      ctx.shadowColor = 'rgba(222,242,241,0.9)';
      ctx.shadowBlur = 10 + 8 * pulse;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`;
      ctx.lineWidth = 4;
      rr(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.26);
      ctx.stroke();
      ctx.restore();
    }

    Particles.draw(ctx, s);
    this.drawFX(s, W, H);
  },
};


/* ---------- 9. INPUT ----------
   Swipe: press a tile and drag toward a neighbor.
   Tap-tap: tap a tile, then tap a neighbor. */
const Input = {
  start: null,   // { r, c, x, y, id, used }

  init() {
    const cv = Render.canvas;
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', () => { this.start = null; });

    // Stop iOS rubber-banding / pinch zoom — except inside the level map, which scrolls.
    document.addEventListener('touchmove', e => {
      if (!e.target.closest || !e.target.closest('.scrollable')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
  },

  canPlay() { return Game.state === 'play' && !Game.locked; },

  cellFromEvent(e) {
    const rect = Render.canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / Render.cell);
    const r = Math.floor((e.clientY - rect.top) / Render.cell);
    return Board.inBounds(r, c) ? { r, c } : null;
  },

  down(e) {
    e.preventDefault();
    if (!this.canPlay()) return;
    const cell = this.cellFromEvent(e);
    if (!cell) return;
    Game.armIdle();
    if (Game.mode === 'hammer') {
      if (Board.grid[cell.r][cell.c] || Board.cells[cell.r][cell.c].box) Game.hammerAt(cell);
      return;
    }
    if (!Board.movable(cell.r, cell.c)) { Game.nudgeBlocked(cell); return; }
    try { Render.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    this.start = { r: cell.r, c: cell.c, x: e.clientX, y: e.clientY, id: e.pointerId, used: false };
  },

  move(e) {
    const s = this.start;
    if (!s || s.used || e.pointerId !== s.id || !this.canPlay()) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const threshold = Render.cell * 0.3;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    s.used = true;                                   // one swap per swipe
    let dr = 0, dc = 0;
    if (Math.abs(dx) > Math.abs(dy)) dc = Math.sign(dx); else dr = Math.sign(dy);
    const to = { r: s.r + dr, c: s.c + dc };
    if (!Board.inBounds(to.r, to.c)) return;
    if (!Board.movable(to.r, to.c)) { Game.nudgeBlocked(to); return; }
    Game.selected = null;
    Game.trySwap({ r: s.r, c: s.c }, to);
  },

  up(e) {
    const s = this.start;
    this.start = null;
    if (!s || s.used || e.pointerId !== s.id || !this.canPlay()) return;
    this.tap({ r: s.r, c: s.c });
  },

  tap(cell) {
    const tile = Board.grid[cell.r][cell.c];
    const sel = Game.selected;
    if (!sel) {
      Game.selected = tile;
    } else if (sel === tile) {
      Game.selected = null;
    } else if (Math.abs(sel.r - cell.r) + Math.abs(sel.c - cell.c) === 1) {
      const from = { r: sel.r, c: sel.c };
      Game.selected = null;
      Game.trySwap(from, cell);
    } else {
      Game.selected = tile;
    }
    if (Game.selected) Sound.play('tap');
    Loop.wake();
  },
};

/* ---------- 10. GAME ---------- */
const Game = {
  selected: null,
  locked: false,
  state: 'idle',       // 'play' | 'won' | 'lost' | 'idle'
  level: null,         // built level (see buildLevel)
  movesLeft: 0,
  score: 0,
  lastSwap: '',
  badStreak: 0,        // bad moves in a row
  hint: null,          // { a, b, start } while a hint is showing
  _hintTimer: 0,
  _idleTimer: 0,
  mode: null,          // 'hammer' while the hammer booster is armed

  /* ----- starting a level ----- */
  async startLevel(n) {
    const lv = buildLevel(n);
    const assist = this.assistFor(n);

    this.level = lv;
    this.movesLeft = lv.moves + assist;
    this.state = 'play';
    this.locked = true;
    this.selected = null;
    this.badStreak = 0;
    this.lastSwap = '';
    this.mode = null;
    this.clearHint();
    FX.list.length = 0;
    Particles.list.length = 0;
    this.score = 0;
    UI.setScore(0);

    Board.setup(lv.spec, lv.kinds);
    UI.showLevelHud(lv);
    UI.setMoves(this.movesLeft);
    UI.updateGoals();
    UI.updateStarBar();

    // Drop-in intro: tiles fall from above, column by column.
    const jobs = [];
    Board.forEachTile((t, r, c) => {
      t.y = r - Board.rows - 1;
      jobs.push(Tweens.to(t, { y: r }, 520, { delay: c * 40 + (Board.rows - 1 - r) * 30, ease: Ease.outBack }));
    });
    Loop.wake();
    await Promise.all(jobs);

    this.locked = false;
    UI.updateDebug();
    UI.updateBoosters();
    if (lv.tip) UI.toast(lv.tip, true);
    if (!Save.data.help.howTo) setTimeout(() => UI.showHowTo(0, true), 400);
    this.armIdle();
  },

  // Quiet hint if she hasn't moved for a while (no bubble, just the glow).
  armIdle() {
    clearTimeout(this._idleTimer);
    if (this.state !== 'play') return;
    this._idleTimer = setTimeout(() => {
      if (this.state === 'play' && !this.locked && !this.hint && this.mode !== 'hammer') this.showHint(true);
    }, CONFIG.idleHintMs);
  },

  // Quiet help: after 3 losses on the same level, a couple of extra moves (up to +6).
  assistFor(n) {
    const fails = Save.data.progress.fails[n] || 0;
    return fails >= 3 ? Math.min(2 * (fails - 2), 6) : 0;
  },

  /* ----- hints ----- */
  showHint(silent = false) {
    if (this.state !== 'play') return;
    if (this.locked) { this._hintTimer = setTimeout(() => this.showHint(silent), 250); return; }
    const moves = Board.findMoves();
    if (!moves.length) return;
    const m = moves[Math.floor(Math.random() * moves.length)];
    this.hint = { a: m.a, b: m.b, start: performance.now() };
    if (!silent) UI.toast(Lines.hint());
    Sound.play('twinkle');
    Loop.wake();
  },

  clearHint() {
    this.hint = null;
    clearTimeout(this._hintTimer);
  },

  // Tapping a locked tile or a box: a little wobble so she knows it's stuck.
  nudgeBlocked(cell) {
    const t = Board.grid[cell.r][cell.c];
    const target = t || Board.cells[cell.r][cell.c];
    Tweens.to(target, { shake: 0.8 }, 1).then(() => Tweens.to(target, { shake: 0 }, 260));
  },

  slide(tiles, ms, ease = Ease.inOutCubic) {
    return Promise.all(tiles.map(t => Tweens.to(t, { x: t.c, y: t.r }, ms, { ease })));
  },

  /* ----- a move ----- */
  async trySwap(a, b) {
    if (this.locked || this.state !== 'play') return;
    if (!Board.movable(a.r, a.c) || !Board.movable(b.r, b.c)) return;
    this.locked = true;
    this.hint = null;
    Sound.play('swap');
    const ta = Board.grid[a.r][a.c], tb = Board.grid[b.r][b.c];

    Board.swap(a, b);
    await this.slide([ta, tb], CONFIG.swapMs);

    const combo = ta.special === 'bomb' || tb.special === 'bomb' || !!(ta.special && tb.special);
    const k = Board.kindsMatrix();
    const makesMatch = combo || Board.matchesAt(k, ta.r, ta.c) || Board.matchesAt(k, tb.r, tb.c);

    if (!makesMatch) {
      Board.swap(a, b);
      this.badStreak++;
      if (this.badStreak >= CONFIG.stuckAfter) {
        this.badStreak = 0;
        UI.toast(Lines.stuck());
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(() => this.showHint(), 1700);
      } else {
        UI.toast(Lines.oops());
      }
      Sound.play('nope');
      await this.slide([ta, tb], CONFIG.swapMs + 40, Ease.outBack);
      this.lastSwap = 'no match';
    } else {
      this.lastSwap = 'match ✓';
      this.badStreak = 0;
      this.clearHint();
      this.movesLeft--;
      UI.setMoves(this.movesLeft);
      const pending = combo ? await this.prepareCombo(ta, tb) : null;
      await this.resolveBoard([{ r: ta.r, c: ta.c }, { r: tb.r, c: tb.c }], pending);

      if (this.goalsDone()) { await this.win(); return; }
      if (this.movesLeft <= 0) { await this.lose(); return; }
    }

    this.locked = false;
    UI.updateDebug();
    this.armIdle();
  },

  /* ----- goals ----- */
  goalsDone() {
    return this.level.goals.every(g => (g.type === 'score' ? this.score >= g.need : g.have >= g.need));
  },

  progress(type, kind) {
    const g = this.level && this.level.goals.find(goal =>
      goal.type === type && (type !== 'collect' || goal.kind === kind) && goal.have < goal.need);
    if (g) g.have++;
  },

  starsFor(score) {
    const s = this.level.stars;
    return score >= s[2] ? 3 : score >= s[1] ? 2 : 1;
  },

  /* ----- clearing ----- */
  // Clear matches → drop → refill → repeat until the board settles.
  async resolveBoard(preferred = [], pending = null) {
    let cascade = 0;
    for (;;) {
      let set, fx = [], spawns = [];
      if (pending) {
        ({ set, fx } = pending);
        pending = null;
      } else {
        const runs = Board.findMatches();
        if (!runs.length) break;
        ({ set, spawns } = this.planMatches(runs, cascade === 0 ? preferred : []));
      }
      cascade++;
      await this.clearCells(set, fx, cascade);

      if (spawns.length) {
        Sound.play('special');
        await Promise.all(spawns.map(sp => {
          if (Board.grid[sp.r][sp.c]) return null;          // spot still taken (locked tile)
          const t = makeTile(sp.kind, sp.r, sp.c);
          t.special = sp.special;
          t.scale = 0;
          Board.grid[sp.r][sp.c] = t;
          Particles.burst(sp.c + 0.5, sp.r + 0.5, ['#FFFFFF', '#FFE7A3'], 10, { star: true, speed: 3, lift: 0.5 });
          return Tweens.to(t, { scale: 1 }, 300, { ease: Ease.outBack });
        }));
      }
      await this.collapse();
    }
    if (Board.findMoves().length === 0) await this.shuffle();
  },

  // Turn match runs into: cells to clear + special tiles to create.
  planMatches(runs, preferred) {
    const key = p => p.r * Board.cols + p.c;
    const free = p => { const t = Board.grid[p.r][p.c]; return t && !t.lock; };

    const parent = runs.map((_, i) => i);
    const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((run, i) => run.cells.forEach(p => {
      const k = key(p);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i);
    }));
    const groups = new Map();
    runs.forEach((run, i) => {
      const g = find(i);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(run);
    });

    const set = new Map(), spawns = [];
    for (const gruns of groups.values()) {
      const cells = new Map();
      gruns.forEach(run => run.cells.forEach(p => cells.set(key(p), p)));
      cells.forEach((p, k) => set.set(k, { r: p.r, c: p.c, depth: 0 }));

      const longest = gruns.reduce((a, b) => (b.len > a.len ? b : a));
      const hasH = gruns.some(r => r.dir === 'h'), hasV = gruns.some(r => r.dir === 'v');
      let special = null;
      if (longest.len >= 5) special = 'bomb';
      else if (hasH && hasV) special = 'blast';
      else if (longest.len === 4) special = longest.dir === 'h' ? 'lineH' : 'lineV';
      if (!special) continue;

      let at = preferred.find(p => cells.has(key(p)) && free(p));
      if (!at && special === 'blast') {
        const count = new Map();
        gruns.forEach(run => run.cells.forEach(p => count.set(key(p), (count.get(key(p)) || 0) + 1)));
        count.forEach((n, k) => { if (n > 1 && free(cells.get(k))) at = cells.get(k); });
      }
      if (!at) {
        const mid = longest.cells[Math.floor(longest.len / 2)];
        at = free(mid) ? mid : [...cells.values()].find(free);
      }
      if (!at) continue;                     // every cell was locked — no special
      spawns.push({ r: at.r, c: at.c, special, kind: special === 'bomb' ? BOMB : longest.kind });
    }
    return { set, spawns };
  },

  // Most common color still on the board (what a Glam Ball goes after when hit).
  commonKind(exclude) {
    const counts = new Array(TILE_TYPES.length).fill(0);
    Board.forEachTile((t, r, c) => {
      if (t.kind >= 0 && !exclude.has(r * Board.cols + c)) counts[t.kind]++;
    });
    let best = 0;
    counts.forEach((n, i) => { if (n > counts[best]) best = i; });
    return best;
  },

  // Clear a set of cells. Specials inside it go off (chain reactions),
  // locked tiles crack instead of clearing, gel underneath wears away,
  // and boxes next to anything cleared take a hit.
  async clearCells(set, fx, cascade) {
    const key = (r, c) => r * Board.cols + c;
    const queue = [...set.values()];
    let fired = 0;
    const add = (r, c, depth) => {
      if (!Board.inBounds(r, c)) return;
      if (!Board.grid[r][c] && !Board.cells[r][c].box) return;
      const k = key(r, c);
      if (set.has(k)) return;
      const p = { r, c, depth };
      set.set(k, p);
      queue.push(p);
    };

    while (queue.length) {
      const p = queue.shift();
      const t = Board.grid[p.r][p.c];
      if (!t || !t.special || t.triggered) continue;
      t.triggered = true;
      fired++;
      const d = p.depth + 1;
      if (t.special === 'lineH') {
        for (let c = 0; c < Board.cols; c++) add(p.r, c, d);
        fx.push({ type: 'beamH', r: p.r, depth: p.depth });
      } else if (t.special === 'lineV') {
        for (let r = 0; r < Board.rows; r++) add(r, p.c, d);
        fx.push({ type: 'beamV', c: p.c, depth: p.depth });
      } else if (t.special === 'blast') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(p.r + dr, p.c + dc, d);
        fx.push({ type: 'ring', r: p.r, c: p.c, R: 1, depth: p.depth });
      } else if (t.special === 'bomb') {
        const kind = this.commonKind(set);
        const targets = [];
        Board.forEachTile((u, r, c) => { if (u.kind === kind) { add(r, c, d); targets.push({ r, c }); } });
        fx.push({ type: 'zap', r: p.r, c: p.c, targets, depth: p.depth });
      }
    }

    // Boxes: hit directly by a special, or sitting next to a cleared tile.
    const boxHits = new Map();
    set.forEach(p => {
      if (Board.cells[p.r][p.c].box) { if (!boxHits.has(key(p.r, p.c))) boxHits.set(key(p.r, p.c), p.depth); return; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const r = p.r + dr, c = p.c + dc;
        if (Board.inBounds(r, c) && Board.cells[r][c].box && !boxHits.has(key(r, c))) boxHits.set(key(r, c), p.depth);
      });
    });

    const step = CONFIG.chainStepMs;
    const jobs = fx.map(e => FX.play(e, e.type === 'flash' ? 520 : 360, (e.depth || 0) * step));
    fx.forEach(e => {
      const at = ((e.depth || 0) * step) / 1000;
      if (e.type === 'beamH' || e.type === 'beamV') Sound.play('zap', at);
      else if (e.type === 'ring' && e.R >= 1) { Sound.play('blast', at); Shake.add(e.R >= 2 ? 0.7 : 0.35); }
      else if (e.type === 'zap') { Sound.play('glam', at); Shake.add(0.45); }
      else if (e.type === 'flash') { Sound.play('boom', at); Shake.add(1); }
    });
    const removed = [];
    let blockerPoints = 0;
    let gelHits = 0;
    const wobble = (obj, delay) =>
      Tweens.to(obj, { shake: 1 }, 1, { delay }).then(() => Tweens.to(obj, { shake: 0 }, 300, { ease: Ease.outCubic }));

    set.forEach(p => {
      const t = Board.grid[p.r][p.c];
      if (!t) return;
      const cell = Board.cells[p.r][p.c];
      const delay = p.depth * step;
      if (cell.gel) {
        cell.gel--;
        gelHits++;
        blockerPoints += 100;
        if (!cell.gel) this.progress('gel');
        Particles.burst(p.c + 0.5, p.r + 0.5, ['#FF9CCB', '#EC5FA5', '#FFFFFF'], 5, { speed: 2.5 });
      }
      if (t.lock) {
        const lockType = t.lock.type;
        t.lock.layers--;
        blockerPoints += 100;
        Sound.play(lockType === 'ice' ? 'crack' : 'clink', delay / 1000);
        Particles.burst(p.c + 0.5, p.r + 0.5, lockType === 'ice' ? ['#FFFFFF', '#CDEFFF'] : ['#E2E8ED', '#8A96A0'], 9, { speed: 3.5 });
        if (t.lock.layers <= 0) {
          this.progress(t.lock.type);
          t.lock = null;
          jobs.push(FX.play({ type: 'ring', r: p.r, c: p.c, R: 0 }, 300, delay));
        }
        jobs.push(wobble(t, delay));
        return;                                   // locked tile stays on the board
      }
      removed.push(t);
      jobs.push(
        Tweens.to(t, { scale: 1.22 }, CONFIG.popMs * 0.3, { delay, ease: Ease.outCubic })
          .then(() => {
            this.popParticles(t);
            return Tweens.to(t, { scale: 0, alpha: 0 }, CONFIG.popMs * 0.7, { ease: Ease.inCubic });
          })
      );
    });

    boxHits.forEach((depth, k) => {
      const r = Math.floor(k / Board.cols), c = k % Board.cols;
      const cell = Board.cells[r][c];
      cell.box--;
      blockerPoints += 100;
      Sound.play('thud', (depth * step) / 1000);
      Particles.burst(c + 0.5, r + 0.5, ['#DDAA78', '#B98552', '#3AAFA9'], 9, { speed: 3.5 });
      if (!cell.box) {
        this.progress('box');
        jobs.push(FX.play({ type: 'ring', r, c, R: 0 }, 300, depth * step));
      } else {
        jobs.push(wobble(cell, depth * step));
      }
    });

    removed.forEach(t => { if (t.kind >= 0) this.progress('collect', t.kind); });
    const mult = Math.min(cascade, CONFIG.maxCascadeMultiplier);
    const points = removed.length * CONFIG.pointsPerTile * mult + fired * CONFIG.specialBonus + blockerPoints;
    this.addScore(points);
    UI.updateGoals();

    if (removed.length) Sound.play('match', 0, cascade);
    if (gelHits) Sound.play('squish', 0.05);
    if (points > 0 && set.size) {
      let sr = 0, sc = 0;
      set.forEach(p => { sr += p.r; sc += p.c; });
      FX.play({ type: 'text', r: sr / set.size + 0.5, c: sc / set.size + 0.5,
                text: '+' + points.toLocaleString(), big: points >= 1000 }, 950, 120);
    }
    if (cascade >= 3) {
      FX.play({ type: 'callout', text: COMBO_WORDS[Math.min(6, cascade)] }, 1100);
      Shake.add(0.2 + 0.1 * Math.min(4, cascade - 3));
      Sound.play('special', 0.05);
    }

    await Promise.all(jobs);
    removed.forEach(t => { if (Board.grid[t.r][t.c] === t) Board.grid[t.r][t.c] = null; });
  },

  // Two specials swapped together (or a Glam Ball with anything).
  async prepareCombo(ta, tb) {
    const sa = ta.special, sb = tb.special;
    const at = { r: ta.r, c: ta.c };
    const set = new Map(), fx = [];
    const add = (r, c, depth = 0) => {
      if (!Board.inBounds(r, c) || (!Board.grid[r][c] && !Board.cells[r][c].box)) return;
      const k = r * Board.cols + c;
      if (!set.has(k)) set.set(k, { r, c, depth });
    };
    const isLine = sp => sp === 'lineH' || sp === 'lineV';

    ta.triggered = tb.triggered = true;
    add(ta.r, ta.c); add(tb.r, tb.c);

    if (sa === 'bomb' && sb === 'bomb') {
      // Two Glam Balls: the whole board.
      Board.forEachTile((t, r, c) => add(r, c, 1 + Math.round(Math.hypot(r - at.r, c - at.c) / 1.5)));
      fx.push({ type: 'flash', depth: 0 });

    } else if (sa === 'bomb' || sb === 'bomb') {
      const bomb = sa === 'bomb' ? ta : tb;
      const other = bomb === ta ? tb : ta;
      const targets = [];
      Board.forEachTile(t => { if (t !== other && t.kind === other.kind) targets.push(t); });
      const zap = { type: 'zap', r: bomb.r, c: bomb.c, targets: targets.map(t => ({ r: t.r, c: t.c })) };

      if (other.special) {
        // Glam Ball + Line/Blast: every tile of that color becomes one, then they all go off.
        other.triggered = false;
        await Promise.all([
          FX.play(zap, 360),
          ...targets.map((t, i) => {
            if (!t.special && !t.lock) t.special = isLine(other.special) ? (i % 2 ? 'lineH' : 'lineV') : other.special;
            return Tweens.to(t, { scale: 1.25 }, 120).then(() => Tweens.to(t, { scale: 1 }, 180, { ease: Ease.outBack }));
          }),
        ]);
        await wait(180);
        targets.forEach(t => add(t.r, t.c, 1));
      } else {
        // Glam Ball + normal tile: clear every tile of that color.
        fx.push(Object.assign(zap, { depth: 0 }));
        targets.forEach(t => add(t.r, t.c, 1));
      }

    } else if (isLine(sa) && isLine(sb)) {
      // Line + Line: a cross.
      for (let c = 0; c < Board.cols; c++) add(at.r, c, 1);
      for (let r = 0; r < Board.rows; r++) add(r, at.c, 1);
      fx.push({ type: 'beamH', r: at.r, depth: 0 }, { type: 'beamV', c: at.c, depth: 0 });

    } else if (isLine(sa) || isLine(sb)) {
      // Line + Blast: three rows and three columns.
      for (let d = -1; d <= 1; d++) {
        if (Board.inBounds(at.r + d, 0)) {
          for (let c = 0; c < Board.cols; c++) add(at.r + d, c, 1);
          fx.push({ type: 'beamH', r: at.r + d, depth: 0 });
        }
        if (Board.inBounds(0, at.c + d)) {
          for (let r = 0; r < Board.rows; r++) add(r, at.c + d, 1);
          fx.push({ type: 'beamV', c: at.c + d, depth: 0 });
        }
      }

    } else {
      // Blast + Blast: a big 5×5 blast.
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(at.r + dr, at.c + dc, 1);
      fx.push({ type: 'ring', r: at.r, c: at.c, R: 2, depth: 0 });
    }
    return { set, fx };
  },

  // Gravity: tiles slide down into gaps, new tiles fall in from above.
  // Boxes and locked tiles stay put; falling tiles pass behind them.
  async collapse() {
    const jobs = [];
    const fallMs = dist => 150 + 75 * Math.sqrt(dist);

    for (let c = 0; c < Board.cols; c++) {
      const open = [];                         // cells tiles can sit in, bottom → top
      for (let r = Board.rows - 1; r >= 0; r--) {
        const t = Board.grid[r][c];
        if (Board.cells[r][c].box || (t && t.lock)) continue;
        open.push(r);
      }
      const movers = open.map(r => Board.grid[r][c]).filter(Boolean);
      open.forEach(r => { Board.grid[r][c] = null; });

      movers.forEach((t, i) => {
        const r = open[i];
        Board.grid[r][c] = t;
        if (t.r !== r) {
          const dist = r - t.r;
          t.r = r;
          jobs.push(Tweens.to(t, { y: r }, fallMs(dist), { ease: Ease.fall, delay: c * 10 }));
        }
      });

      for (let i = movers.length, rank = 0; i < open.length; i++, rank++) {
        const r = open[i];
        const t = makeTile(Board.randomKind(), r, c);
        t.y = -0.6 - rank;                     // stacked just above the board
        Board.grid[r][c] = t;
        jobs.push(Tweens.to(t, { y: r }, fallMs(r - t.y), { ease: Ease.fall, delay: c * 10 + 40 }));
      }
    }
    await Promise.all(jobs);
  },

  // No moves left: reshuffle the movable tiles into a playable board.
  async shuffle(msg = 'No moves — shuffling!') {
    UI.toast(msg);
    Sound.play('twister');
    const spots = [], tiles = [];
    Board.forEachTile((t, r, c) => { if (!t.lock) { spots.push({ r, c }); tiles.push(t); } });

    for (let attempt = 0; attempt < 1000; attempt++) {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      tiles.forEach((t, i) => {
        const p = spots[i];
        Board.grid[p.r][p.c] = t; t.r = p.r; t.c = p.c;
      });
      if (!Board.hasAnyMatch() && Board.findMoves().length) break;
      if (attempt % 200 === 199) tiles.forEach(t => { if (!t.special) t.kind = Board.randomKind(); });
    }

    await wait(350);
    await Promise.all(tiles.map(t =>
      Tweens.to(t, { x: t.c, y: t.r }, 520, { ease: Ease.inOutCubic, delay: Math.random() * 120 })
    ));
  },

  popParticles(t) {
    const colors = t.special === 'bomb'
      ? ['#FFFFFF', '#F4B83A', '#8BE6DF', '#EC5FA5']
      : [TILE_TYPES[t.kind].base, TILE_TYPES[t.kind].light, '#FFFFFF'];
    Particles.burst(t.c + 0.5, t.r + 0.5, colors, t.special ? 14 : 7, { speed: t.special ? 5 : 3.8, star: !!t.special });
  },

  /* ----- boosters ----- */
  async useBooster(type) {
    if (this.state !== 'play' || this.locked) return;
    const inv = Save.data.boosters;
    if (type === 'hammer' && this.mode === 'hammer') {        // tap again to cancel
      this.mode = null;
      UI.updateBoosters();
      return;
    }
    if (!inv[type]) { UI.toast('None left — come back tomorrow for a gift!'); return; }
    if (type === 'hammer') {
      this.mode = 'hammer';
      this.selected = null;
      this.clearHint();
      UI.toast('Tap any tile to smash it!');
      UI.updateBoosters();
      return;
    }
    inv[type]--;
    Save.write();
    UI.updateBoosters();
    if (type === 'moves') {
      this.movesLeft += 5;
      UI.setMoves(this.movesLeft);
      Sound.play('gift');
      UI.toast('+5 moves!');
    } else if (type === 'shuffle') {
      this.locked = true;
      this.clearHint();
      this.selected = null;
      await this.shuffle('Twister!');
      this.locked = false;
    }
    this.armIdle();
  },

  async hammerAt(cell) {
    this.mode = null;
    Save.data.boosters.hammer--;
    Save.write();
    UI.updateBoosters();
    this.locked = true;
    this.clearHint();
    this.selected = null;
    Sound.play('hammer');
    Shake.add(0.4);
    const set = new Map([[cell.r * Board.cols + cell.c, { r: cell.r, c: cell.c, depth: 0 }]]);
    await this.resolveBoard([], { set, fx: [{ type: 'ring', r: cell.r, c: cell.c, R: 0, depth: 0 }] });
    if (this.goalsDone()) { await this.win(); return; }
    this.locked = false;
    UI.updateDebug();
    this.armIdle();
  },

  // From the "Out of moves" screen: spend a +5 booster and keep playing.
  continueWithMoves() {
    const inv = Save.data.boosters;
    if (!inv.moves || this.state !== 'lost') return;
    inv.moves--;
    const p = Save.data.progress;
    p.fails[this.level.n] = Math.max(0, (p.fails[this.level.n] || 1) - 1);
    Save.write();
    this.state = 'play';
    this.locked = false;
    this.movesLeft = 5;
    UI.setMoves(5);
    UI.updateBoosters();
    Sound.play('gift');
    UI.toast('+5 moves — you got this!');
    this.armIdle();
  },

  addScore(points) {
    this.score += points;
    UI.setScore(this.score);
    UI.updateStarBar();
  },

  /* ----- end of level ----- */
  async win() {
    this.state = 'won';
    this.locked = true;
    this.clearHint();
    this.selected = null;
    this.mode = null;
    clearTimeout(this._idleTimer);
    const n = this.level.n;

    // Leftover moves turn into Line tiles that all go off — a little celebration.
    const left = this.movesLeft;
    this.stats = { movesLeft: left, scoreBeforeFinale: this.score };   // for tuning
    if (left > 0) {
      UI.toast('Finishing touches! ✨');
      Sound.play('twinkle');
      await wait(600);
      const pool = [];
      Board.forEachTile(t => { if (!t.lock && !t.special) pool.push(t); });
      pool.sort(() => Math.random() - 0.5);
      const picks = pool.slice(0, Math.min(left, CONFIG.finaleMaxTiles));
      for (const t of picks) {
        t.special = Math.random() < 0.5 ? 'lineH' : 'lineV';
        Tweens.to(t, { scale: 1.3 }, 100).then(() => Tweens.to(t, { scale: 1 }, 160, { ease: Ease.outBack }));
        this.movesLeft--;
        UI.setMoves(this.movesLeft);
        this.addScore(CONFIG.leftoverBonus);
        await wait(120);
      }
      if (this.movesLeft > 0) {                 // more moves than tiles we lit up
        this.addScore(this.movesLeft * CONFIG.leftoverBonus);
        this.movesLeft = 0;
        UI.setMoves(0);
      }
      await wait(250);
      const set = new Map(picks.map(t => [t.r * Board.cols + t.c, { r: t.r, c: t.c, depth: 0 }]));
      await this.resolveBoard([], { set, fx: [] });
    }

    const stars = this.starsFor(this.score);
    const p = Save.data.progress;
    p.stars[n] = Math.max(p.stars[n] || 0, stars);
    p.best[n] = Math.max(p.best[n] || 0, this.score);
    p.unlocked = Math.max(p.unlocked, n + 1);
    p.fails[n] = 0;
    Save.data.stats.levelsWon = (Save.data.stats.levelsWon || 0) + 1;
    Save.write();

    await wait(450);
    UI.showWin(n, stars, this.score);
  },

  async lose() {
    this.state = 'lost';
    this.locked = true;
    this.clearHint();
    this.mode = null;
    clearTimeout(this._idleTimer);
    Sound.play('lose');
    const n = this.level.n;
    const p = Save.data.progress;
    p.fails[n] = (p.fails[n] || 0) + 1;
    Save.write();
    await wait(500);
    UI.showLose(this.level);
  },

  quit() {
    this.state = 'idle';
    this.mode = null;
    clearTimeout(this._idleTimer);
    this.clearHint();
    this.selected = null;
  },
};

/* ---------- 11. SCREENS & UI ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* Shuffle-bag picker: every line shows once before any repeats,
   and the same line never shows twice in a row. */
function makePicker(getList) {
  let bag = [], last = '';
  return () => {
    const list = getList();
    if (!list.length) return '';
    if (!bag.length) {
      bag = list.slice().sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[bag.length - 1] === last) bag.unshift(bag.pop());
    }
    last = bag.pop();
    return last.replace(/\{name\}/g, CONFIG.playerName);
  };
}

const Lines = {
  oops:  makePicker(() => CONFIG.oopsMessages),
  stuck: makePicker(() => CONFIG.stuckMessages),
  hint:  makePicker(() => CONFIG.hintMessages),
  win:   makePicker(() => CONFIG.winMessages),
};

const UI = {
  _toastTimer: 0,
  _shownScore: 0,
  _scoreAnim: 0,
  _goalsHtml: '',
  _starMarks: [0, 0, 0],
  _actions: {},
  icons: null,

  init() {
    $('heroName').textContent = CONFIG.playerName + "'s";
    $('heroGame').textContent = CONFIG.gameName;
    document.title = `${CONFIG.playerName}'s ${CONFIG.gameName}`;

    this.buildIcons();
    $('heroTiles').innerHTML = this.icons.tiles
      .map((src, i) => `<img src="${src}" alt="" style="animation-delay:${(i * 0.18).toFixed(2)}s">`).join('');

    // Sound can only start after her first tap (iPhone rule).
    const unlock = () => Sound.unlock();
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, true));
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('.btn, .icon-btn, .node, .booster')) Sound.play('button');
    }, true);
    ['btnSound', 'btnSoundTitle'].forEach(id => $(id).addEventListener('click', () => Sound.setMuted(!Save.data.settings.muted)));
    document.querySelectorAll('[data-booster]').forEach(b =>
      b.addEventListener('click', () => Game.useBooster(b.dataset.booster)));
    this.updateSoundButtons();
    this.updateBoosters();

    $('btnPlay').addEventListener('click', () => this.openMap());
    $('goals').addEventListener('click', () => this.showGoalsHelp());
    $('btnHelpMap').addEventListener('click', () => this.showHowTo(0));
    $('btnHelpGame').addEventListener('click', () => { if (!Game.locked) this.showHowTo(0); });
    $('btnMapBack').addEventListener('click', () => this.showScreen('title'));
    $('btnMap').addEventListener('click', () => { Game.quit(); this.openMap(); });
    $('mapPath').addEventListener('click', e => {
      const node = e.target.closest('.node');
      if (node && !node.classList.contains('locked')) this.showIntro(+node.dataset.n);
    });
    $('modal').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const fn = this._actions[b.dataset.act];
      this.hideModal();
      if (fn) fn();
    });
    // Tap the big title to show/hide the test info line.
    $('heroGame').addEventListener('click', () => {
      Save.data.settings.showDebug = !Save.data.settings.showDebug;
      Save.write();
      this.updateDebug();
      Loop.wake();
    });
    this.updateDebug();
  },

  showScreen(name) {
    document.body.dataset.screen = name;
    ['title', 'map', 'game'].forEach(s => {
      $('screen' + s[0].toUpperCase() + s.slice(1)).hidden = s !== name;
    });
    if (name === 'game') Render.layout();
    Music.play(name === 'game' ? 'emerald' : 'road');
    if (name === 'title') {
      const next = Save.data.progress.unlocked;
      $('btnPlay').textContent = next > 1 ? `Continue · Level ${next}` : 'Play';
    }
    Loop.wake();
  },

  buildIcons() {
    const px = 72;
    const tiles = TILE_TYPES.map(t => buildTileSprite(t, px).toDataURL());
    const plain = buildTileSprite(TILE_TYPES[0], px);
    const layered = over => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const x = c.getContext('2d');
      x.drawImage(plain, 0, 0);
      x.drawImage(over, 0, 0);
      return c.toDataURL();
    };
    this.icons = {
      tiles,
      gel: buildGelSprite(px, 2).toDataURL(),
      ice: layered(buildIceSprite(px, 2)),
      chain: layered(buildChainSprite(px, 1)),
      box: buildBoxSprite(px, 1).toDataURL(),
    };
  },

  goalsHtml(goals, live) {
    return goals.map(g => {
      if (g.type === 'score') {
        const done = live && Game.score >= g.need;
        return `<div class="goal goal-score${done ? ' done' : ''}"><span class="goal-star">★</span>` +
               `<span class="goal-num">${g.need.toLocaleString()}</span></div>`;
      }
      const left = Math.max(0, g.need - (live ? g.have : 0));
      const icon = g.type === 'collect' ? this.icons.tiles[g.kind] : this.icons[g.type];
      return `<div class="goal${live && left === 0 ? ' done' : ''}"><img src="${icon}" alt="">` +
             `<span class="goal-num">${live && left === 0 ? '✓' : left}</span></div>`;
    }).join('');
  },

  updateGoals() {
    if (!Game.level) return;
    const html = this.goalsHtml(Game.level.goals, true);
    if (html !== this._goalsHtml) { $('goals').innerHTML = html; this._goalsHtml = html; }
  },

  showLevelHud(lv) {
    $('levelLabel').textContent = `Level ${lv.n}`;
    this._goalsHtml = '';
    const s = lv.stars;
    const pos = [Math.min(0.3, (s[1] * 0.5) / s[2]), s[1] / s[2], 1];
    this._starMarks = [Math.round(s[2] * pos[0]), s[1], s[2]];
    $('starBar').querySelectorAll('.star-mark').forEach((m, i) => { m.style.left = (pos[i] * 100).toFixed(1) + '%'; });
  },

  updateStarBar() {
    if (!Game.level) return;
    $('starFill').style.width = Math.min(100, (Game.score / Game.level.stars[2]) * 100).toFixed(1) + '%';
    $('starBar').querySelectorAll('.star-mark').forEach((m, i) => m.classList.toggle('lit', Game.score >= this._starMarks[i]));
  },

  setMoves(n) {
    $('moves').textContent = n;
    $('movesStat').classList.toggle('low', n <= 5 && Game.state === 'play');
  },

  // Score ticks up smoothly instead of jumping.
  setScore(value) {
    const el = $('score');
    cancelAnimationFrame(this._scoreAnim);
    if (value === 0) { this._shownScore = 0; el.textContent = '0'; return; }
    const from = this._shownScore, start = performance.now(), dur = 450;
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      this._shownScore = Math.round(from + (value - from) * Ease.outCubic(p));
      el.textContent = this._shownScore.toLocaleString();
      if (p < 1) this._scoreAnim = requestAnimationFrame(step);
    };
    this._scoreAnim = requestAnimationFrame(step);
  },

  toast(text, long = false) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('show', 'long');
    void el.offsetWidth;            // restart the CSS animation
    el.classList.add('show');
    if (long) el.classList.add('long');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show', 'long'), long ? 3500 : 2000);
  },

  /* ----- level map ----- */
  openMap() {
    this.hideModal();
    this.showScreen('map');
    this.renderMap();
    if (Daily.available()) setTimeout(() => { if ($('modal').hidden) this.showDaily(); }, 450);
  },

  updateBoosters() {
    const inv = Save.data.boosters;
    document.querySelectorAll('[data-booster]').forEach(b => {
      const k = b.dataset.booster;
      b.querySelector('.b-count').textContent = inv[k] || 0;
      b.classList.toggle('empty', !inv[k]);
      b.classList.toggle('active', k === 'hammer' && Game.mode === 'hammer');
    });
  },

  updateSoundButtons() {
    const m = Save.data.settings.muted;
    ['btnSound', 'btnSoundTitle'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.textContent = m ? '🔇' : '🔊';
      el.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    });
  },

  showDaily() {
    const day = Daily.nextDay();
    const icon = { hammer: '🔨', shuffle: '🌪️', moves: '+5' };
    const cells = Daily.REWARDS.map((r, i) => {
      const items = Object.keys(r).map(k =>
        `<span class="dg-item">${icon[k]}${r[k] > 1 ? `<sub>×${r[k]}</sub>` : ''}</span>`).join('');
      const state = i + 1 < day ? ' past' : i + 1 === day ? ' today' : '';
      return `<div class="dg-day${state}"><div class="dg-num">Day ${i + 1}</div><div class="dg-items">${items}</div></div>`;
    }).join('');
    this.showModal(`
      <div class="panel-kicker">Daily gift</div>
      <div class="panel-title">Day ${day}</div>
      <div class="daily-grid">${cells}</div>
      <div class="panel-note">Come back tomorrow to keep your streak!</div>
      <div class="panel-btns"><button class="btn btn-big btn-gold" data-act="claim">Claim</button></div>`,
      { claim: () => { Daily.claim(); Sound.play('gift'); Confetti.burst(70); this.updateBoosters(); } });
  },

  renderMap() {
    const p = Save.data.progress;
    const total = Math.max(LEVELS.length, p.unlocked + 3);
    const scroll = $('mapScroll'), path = $('mapPath');
    const W = scroll.clientWidth || 360;
    const gap = 92, padTop = 80, padBottom = 110;
    const H = padTop + padBottom + (total - 1) * gap;
    path.style.height = H + 'px';

    const pts = [];
    let nodes = '';
    for (let n = 1; n <= total; n++) {
      const x = W / 2 + Math.sin(n * 0.85) * W * 0.28;
      const y = H - padBottom - (n - 1) * gap;
      pts.push([x, y]);
      const stars = p.stars[n] || 0;
      const state = n > p.unlocked ? 'locked' : n === p.unlocked ? 'current' : 'done';
      nodes += `<button class="node ${state}${n % 10 === 0 ? ' milestone' : ''}" data-n="${n}" ` +
               `style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px" aria-label="Level ${n}">` +
               `<span class="node-num">${n}</span>` +
               (state === 'done' ? `<span class="node-stars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>` : '') +
               `</button>`;
    }
    const line = list => list.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
    const reached = Math.min(p.unlocked, total);
    path.innerHTML =
      `<svg class="map-line" width="${W}" height="${H}" aria-hidden="true">` +
      `<path class="road-edge" d="${line(pts)}"/>` +
      `<path class="road" d="${line(pts)}"/>` +
      `<path class="road-glow" d="${line(pts.slice(0, reached))}"/>` +
      `<path class="road-done" d="${line(pts.slice(0, reached))}"/>` +
      `<path class="road-brick" d="${line(pts)}"/>` +
      `<path class="road-lane" d="${line(pts)}"/></svg>` + nodes;

    const totalStars = Object.values(p.stars).reduce((a, b) => a + b, 0);
    $('mapStars').textContent = `★ ${totalStars}`;
    const cur = pts[reached - 1];
    scroll.scrollTop = Math.max(0, cur[1] - scroll.clientHeight * 0.6);
  },

  /* ----- pop-up panels ----- */
  showModal(html, actions) {
    this._actions = actions || {};
    $('panel').innerHTML = html;
    $('modal').hidden = false;
  },

  hideModal() {
    $('modal').hidden = true;
  },

  // Plain-words explanation of a goal: what to do + how to do it.
  goalText(g) {
    const left = Math.max(0, g.need - g.have);
    switch (g.type) {
      case 'collect': {
        const t = TILE_TYPES[g.kind];
        return { icon: this.icons.tiles[g.kind], title: `Collect ${left} ${t.plural}`,
                 how: `Match ${t.plural.toLowerCase()} in rows of 3 or more. Each one cleared counts.` };
      }
      case 'gel':   return { icon: this.icons.gel,   title: `Clear the pink gel (${left})`,
                             how: 'Make matches on top of the pink squares. Darker pink needs two.' };
      case 'ice':   return { icon: this.icons.ice,   title: `Break the ice (${left})`,
                             how: 'Include the frozen tiles in a match. Thick ice takes two.' };
      case 'chain': return { icon: this.icons.chain, title: `Break the chains (${left})`,
                             how: "Chained tiles can't move. Match them where they sit to set them free." };
      case 'box':   return { icon: this.icons.box,   title: `Open the boxes (${left})`,
                             how: 'Make matches right next to a box. Darker boxes take more hits.' };
      case 'score': return { icon: null, title: `Reach ${g.need.toLocaleString()} points`,
                             how: 'Bigger matches, combos and chain reactions score the most.' };
    }
    return { icon: null, title: '', how: '' };
  },

  goalRows(goals, markNew) {
    return goals.map(g => {
      const t = this.goalText(g);
      const fresh = markNew && g.type !== 'collect' && g.type !== 'score' && !Save.data.help.seen[g.type];
      const icon = t.icon ? `<img src="${t.icon}" alt="">` : '<span class="gr-star">★</span>';
      return `<div class="goal-row">${icon}<div class="gr-text">` +
             `<div class="gr-title">${t.title}${fresh ? ' <span class="gr-new">NEW</span>' : ''}</div>` +
             `<div class="gr-how">${t.how}</div></div></div>`;
    }).join('');
  },

  showIntro(n) {
    const lv = buildLevel(n);
    const best = Save.data.progress.stars[n] || 0;
    this.showModal(`
      <div class="panel-kicker">Level</div>
      <div class="panel-title">${n}</div>
      <div class="panel-label">Your goals</div>
      <div class="goal-rows">${this.goalRows(lv.goals, true)}</div>
      <div class="panel-moves">Finish them in <b>${lv.moves + Game.assistFor(n)}</b> moves</div>
      ${best ? `<div class="panel-best">${'★'.repeat(best)}<i>${'★'.repeat(3 - best)}</i></div>` : ''}
      <div class="panel-btns">
        <button class="btn btn-big" data-act="play">Play</button>
        <button class="btn btn-ghost" data-act="close">Not now</button>
      </div>`,
      { play: () => {
        lv.goals.forEach(g => { Save.data.help.seen[g.type] = true; });
        Save.write();
        this.showScreen('game');
        Game.startLevel(n);
      } });
  },

  // Tap the goals while playing → explanation, with live counts.
  showGoalsHelp() {
    if (!Game.level || Game.state !== 'play' || Game.locked) return;
    this.showModal(`
      <div class="panel-kicker">Level ${Game.level.n}</div>
      <div class="panel-title">Goals</div>
      <div class="goal-rows">${this.goalRows(Game.level.goals.filter(g =>
        g.type === 'score' ? Game.score < g.need : g.have < g.need), false) ||
        '<div class="gr-how">All done — keep matching!</div>'}</div>
      <div class="panel-moves"><b>${Game.movesLeft}</b> moves left</div>
      <div class="panel-btns"><button class="btn btn-big" data-act="close">Got it</button></div>`);
  },

  HOWTO: [
    { title: 'Swap & match',
      text: 'Swipe a tile into its neighbor (or tap one, then the other). Line up <b>3 or more</b> of the same and they clear.',
      art: 'match' },
    { title: 'Finish your goals',
      text: 'The goals are at the top of the screen. Complete them all <b>before the moves run out</b> to win. Tap the goals any time for a reminder.',
      art: 'goals' },
    { title: 'Make power tiles',
      text: '<b>4 in a row</b> → Line tile (clears a row).<br><b>L or T shape</b> → Glitter Blast.<br><b>5 in a row</b> → Glam Ball (clears a color).<br>Swap two power tiles together for a combo!',
      art: 'power' },
    { title: 'Stars & helpers',
      text: 'Score more for up to <b>3 stars</b>. Stuck? Use the 🔨 hammer, 🌪️ twister or <b>+5</b> moves under the board.',
      art: 'stars' },
  ],

  showHowTo(i = 0, first = false) {
    const page = this.HOWTO[i];
    const last = i === this.HOWTO.length - 1;
    const T = this.icons.tiles;
    const art = {
      match: `<div class="ht-row"><img src="${T[0]}"><img src="${T[0]}"><img src="${T[1]}" class="ht-swap"><img src="${T[0]}" class="ht-swap2"></div>`,
      goals: `<div class="goals ht-goals"><div class="goal"><img src="${T[2]}"><span class="goal-num">20</span></div>` +
             `<div class="goal"><img src="${this.icons.ice}"><span class="goal-num">4</span></div></div>`,
      power: `<div class="ht-row"><img src="${T[3]}" class="ht-glow"><img src="${T[4]}" class="ht-glow"><img src="${Render.bombSprite ? Render.bombSprite.toDataURL() : T[5]}" class="ht-glow"></div>`,
      stars: '<div class="ht-stars">★★★</div>',
    }[page.art];
    this.showModal(`
      <div class="panel-kicker">How to play · ${i + 1}/${this.HOWTO.length}</div>
      <div class="panel-title ht-title">${page.title}</div>
      <div class="ht-art">${art}</div>
      <div class="ht-text">${page.text}</div>
      <div class="ht-dots">${this.HOWTO.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="panel-btns">
        <button class="btn btn-big" data-act="${last ? 'done' : 'next'}">${last ? "Let's play!" : 'Next'}</button>
        ${!last ? '<button class="btn btn-ghost" data-act="done">Skip</button>' : ''}
      </div>`,
      {
        next: () => this.showHowTo(i + 1, first),
        done: () => { Save.data.help.howTo = true; Save.write(); },
      });
  },

  showWin(n, stars, score) {
    const msg = Lines.win();
    this.showModal(`
      <div class="panel-kicker">Level ${n}</div>
      <div class="panel-title">Complete!</div>
      <div class="big-stars">${[1, 2, 3].map(i =>
        `<span class="bstar${i <= stars ? ' on' : ''}" style="animation-delay:${(0.75 + i * 0.3).toFixed(2)}s">★</span>`).join('')}</div>
      <div class="panel-score">${score.toLocaleString()}</div>
      ${msg ? `<div class="panel-msg">${esc(msg)}</div>` : ''}
      <div class="panel-btns">
        <button class="btn btn-big" data-act="next">Next level</button>
        <button class="btn btn-ghost" data-act="map">Level map</button>
      </div>`,
      { next: () => Game.startLevel(n + 1), map: () => this.openMap() });
    Confetti.burst(160);
    Sound.play('heelClicks');
    Sound.play('fanfare', 0.55);
    for (let i = 1; i <= stars; i++) Sound.play('star', 0.85 + i * 0.3, i);
  },

  showLose(lv) {
    const left = lv.goals.filter(g => (g.type === 'score' ? Game.score < g.need : g.have < g.need));
    this.showModal(`
      <div class="panel-kicker">Level ${lv.n}</div>
      <div class="panel-title">Out of moves</div>
      <div class="panel-label">Still to go</div>
      <div class="goal-rows">${this.goalRows(left, false)}</div>
      <div class="panel-btns">
        ${Save.data.boosters.moves > 0
          ? `<button class="btn btn-big btn-gold" data-act="more">+5 moves <small>(${Save.data.boosters.moves} left)</small></button>`
          : ''}
        <button class="btn btn-big" data-act="retry">Try again</button>
        <button class="btn btn-ghost" data-act="map">Level map</button>
      </div>`,
      { retry: () => Game.startLevel(lv.n), map: () => this.openMap(), more: () => Game.continueWithMoves() });
  },

  updateDebug() {
    const el = $('debug');
    if (!el) return;
    if (!Save.data.settings.showDebug) { el.textContent = ''; return; }
    const moves = Board.grid.length ? Board.findMoves().length : 0;
    el.textContent =
      `${Loop.fps || '--'} fps · save v${Save.VERSION}${Save.ok ? '' : ' (off)'} · moves available ${moves}` +
      (Game.lastSwap ? ` · last swap: ${Game.lastSwap}` : '');
  },
};


/* ---------- 11b. BACKGROUND ----------
   A yellow brick road rolling toward an original emerald skyline,
   with twinkling stars and sparkles drifting up.
   Pure CSS animation, so it costs almost no battery. */
const Background = {
  init() {
    let el = $('bg');
    if (!el) {                                   // works even if the HTML line is missing
      el = document.createElement('div');
      el.className = 'bg';
      el.id = 'bg';
      el.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(el, document.body.firstChild);
    }
    const rnd = seededRandom(20261002);
    let html = '<div class="bg-glow"></div><div class="bg-moon"></div>';

    for (let i = 0; i < 46; i++) {
      const size = (1.5 + rnd() * 2.5).toFixed(1);
      html += `<span class="bg-star" style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 48).toFixed(1)}%;` +
              `width:${size}px;height:${size}px;animation-delay:-${(rnd() * 3).toFixed(2)}s;` +
              `animation-duration:${(2.2 + rnd() * 2.8).toFixed(2)}s"></span>`;
    }

    html += this.skyline(rnd);
    html += '<div class="bg-ground"></div>';
    html += '<div class="bg-road"><div class="road-plane"><div class="road-bricks" id="roadBricks"></div></div></div>';
    // soft rolling hills hide the seam where the city meets the land
    html += `<svg class="bg-hills" viewBox="0 0 400 40" preserveAspectRatio="none">
      <defs><linearGradient id="hillG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f8a6c"/><stop offset="1" stop-color="#1c5a4c"/></linearGradient></defs>
      <path d="M0 22 C 40 8, 90 10, 130 18 S 190 30, 200 26 S 260 6, 310 14 S 380 26, 400 16 L400 40 L0 40Z" fill="url(#hillG)" opacity=".75"/>
      <path d="M0 30 C 60 20, 120 24, 170 32 L 230 32 C 280 22, 340 20, 400 28 L400 40 L0 40Z" fill="#1c5a4c"/>
    </svg>`;

    for (let i = 0; i < 22; i++) {
      const kind = i % 5 === 0 ? ' star' : i % 4 === 0 ? ' pink' : '';
      const size = kind === ' star' ? 8 + rnd() * 7 : 5 + rnd() * 8;
      html += `<span class="bg-spark${kind}" style="left:${(rnd() * 100).toFixed(1)}%;` +
              `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;` +
              `--drift:${Math.round((rnd() - 0.5) * 120)}px;` +
              `animation-duration:${(9 + rnd() * 10).toFixed(1)}s;animation-delay:-${(rnd() * 18).toFixed(1)}s"></span>`;
    }
    el.innerHTML = html;
    $('roadBricks').style.backgroundImage = `url(${this.brickTile()})`;
  },

  // One tile of golden bricks (2 rows, offset), repeated along the road.
  brickTile() {
    const W = 100, H = 80, rnd = seededRandom(77);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#8A5E0C';                    // mortar
    x.fillRect(0, 0, W, H);
    const golds = ['#F2C14E', '#F5CD5C', '#E9B23C', '#F7D774', '#EDBA45'];
    const brick = (bx, by, bw, bh) => {
      const g = x.createLinearGradient(0, by, 0, by + bh);
      const base = golds[Math.floor(rnd() * golds.length)];
      g.addColorStop(0, '#FFE9A8');
      g.addColorStop(0.18, base);
      g.addColorStop(1, '#C9921E');
      x.fillStyle = g;
      rr(x, bx + 2, by + 2, bw - 4, bh - 4, 4);
      x.fill();
    };
    for (let row = 0; row < 2; row++) {
      const off = row ? -25 : 0;
      for (let i = -1; i < 3; i++) brick(off + i * 50, row * 40, 50, 40);
    }
    return c.toDataURL();
  },

  // Two layers of spires: a faint far row and a glowing near row.
  skyline(rnd) {
    const W = 400, H = 150;
    const towers = (count, minH, maxH, fill, windows) => {
      let out = '';
      let x = -6;
      for (let i = 0; i < count && x < W; i++) {
        const w = 10 + rnd() * 16;
        const h = minH + rnd() * (maxH - minH);
        const top = H - h;
        const cx = x + w / 2;
        const style = rnd();
        out += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;
        if (style < 0.55) {
          // pointed spire + needle
          const tip = 12 + rnd() * 22;
          out += `<path d="M${x.toFixed(1)} ${top.toFixed(1)} L${cx.toFixed(1)} ${(top - tip).toFixed(1)} L${(x + w).toFixed(1)} ${top.toFixed(1)}Z" fill="${fill}"/>`;
          out += `<rect x="${(cx - 0.7).toFixed(1)}" y="${(top - tip - 9).toFixed(1)}" width="1.4" height="10" fill="${fill}"/>`;
          if (windows) out += `<circle cx="${cx.toFixed(1)}" cy="${(top - tip - 10).toFixed(1)}" r="1.6" fill="#D9FFE9"/>`;
        } else if (style < 0.8) {
          // onion dome
          const r = w / 2;
          out += `<path d="M${x.toFixed(1)} ${top.toFixed(1)} Q${x.toFixed(1)} ${(top - r * 1.3).toFixed(1)} ${cx.toFixed(1)} ${(top - r * 2).toFixed(1)} ` +
                 `Q${(x + w).toFixed(1)} ${(top - r * 1.3).toFixed(1)} ${(x + w).toFixed(1)} ${top.toFixed(1)}Z" fill="${fill}"/>`;
        } else {
          // stepped tower
          out += `<rect x="${(x + w * 0.2).toFixed(1)}" y="${(top - 10).toFixed(1)}" width="${(w * 0.6).toFixed(1)}" height="10" fill="${fill}"/>`;
          out += `<rect x="${(x + w * 0.38).toFixed(1)}" y="${(top - 18).toFixed(1)}" width="${(w * 0.24).toFixed(1)}" height="8" fill="${fill}"/>`;
        }
        if (windows) {
          for (let wy = top + 6; wy < H - 4; wy += 8) {
            for (let wx = x + 3; wx < x + w - 4; wx += 5.5) {
              if (rnd() < 0.4) out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="2" height="3" rx=".8" fill="#C9FFE0" opacity="${(0.45 + rnd() * 0.55).toFixed(2)}"/>`;
            }
          }
        }
        x += w + (rnd() < 0.3 ? rnd() * 6 : -2);
      }
      return out;
    };
    return `<svg class="bg-city" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="cityFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2E8F78" stop-opacity=".55"/><stop offset="1" stop-color="#174A45" stop-opacity=".8"/>
        </linearGradient>
        <linearGradient id="cityNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#34BE8A"/><stop offset=".55" stop-color="#1B7A60"/><stop offset="1" stop-color="#0F3B37"/>
        </linearGradient>
        <filter id="cityGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g>${towers(30, 45, 100, 'url(#cityFar)', false)}</g>
      <g filter="url(#cityGlow)">${towers(28, 22, 72, 'url(#cityNear)', true)}</g>
    </svg>`;
  },
};


/* ---------- 12. BOOT ---------- */
function boot() {
  Save.load();
  Render.init();
  Input.init();
  UI.init();
  Background.init();

  // One-time: carry over the 30 levels she beat on the old link.
  const p = Save.data.progress, h = Save.data.help;
  if (CONFIG.alreadyBeatThrough && !h.carriedOver) {
    for (let n = 1; n <= CONFIG.alreadyBeatThrough; n++) if (!p.stars[n]) p.stars[n] = 1;
    p.unlocked = Math.max(p.unlocked, CONFIG.alreadyBeatThrough + 1);
    h.carriedOver = true;
    h.howTo = h.howTo || false;
    ['gel', 'ice', 'chain', 'box'].forEach(t => { h.seen[t] = true; });
    Save.write();
  }

  const ro = new ResizeObserver(() => Render.layout());
  ro.observe($('boardArea'));

  // Save whenever she leaves the app (iOS may kill the tab without warning).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Save.write();
      if (Sound.ctx) Sound.ctx.suspend();          // no music while the phone is locked
    } else if (Sound.ctx && Sound.ready) {
      Sound.ctx.resume();
    }
  });
  window.addEventListener('pagehide', () => Save.write());

  UI.showScreen('title');
}

// Wait for the font so the title doesn't jump; fall back after 1s.
if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1000))]).then(boot);
} else {
  boot();
}

// Handy for testing in the console.
window.__game = { Board, Game, Save, Render, Loop, FX, UI, Tweens, BOMB, makeTile, buildLevel, LEVELS,
                  Sound, Music, Particles, Shake, Confetti, Daily };
