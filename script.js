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

  // Special links (add to the end of the game's address):
  //   ?beat=30   → marks levels 1–30 complete (1★ each) so she continues at 31.
  //                Only ever moves progress forward, never back.
  //   ?reset=1   → wipes this device's progress and starts over at level 1.
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

  // Extra win lines per world (mixed in with yours above).
  worldWinMessages: {
    2: ["That's a wrap on that one!", 'Check the gate — we got it!', 'Perfect take!', 'Moving on — next setup!'],
    5: ['Turn it up!', 'The dance floor is yours!', 'DJ, play her song!', 'Encore! Encore!'],
    4: ['That’s a print!', 'Golden hour, golden take!', 'Location scouts are jealous!', 'Moving to the next setup!'],
    3: ['Order up!', 'The crew says thank you!', 'Seconds, anyone?', 'Chef’s kiss!'],
    6: ['And the award goes to… {name}!', "{name}, you've earned this one.", 'Standing ovation!', 'Speech! Speech!'],
  },

  // ===== Level 180 finale: end credits =====
  fullName: 'Myesha Starks',
  awardTitle: 'Best Hair Department',
  credits: [                     // her real credits — add more anytime
    'Sweetwater (2023)',
    'Love, Victor',
  ],
  // Chris: replace this with your own message to her.
  finaleMessage: "From the first chair to the red carpet — I've watched you earn every bit of it. I'm so proud of you.",
  finaleSignature: '— Chris',
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

const SALON_TILES = [
  { id: 'comb',     name: 'Comb', plural: 'Combs',        base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawComb },
  { id: 'scissors', name: 'Shears', plural: 'Shears',      base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawScissors },
  { id: 'bow',      name: 'Bow', plural: 'Bows',         base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawBow },
  { id: 'curler',   name: 'Curler', plural: 'Curlers',      base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawCurler },
  { id: 'dryer',    name: 'Blow Dryer', plural: 'Blow Dryers',  base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawDryer },
  { id: 'spray',    name: 'Spritz', plural: 'Spritz Bottles',      base: '#7CC243', light: '#B6E68C', dark: '#4A8420', draw: drawSpray },
];

/* ----- World 2: Backstage tiles ----- */
function drawReel(ctx, t) {
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.arc(46, 46, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dark;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    ctx.beginPath(); ctx.arc(46 + Math.cos(a) * 17, 46 + Math.sin(a) * 17, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(46, 46, 4, 0, Math.PI * 2); ctx.fill();
  // film tail
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(62, 70); ctx.quadraticCurveTo(76, 78, 90, 70); ctx.lineTo(92, 82); ctx.quadraticCurveTo(76, 90, 60, 80);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;
  [[70, 79], [78, 80], [86, 77]].forEach(([x, y]) => { ctx.fillRect(x - 1.5, y - 2, 3, 3.5); });
}

function drawClap(ctx, t) {
  // board
  ctx.fillStyle = WHITE;
  rr(ctx, 20, 44, 60, 38, 5); ctx.fill();
  ctx.fillStyle = t.dark;
  rr(ctx, 26, 58, 48, 4, 2); ctx.fill();
  rr(ctx, 26, 68, 34, 4, 2); ctx.fill();
  // striped top bar on the board
  ctx.save();
  rr(ctx, 20, 44, 60, 9, 3); ctx.clip();
  ctx.fillStyle = WHITE; ctx.fillRect(20, 44, 60, 9);
  ctx.fillStyle = t.dark;
  for (let x = 14; x < 84; x += 14) { ctx.beginPath(); ctx.moveTo(x, 53); ctx.lineTo(x + 7, 44); ctx.lineTo(x + 14, 44); ctx.lineTo(x + 7, 53); ctx.fill(); }
  ctx.restore();
  // open clapper
  ctx.save();
  ctx.translate(21, 42); ctx.rotate(-0.32);
  ctx.fillStyle = WHITE; rr(ctx, 0, -10, 60, 10, 3); ctx.fill();
  ctx.beginPath(); rr(ctx, 0, -10, 60, 10, 3); ctx.clip();
  ctx.fillStyle = t.dark;
  for (let x = -6; x < 64; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 7, -10); ctx.lineTo(x + 14, -10); ctx.lineTo(x + 7, 0); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(22, 43, 3, 0, Math.PI * 2); ctx.fill();
}

function drawLipstick(ctx, t) {
  withRotation(ctx, 16, () => {
    ctx.fillStyle = WHITE;
    // bullet
    ctx.beginPath();
    ctx.moveTo(40, 50); ctx.lineTo(40, 30); ctx.quadraticCurveTo(40, 22, 48, 18); ctx.lineTo(60, 13); ctx.lineTo(60, 50); ctx.closePath();
    ctx.fill();
    // collar
    rr(ctx, 37, 48, 26, 12, 3); ctx.fill();
    ctx.fillStyle = t.dark; ctx.fillRect(37, 52.5, 26, 2.5);
    // case
    ctx.fillStyle = WHITE;
    rr(ctx, 35, 60, 30, 28, 5); ctx.fill();
    ctx.fillStyle = t.dark; rr(ctx, 40, 65, 4, 18, 2); ctx.fill();
  });
}

function drawStarAward(ctx, t) {
  const star = (cx, cy, R, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
  };
  ctx.fillStyle = WHITE;
  star(50, 50, 36, 15); ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = WHITE; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = t.dark;
  star(50, 52, 14, 6); ctx.fill();
}

function drawBrush(ctx, t) {
  withRotation(ctx, 38, () => {
    ctx.fillStyle = WHITE;
    // big fluffy powder-brush head
    ctx.beginPath();
    ctx.moveTo(42, 42);
    ctx.bezierCurveTo(26, 34, 28, 8, 50, 6);
    ctx.bezierCurveTo(72, 8, 74, 34, 58, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = t.dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(44, 16); ctx.quadraticCurveTo(40, 26, 44, 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56, 16); ctx.quadraticCurveTo(60, 26, 56, 36); ctx.stroke();
    // ferrule
    rr(ctx, 41, 41, 18, 12, 2); ctx.fill();
    ctx.fillStyle = t.dark;
    ctx.fillRect(41, 45, 18, 2); ctx.fillRect(41, 49, 18, 2);
    // handle
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(43, 53); ctx.lineTo(57, 53); ctx.lineTo(54, 90); ctx.quadraticCurveTo(50, 94, 46, 90); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = t.dark;
    ctx.beginPath(); ctx.arc(50, 84, 2.5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawMirror(ctx, t) {
  // stand
  ctx.fillStyle = WHITE;
  rr(ctx, 46, 66, 8, 14, 2); ctx.fill();
  rr(ctx, 32, 78, 36, 7, 3.5); ctx.fill();
  // frame
  ctx.beginPath(); ctx.ellipse(50, 42, 25, 28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.ellipse(50, 42, 17, 20, 0, 0, Math.PI * 2); ctx.fill();
  // glass shine
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(41, 37); ctx.lineTo(48, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(43, 45); ctx.lineTo(55, 31); ctx.stroke();
  // bulbs around the frame
  ctx.fillStyle = t.light;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath(); ctx.arc(50 + Math.cos(a) * 21, 42 + Math.sin(a) * 24, 2.6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawWig(ctx, t) {
  // stand
  ctx.fillStyle = WHITE;
  rr(ctx, 45, 70, 10, 12, 2); ctx.fill();
  rr(ctx, 32, 80, 36, 6, 3); ctx.fill();
  // big styled hair (bouffant + side curls)
  ctx.beginPath();
  ctx.arc(50, 34, 26, Math.PI, 0);
  ctx.bezierCurveTo(80, 50, 74, 66, 66, 68);
  ctx.lineTo(34, 68);
  ctx.bezierCurveTo(26, 66, 20, 50, 24, 34);
  ctx.closePath();
  ctx.fill();
  // face
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.ellipse(50, 50, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
  // hair swoop + curls
  ctx.strokeStyle = t.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(32, 30); ctx.quadraticCurveTo(50, 14, 68, 30); ctx.stroke();
  ctx.beginPath(); ctx.arc(29, 56, 4, 0, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(71, 56, 4, Math.PI * 1.5, Math.PI, true); ctx.stroke();
}

const STAGE_TILES = [
  { id: 'reel',     name: 'Film Reel',  plural: 'Film Reels',  base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawReel },
  { id: 'clap',     name: 'Clapboard',  plural: 'Clapboards',  base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawClap },
  { id: 'lipstick', name: 'Lipstick',   plural: 'Lipsticks',   base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawLipstick },
  { id: 'wig',      name: 'Wig Head',   plural: 'Wig Heads',   base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawWig },
  { id: 'brush',    name: 'Brush',      plural: 'Brushes',     base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawBrush },
  { id: 'mirror',   name: 'Mirror',     plural: 'Mirrors',     base: '#7CC243', light: '#E9FFD2', dark: '#4A8420', draw: drawMirror },
];

/* ----- World 3: Awards Night tiles ----- */
function drawPressCam(ctx, t) {
  ctx.fillStyle = WHITE;
  rr(ctx, 40, 18, 22, 12, 3); ctx.fill();          // flash head
  rr(ctx, 47, 28, 8, 8, 1); ctx.fill();
  rr(ctx, 16, 36, 68, 44, 9); ctx.fill();           // body
  rr(ctx, 22, 31, 16, 8, 2); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 58, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.arc(50, 58, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 58, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.light;
  ctx.fillRect(43, 21, 16, 6);
  sparkle(ctx, 72, 16, 9, WHITE);
}

function drawEnvelope(ctx, t) {
  ctx.fillStyle = WHITE;
  rr(ctx, 14, 28, 72, 48, 6); ctx.fill();
  ctx.strokeStyle = t.dark; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(17, 31); ctx.lineTo(50, 56); ctx.lineTo(83, 31); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(17, 73); ctx.lineTo(40, 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(83, 73); ctx.lineTo(60, 52); ctx.stroke();
  // wax seal with a star
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 56, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.4 : 6;
    ctx.lineTo(50 + Math.cos(a) * r, 56 + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
}

function drawBouquet(ctx, t) {
  // wrap
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.moveTo(30, 48); ctx.lineTo(70, 48); ctx.lineTo(54, 90); ctx.lineTo(46, 90); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.moveTo(44, 70); ctx.lineTo(56, 70); ctx.lineTo(53, 76); ctx.lineTo(47, 76); ctx.closePath(); ctx.fill();
  // three blooms
  const bloom = (cx, cy, r) => {
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = t.dark;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); ctx.fill();
  };
  bloom(34, 36, 13); bloom(66, 36, 13); bloom(50, 24, 14);
}

function drawTrophy(ctx, t) {
  ctx.fillStyle = WHITE;
  // cup
  ctx.beginPath();
  ctx.moveTo(28, 16); ctx.lineTo(72, 16); ctx.lineTo(70, 34);
  ctx.bezierCurveTo(68, 50, 58, 56, 50, 56);
  ctx.bezierCurveTo(42, 56, 32, 50, 30, 34);
  ctx.closePath(); ctx.fill();
  // handles
  ctx.strokeStyle = WHITE; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(26, 30, 9, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(74, 30, 9, Math.PI * 1.5, Math.PI * 0.5); ctx.stroke();
  // stem + base
  rr(ctx, 45, 54, 10, 14, 2); ctx.fill();
  rr(ctx, 34, 66, 32, 8, 3); ctx.fill();
  rr(ctx, 28, 74, 44, 10, 3); ctx.fill();
  // engraved star + plate
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9.5;
    ctx.lineTo(50 + Math.cos(a) * r, 33 + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  rr(ctx, 38, 77, 24, 4, 2); ctx.fill();
}

function drawRosette(ctx, t) {
  // tails
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.moveTo(38, 52); ctx.lineTo(28, 88); ctx.lineTo(37, 82); ctx.lineTo(44, 90); ctx.lineTo(50, 56); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(62, 52); ctx.lineTo(72, 88); ctx.lineTo(63, 82); ctx.lineTo(56, 90); ctx.lineTo(50, 56); ctx.closePath(); ctx.fill();
  // ruffled ring
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = i * Math.PI / 16, r = i % 2 ? 26 : 30;
    ctx.lineTo(50 + Math.cos(a) * r, 40 + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 40, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = '700 22px Fredoka, ui-rounded, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('1', 50, 41);
}

function drawFlute(ctx, t) {
  withRotation(ctx, -12, () => {
    ctx.fillStyle = WHITE;
    // glass
    ctx.beginPath();
    ctx.moveTo(38, 12); ctx.lineTo(62, 12); ctx.lineTo(58, 52);
    ctx.quadraticCurveTo(56, 60, 50, 60); ctx.quadraticCurveTo(44, 60, 42, 52);
    ctx.closePath(); ctx.fill();
    rr(ctx, 48, 58, 4, 22, 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(50, 82, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    // sparkling drink
    ctx.fillStyle = t.dark;
    ctx.beginPath();
    ctx.moveTo(40.5, 26); ctx.lineTo(59.5, 26); ctx.lineTo(57, 51);
    ctx.quadraticCurveTo(55.5, 56, 50, 56); ctx.quadraticCurveTo(44.5, 56, 43, 51);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = WHITE;
    [[47, 46, 1.8], [53, 40, 1.5], [49, 33, 1.3], [54, 50, 1.2]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
  });
  sparkle(ctx, 74, 20, 7, WHITE);
}

const AWARD_TILES = [
  { id: 'camera',   name: 'Press Camera', plural: 'Press Cameras', base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawPressCam },
  { id: 'envelope', name: 'Envelope',     plural: 'Envelopes',     base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawEnvelope },
  { id: 'bouquet',  name: 'Bouquet',      plural: 'Bouquets',      base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawBouquet },
  { id: 'trophy',   name: 'Trophy',       plural: 'Trophies',      base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawTrophy },
  { id: 'ribbon',   name: 'Winner Ribbon', plural: 'Winner Ribbons', base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawRosette },
  { id: 'flute',    name: 'Toast',        plural: 'Toasts',        base: '#7CC243', light: '#B6E68C', dark: '#4A8420', draw: drawFlute },
];


/* World 3 · The Crafty Table: crew food. White icons with a dark accent, like the others. */
function drawDonut(ctx, t) {
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.arc(50, 52, 31, 0, Math.PI * 2); ctx.arc(50, 52, 10, 0, Math.PI * 2, true); ctx.fill('evenodd');
  // icing with a drippy edge
  ctx.fillStyle = t.dark;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = 25 + (i % 3 === 0 ? 3.5 : 0);
    const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.arc(50, 50, 12, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  // sprinkles
  const cols = ['#FFE08A', '#FFFFFF', '#FFA3CF'];
  [[36, 38, 20], [62, 36, -30], [68, 54, 60], [40, 64, -50], [56, 68, 10], [32, 52, 80], [50, 30, -10]].forEach(([x, y, d], i) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(d * Math.PI / 180);
    ctx.fillStyle = cols[i % 3]; rr(ctx, -3.5, -1.3, 7, 2.6, 1.3); ctx.fill();
    ctx.restore();
  });
}

function drawTaco(ctx, t) {
  withRotation(ctx, -10, () => {
    // fillings piled above the shell
    ctx.fillStyle = '#7CC243';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(22 + i * 9.3, 42 - Math.sin(i * 0.9) * 3, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#FF3B3B';
    [[32, 37], [50, 33], [67, 38]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#FFE08A';
    [[41, 36], [59, 35]].forEach(([x, y]) => { rr(ctx, x - 4, y - 2.5, 8, 5, 2); ctx.fill(); });
    // shell: a U-shaped tortilla
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.moveTo(14, 44); ctx.arc(50, 44, 36, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = t.dark;
    [[30, 58], [50, 66], [70, 58], [40, 72], [60, 72], [24, 48], [76, 48]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill(); });
  });
}

function drawCupcake(ctx, t) {
  // wrapper
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.moveTo(28, 52); ctx.lineTo(72, 52); ctx.lineTo(65, 84); ctx.lineTo(35, 84); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = t.dark; ctx.lineWidth = 2.4;
  [36, 44, 50, 56, 64].forEach((x, i) => { ctx.beginPath(); ctx.moveTo(x, 54); ctx.lineTo(38 + i * 6, 82); ctx.stroke(); });
  // frosting swirl
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.ellipse(50, 50, 27, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(50, 40, 21, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(50, 31, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(44, 28); ctx.quadraticCurveTo(50, 14, 56, 22); ctx.lineTo(52, 28); ctx.fill();
  // cherry
  ctx.fillStyle = '#FF3B5C';
  ctx.beginPath(); ctx.arc(57, 18, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4A8420'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(58, 12); ctx.quadraticCurveTo(60, 5, 66, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(55, 16, 1.8, 0, Math.PI * 2); ctx.fill();
}

function drawBurger(ctx, t) {
  ctx.fillStyle = WHITE;                                          // top bun
  ctx.beginPath(); ctx.moveTo(20, 46); ctx.quadraticCurveTo(22, 18, 50, 18); ctx.quadraticCurveTo(78, 18, 80, 46); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;                                         // sesame
  [[36, 30], [50, 25], [63, 31], [44, 37], [58, 39]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.6, 0.4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#7CC243';                                      // lettuce
  ctx.beginPath(); ctx.moveTo(17, 48);
  for (let i = 0; i <= 8; i++) ctx.lineTo(17 + i * 8.25, 48 + (i % 2 ? 6 : 0));
  ctx.lineTo(83, 52); ctx.lineTo(17, 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFD23F';                                      // cheese
  ctx.beginPath(); ctx.moveTo(20, 51); ctx.lineTo(80, 51); ctx.lineTo(70, 60); ctx.lineTo(62, 56); ctx.lineTo(30, 56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6B3E26';                                      // patty
  rr(ctx, 18, 55, 64, 11, 5.5); ctx.fill();
  ctx.fillStyle = WHITE;                                          // bottom bun
  rr(ctx, 21, 67, 58, 13, 6); ctx.fill();
}

function drawGrapes(ctx, t) {
  ctx.strokeStyle = '#6B3E26'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(50, 26); ctx.quadraticCurveTo(52, 16, 58, 12); ctx.stroke();
  ctx.fillStyle = '#7CC243';
  ctx.beginPath(); ctx.moveTo(52, 20); ctx.quadraticCurveTo(66, 10, 76, 20); ctx.quadraticCurveTo(64, 28, 52, 20); ctx.fill();
  const rows = [[36, 50, 64], [43, 57], [36, 50, 64], [43, 57], [50]];
  rows.forEach((xs, r) => xs.forEach(x => {
    const y = 34 + r * 11;
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.light;
    ctx.beginPath(); ctx.arc(x - 2.5, y - 2.5, 2.2, 0, Math.PI * 2); ctx.fill();
  }));
}

function drawAvocado(ctx, t) {
  withRotation(ctx, 18, () => {
    ctx.fillStyle = t.dark;                                        // skin
    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.bezierCurveTo(64, 12, 68, 34, 74, 50);
    ctx.bezierCurveTo(82, 72, 68, 88, 50, 88);
    ctx.bezierCurveTo(32, 88, 18, 72, 26, 50);
    ctx.bezierCurveTo(32, 34, 36, 12, 50, 12);
    ctx.fill();
    ctx.fillStyle = WHITE;                                         // flesh
    ctx.beginPath();
    ctx.moveTo(50, 18);
    ctx.bezierCurveTo(60, 18, 63, 36, 68, 50);
    ctx.bezierCurveTo(75, 69, 64, 82, 50, 82);
    ctx.bezierCurveTo(36, 82, 25, 69, 32, 50);
    ctx.bezierCurveTo(37, 36, 40, 18, 50, 18);
    ctx.fill();
    ctx.fillStyle = '#8A4F2C';                                     // pit
    ctx.beginPath(); ctx.arc(50, 62, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(46, 58, 3.5, 0, Math.PI * 2); ctx.fill();
  });
}

const CRAFT_TILES = [
  { id: 'donut',   name: 'Donut',   plural: 'Donuts',   base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawDonut },
  { id: 'taco',    name: 'Taco',    plural: 'Tacos',    base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawTaco },
  { id: 'cupcake', name: 'Cupcake', plural: 'Cupcakes', base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawCupcake },
  { id: 'burger',  name: 'Slider',  plural: 'Sliders',  base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawBurger },
  { id: 'grapes',  name: 'Grapes',  plural: 'Grapes',   base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawGrapes },
  { id: 'avocado', name: 'Avocado', plural: 'Avocados', base: '#7CC243', light: '#B6E68C', dark: '#3F7A18', draw: drawAvocado },
];

/* World 4 · On Location: out in the desert and down by the beach. */
function drawCompass(ctx, t) {
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.arc(50, 52, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 52, 25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE;                                          // ring loop
  rr(ctx, 45, 14, 10, 8, 3); ctx.fill();
  // tick marks
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r1 = i % 2 ? 21 : 18;
    ctx.beginPath(); ctx.moveTo(50 + Math.cos(a) * r1, 52 + Math.sin(a) * r1);
    ctx.lineTo(50 + Math.cos(a) * 24, 52 + Math.sin(a) * 24); ctx.stroke();
  }
  // needle
  ctx.fillStyle = '#FF5A4E';
  ctx.beginPath(); ctx.moveTo(50, 33); ctx.lineTo(56, 52); ctx.lineTo(44, 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.moveTo(50, 71); ctx.lineTo(56, 52); ctx.lineTo(44, 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.arc(50, 52, 3, 0, Math.PI * 2); ctx.fill();
}

function drawParasol(ctx, t) {
  withRotation(ctx, -14, () => {
    ctx.fillStyle = WHITE;                                        // canopy
    ctx.beginPath(); ctx.moveTo(14, 46); ctx.quadraticCurveTo(50, 2, 86, 46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = t.dark;                                       // stripes
    ctx.beginPath(); ctx.moveTo(50, 17); ctx.quadraticCurveTo(38, 26, 32, 46); ctx.lineTo(42, 46); ctx.quadraticCurveTo(45, 28, 50, 17); ctx.fill();
    ctx.beginPath(); ctx.moveTo(50, 17); ctx.quadraticCurveTo(62, 26, 68, 46); ctx.lineTo(58, 46); ctx.quadraticCurveTo(55, 28, 50, 17); ctx.fill();
    ctx.fillStyle = WHITE;                                        // scalloped edge
    [20, 32, 44, 56, 68, 80].forEach(x => { ctx.beginPath(); ctx.arc(x, 46, 6, 0, Math.PI); ctx.fill(); });
    rr(ctx, 47.5, 46, 5, 40, 2.5); ctx.fill();                   // pole
    ctx.beginPath(); ctx.arc(50, 13, 3.5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawShell(ctx, t) {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.bezierCurveTo(22, 74, 14, 46, 22, 34);
  ctx.quadraticCurveTo(50, 8, 78, 34);
  ctx.bezierCurveTo(86, 46, 78, 74, 50, 80);
  ctx.fill();
  ctx.fillStyle = WHITE;                                          // hinge
  rr(ctx, 40, 76, 20, 9, 4); ctx.fill();
  ctx.strokeStyle = t.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  [-28, -14, 0, 14, 28].forEach(dx => {
    ctx.beginPath(); ctx.moveTo(50, 76); ctx.quadraticCurveTo(50 + dx * 0.6, 50, 50 + dx, 26 + Math.abs(dx) * 0.25); ctx.stroke();
  });
  sparkle(ctx, 76, 22, 6, WHITE);
}

function drawSun(ctx, t) {
  ctx.fillStyle = WHITE;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.save(); ctx.translate(50, 50); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-5, -26); ctx.lineTo(0, -40); ctx.lineTo(5, -26); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(50, 50, 23, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t.dark;                                         // happy face
  ctx.beginPath(); ctx.arc(42, 46, 3, 0, Math.PI * 2); ctx.arc(58, 46, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = t.dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(50, 52, 9, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
}

function drawShades(ctx, t) {
  withRotation(ctx, -10, () => {
    ctx.fillStyle = WHITE;
    rr(ctx, 8, 36, 84, 7, 3.5); ctx.fill();                       // top bar
    [29, 71].forEach(x => { rr(ctx, x - 20, 38, 40, 30, 13); ctx.fill(); });   // frames
    ctx.fillStyle = t.dark;
    [29, 71].forEach(x => { rr(ctx, x - 15.5, 42, 31, 22, 10); ctx.fill(); }); // lenses
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    [[22, 47], [64, 47]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + 8, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 4, y + 10); ctx.closePath(); ctx.fill(); });
  });
}

function drawCactus(ctx, t) {
  ctx.fillStyle = WHITE;
  rr(ctx, 41, 16, 18, 64, 9); ctx.fill();                        // trunk
  rr(ctx, 20, 36, 12, 26, 6); ctx.fill();                        // left arm
  rr(ctx, 20, 52, 26, 11, 5.5); ctx.fill();
  rr(ctx, 68, 28, 12, 26, 6); ctx.fill();                        // right arm
  rr(ctx, 54, 44, 26, 11, 5.5); ctx.fill();
  ctx.fillStyle = t.dark;                                         // ribs
  rr(ctx, 49, 22, 2.4, 52, 1.2); ctx.fill();
  ctx.fillStyle = '#EC5FA5';                                      // a little flower on top
  [[0, -5], [5, 0], [0, 5], [-5, 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(50 + dx, 16 + dy, 4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(50, 16, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#C98A52';                                      // pot
  ctx.beginPath(); ctx.moveTo(30, 78); ctx.lineTo(70, 78); ctx.lineTo(65, 92); ctx.lineTo(35, 92); ctx.closePath(); ctx.fill();
}

const LOCATION_TILES = [
  { id: 'compass',    name: 'Compass',    plural: 'Compasses',  base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawCompass },
  { id: 'parasol',    name: 'Beach Umbrella', plural: 'Beach Umbrellas', base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawParasol },
  { id: 'shell',      name: 'Seashell',   plural: 'Seashells',  base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawShell },
  { id: 'sun',        name: 'Sunshine',   plural: 'Suns',       base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawSun },
  { id: 'shades',     name: 'Sunglasses', plural: 'Sunglasses', base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawShades },
  { id: 'cactus',     name: 'Cactus',     plural: 'Cacti',      base: '#7CC243', light: '#B6E68C', dark: '#3F7A18', draw: drawCactus },
];

function drawWaterItem(ctx) {
  // crew water bottle with a turquoise label and cap
  ctx.fillStyle = 'rgba(190,235,255,0.95)';
  rr(ctx, 36, 30, 28, 50, 9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(40, 32); ctx.lineTo(44, 22); ctx.lineTo(56, 22); ctx.lineTo(60, 32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3AAFA9';
  rr(ctx, 43, 13, 14, 10, 3); ctx.fill();                         // cap
  rr(ctx, 36, 46, 28, 16, 2); ctx.fill();                         // label
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.moveTo(50, 49); ctx.quadraticCurveTo(56, 56, 50, 59); ctx.quadraticCurveTo(44, 56, 50, 49); ctx.fill();  // drop
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  rr(ctx, 40, 34, 4, 10, 2); ctx.fill(); rr(ctx, 40, 66, 4, 9, 2); ctx.fill();
}

/* World 5 · The Wrap Party: neon lights and music. */
function drawDiscoBall(ctx, t) {
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(50, 6); ctx.lineTo(50, 20); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(50, 52, 31, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = WHITE; ctx.fillRect(19, 21, 62, 62);
  ctx.fillStyle = t.dark;
  for (let y = 21; y < 84; y += 9) for (let x = 19 + ((y / 9) % 2 ? 0 : 4.5); x < 82; x += 9) {
    if (((x * 7 + y * 3) | 0) % 5 === 0) { ctx.fillStyle = t.light; } else ctx.fillStyle = t.dark;
    ctx.fillRect(x + 1, y + 1, 6.5, 6.5);
  }
  ctx.restore();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(50, 52, 31, 0, Math.PI * 2); ctx.stroke();
  sparkle(ctx, 34, 38, 8, WHITE);
  sparkle(ctx, 80, 22, 6, WHITE);
}

function drawBoombox(ctx, t) {
  ctx.fillStyle = WHITE;
  rr(ctx, 12, 32, 76, 46, 9); ctx.fill();
  ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(26, 32); ctx.lineTo(30, 20); ctx.lineTo(70, 20); ctx.lineTo(74, 32); ctx.stroke();  // handle
  ctx.fillStyle = t.dark;
  [30, 70].forEach(x => { ctx.beginPath(); ctx.arc(x, 58, 12, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = WHITE;
  [30, 70].forEach(x => { ctx.beginPath(); ctx.arc(x, 58, 4.5, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = t.dark;
  rr(ctx, 42, 38, 16, 9, 2); ctx.fill();                         // tape window
  [44, 49, 54].forEach(x => { rr(ctx, x, 54, 3, 14, 1.5); ctx.fill(); });
}

function drawPartyHat(ctx, t) {
  withRotation(ctx, 10, () => {
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.moveTo(50, 14); ctx.lineTo(76, 80); ctx.lineTo(24, 80); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(50, 14); ctx.lineTo(76, 80); ctx.lineTo(24, 80); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = t.dark; ctx.lineWidth = 6;
    [34, 50, 66].forEach(y => { ctx.beginPath(); ctx.moveTo(18, y + 14); ctx.lineTo(82, y - 6); ctx.stroke(); });
    ctx.restore();
    ctx.fillStyle = '#FFE08A';                                    // pom-pom
    ctx.beginPath(); ctx.arc(50, 13, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WHITE;                                        // brim
    rr(ctx, 20, 77, 60, 8, 4); ctx.fill();
  });
}

function drawMusicNote(ctx, t) {
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.ellipse(32, 72, 13, 10, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(70, 64, 13, 10, -0.4, 0, Math.PI * 2); ctx.fill();
  rr(ctx, 40, 22, 6, 50, 3); ctx.fill();
  rr(ctx, 78, 14, 6, 50, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(40, 22); ctx.lineTo(84, 12); ctx.lineTo(84, 26); ctx.lineTo(40, 36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.ellipse(29, 69, 4, 2.6, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(67, 61, 4, 2.6, -0.4, 0, Math.PI * 2); ctx.fill();
  sparkle(ctx, 18, 28, 6, WHITE);
}

function drawHeadphones(ctx, t) {
  ctx.strokeStyle = WHITE; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(50, 54, 30, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = WHITE;
  rr(ctx, 13, 48, 20, 32, 9); ctx.fill();
  rr(ctx, 67, 48, 20, 32, 9); ctx.fill();
  ctx.fillStyle = t.dark;
  rr(ctx, 19, 54, 9, 20, 4.5); ctx.fill();
  rr(ctx, 72, 54, 9, 20, 4.5); ctx.fill();
  ctx.fillStyle = WHITE;                                          // little sound waves
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(50, 66, 6, -0.9, 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(50, 66, 6, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
}

function drawGlowStick(ctx, t) {
  withRotation(ctx, 32, () => {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';                     // glow
    rr(ctx, 33, 6, 34, 88, 17); ctx.fill();
    ctx.fillStyle = WHITE;
    rr(ctx, 40, 12, 20, 76, 10); ctx.fill();
    ctx.fillStyle = t.dark;
    rr(ctx, 40, 12, 20, 10, 5); ctx.fill();
    rr(ctx, 40, 78, 20, 10, 5); ctx.fill();
    ctx.fillStyle = t.light;
    rr(ctx, 45, 28, 5, 44, 2.5); ctx.fill();
  });
  sparkle(ctx, 22, 26, 7, WHITE);
  sparkle(ctx, 80, 76, 6, WHITE);
}

const PARTY_TILES = [
  { id: 'disco',      name: 'Disco Ball', plural: 'Disco Balls', base: '#3AAFA9', light: '#8BE6DF', dark: '#1D7470', draw: drawDiscoBall },
  { id: 'boombox',    name: 'Boombox',    plural: 'Boomboxes',   base: '#FF7E5F', light: '#FFB49E', dark: '#C14A2E', draw: drawBoombox },
  { id: 'partyhat',   name: 'Party Hat',  plural: 'Party Hats',  base: '#EC5FA5', light: '#FFA3CF', dark: '#A8306C', draw: drawPartyHat },
  { id: 'note',       name: 'Music Note', plural: 'Music Notes', base: '#F4B83A', light: '#FFDF8A', dark: '#A8730B', draw: drawMusicNote },
  { id: 'headphones', name: 'Headphones', plural: 'Headphones',  base: '#8C7BEF', light: '#C4B9FF', dark: '#5240B8', draw: drawHeadphones },
  { id: 'glowstick',  name: 'Glow Stick', plural: 'Glow Sticks', base: '#7CC243', light: '#D8FFB0', dark: '#3F7A18', draw: drawGlowStick },
];

function drawMixtapeItem(ctx) {
  // a turquoise mixtape with a pink label
  ctx.fillStyle = '#3AAFA9';
  rr(ctx, 20, 30, 60, 40, 5); ctx.fill();
  ctx.fillStyle = '#FFA3CF';
  rr(ctx, 25, 34, 50, 18, 3); ctx.fill();
  ctx.fillStyle = '#5A5268';
  ctx.font = '700 8px Fredoka, ui-rounded, sans-serif';
  ctx.fillText('WRAP', 39, 46);
  ctx.fillStyle = '#1D3B3A';
  rr(ctx, 33, 55, 34, 11, 5); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  [41, 59].forEach(x => { ctx.beginPath(); ctx.arc(x, 60.5, 3.6, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#2a807b';
  ctx.beginPath(); ctx.moveTo(30, 70); ctx.lineTo(34, 64); ctx.lineTo(66, 64); ctx.lineTo(70, 70); ctx.closePath(); ctx.fill();
}

/* ----- Worlds -----
   World 1 · City Streets      (1–30):    the road into town, salon tiles.
   World 2 · The Studio Set    (31–60):   backstage, film-set tiles.
   World 3 · The Crafty Table  (61–90):   crew food, cascades.
   World 4 · On Location       (91–120):  desert & beach shoots, golden hour.
   World 5 · The Wrap Party    (121–150): neon lights, music, the dance floor.
   World 6 · Cinematic Credits (151–180): the red carpet, award tiles, the finale. */
const WORLDS = [
  null,
  { n: 1, name: 'City Streets', tiles: SALON_TILES,
    blurb: '' },
  { n: 2, name: 'The Studio Set', tiles: STAGE_TILES,
    blurb: "You made it onto the set, {name}! Time to work with the stars — here's your new kit:" },
  { n: 3, name: 'The Crafty Table', tiles: CRAFT_TILES,
    blurb: "Break time, {name}! The crafty table is loaded — chain those cascades and keep the crew fed:" },
  { n: 4, name: 'On Location', tiles: LOCATION_TILES,
    blurb: "Pack the van, {name} — we're shooting out on location! Sun, sand and long days. Here's what's in the kit:" },
  { n: 5, name: 'The Wrap Party', tiles: PARTY_TILES,
    blurb: "That's a wrap, {name}! The cameras are off and the music is on — time to celebrate with the crew:" },
  { n: 6, name: 'Cinematic Credits', tiles: AWARD_TILES,
    blurb: "From the chair to the spotlight, {name}. Tonight the industry says thank you — dress for the carpet:" },
];
const WORLD_NAMES = [null, 'City Streets', 'The Studio Set', 'The Crafty Table', 'On Location', 'The Wrap Party', 'Cinematic Credits'];
const worldOf = level => (level > 150 ? 6 : level > 120 ? 5 : level > 90 ? 4 : level > 60 ? 3 : level > 30 ? 2 : 1);

/* Every world has three 10-level acts; the last level of each act is a boss board. */
const ACT_NAMES = ['Introduction', 'Obstacles', 'Master Board'];
const actOf = level => Math.floor(((level - 1) % 30) / 10) + 1;
const isBoss = level => level % 10 === 0;
const tilesFor = level => WORLDS[worldOf(level)].tiles;

// The tiles currently in play (swapped in place when the world changes).
const TILE_TYPES = SALON_TILES.slice();

const World = {
  current: 1,
  apply(w) {
    document.body.dataset.world = String(w);
    if (w === this.current) return;
    this.current = w;
    if (typeof Music !== 'undefined') Music.play(songFor(w, document.body.dataset.screen));
    TILE_TYPES.length = 0;
    WORLDS[w].tiles.forEach(t => TILE_TYPES.push(t));
    Render.sprites = [];                       // rebuild tile pictures
    if (typeof UI !== 'undefined' && UI.icons) { UI.buildIcons(); UI.refreshHero(); }
    Pip.refresh();
    const tp = document.getElementById('titlePip');
    if (tp) tp.src = Pip.url(w, 'happy');
    Render.layout();
  },
};

const BOMB = -2;   // kind used by the Glam Ball (never matches by color)
const DROP = -3;   // kind used by ingredient drops (never matches, can't be blasted)

/* Ingredient drops: a cream token with each world's item on it. */
function drawCoffeeItem(ctx) {
  // takeaway coffee cup
  ctx.fillStyle = '#6B3E26';
  ctx.beginPath(); ctx.moveTo(33, 34); ctx.lineTo(67, 34); ctx.lineTo(62, 78); ctx.lineTo(38, 78); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3AAFA9';                                  // her turquoise sleeve
  ctx.beginPath(); ctx.moveTo(35.5, 48); ctx.lineTo(64.5, 48); ctx.lineTo(63, 62); ctx.lineTo(37, 62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(50, 55, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F2EDE6';                                  // lid
  rr(ctx, 29, 26, 42, 9, 4); ctx.fill();
  rr(ctx, 36, 21, 28, 7, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(44, 16); ctx.quadraticCurveTo(40, 11, 44, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(54, 16); ctx.quadraticCurveTo(50, 11, 54, 6); ctx.stroke();
}

function drawScriptItem(ctx) {
  // stack of script pages with brass fasteners and a turquoise cover
  ctx.save();
  ctx.translate(50, 52); ctx.rotate(-0.12); ctx.translate(-50, -52);
  ctx.fillStyle = '#E9E2D4'; rr(ctx, 30, 24, 40, 54, 3); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rr(ctx, 27, 21, 40, 54, 3); ctx.fill();
  ctx.fillStyle = '#3AAFA9'; rr(ctx, 27, 21, 9, 54, 3); ctx.fill();
  ctx.fillStyle = '#F4B83A';
  [30, 48, 66].forEach(y => { ctx.beginPath(); ctx.arc(31.5, y, 2.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#5A5268';
  ctx.font = '700 7px Fredoka, ui-rounded, sans-serif';
  ctx.fillText('SCENE', 41, 32);
  ctx.fillStyle = '#B9B2C4';
  [40, 46, 52, 58, 64].forEach((y, i) => ctx.fillRect(41, y, i % 2 ? 16 : 22, 2.4));
  ctx.restore();
}

function drawCakeItem(ctx) {
  // a slice of layer cake with a cherry on top
  ctx.fillStyle = '#FFF4E4';                                   // plate
  ctx.beginPath(); ctx.ellipse(50, 74, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E9A86A';                                   // sponge side
  ctx.beginPath(); ctx.moveTo(24, 46); ctx.lineTo(70, 34); ctx.lineTo(76, 42); ctx.lineTo(76, 70); ctx.lineTo(24, 72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3AAFA9';                                   // turquoise filling layers
  ctx.fillRect(24, 54, 52, 4); ctx.fillRect(24, 63, 52, 3.5);
  ctx.fillStyle = '#FFA3CF';                                   // frosting top
  ctx.beginPath(); ctx.moveTo(22, 46); ctx.lineTo(70, 32); ctx.lineTo(78, 41); ctx.lineTo(30, 50); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FFA3CF';
  [[30, 50], [42, 47], [54, 45], [66, 43]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI); ctx.fill(); });
  ctx.fillStyle = '#FF3B5C';                                   // cherry
  ctx.beginPath(); ctx.arc(50, 34, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4A8420'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(51, 28); ctx.quadraticCurveTo(53, 20, 59, 18); ctx.stroke();
}

const DROP_ITEMS = {
  1: { name: 'coffee', plural: 'coffees', run: 'Coffee run', draw: drawCoffeeItem },
  2: { name: 'script', plural: 'scripts', run: 'Script run', draw: drawScriptItem },
  3: { name: 'cake slice', plural: 'cake slices', run: 'Dessert run', draw: drawCakeItem },
  4: { name: 'water bottle', plural: 'water bottles', run: 'Water run', draw: drawWaterItem },
  5: { name: 'mixtape', plural: 'mixtapes', run: 'Mixtape run', draw: drawMixtapeItem },
};
const dropItem = w => DROP_ITEMS[w] || DROP_ITEMS[1];

function buildDropSprite(px, world = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(50, 54, 42, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(42, 36, 6, 50, 50, 44);
  g.addColorStop(0, '#FFFDF6'); g.addColorStop(0.7, '#F6E7CF'); g.addColorStop(1, '#D9BE96');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(50, 50, 42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#F4B83A'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(50, 50, 41, 0, Math.PI * 2); ctx.stroke();
  dropItem(world).draw(ctx);
  return c;
}

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
    help: { howTo: false, seen: {}, carriedOver: false, world: 1 },
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
    // Replace this device's progress with a loaded backup (file or code).
    importData(obj) {
      if (!obj || typeof obj !== 'object' || typeof obj.v !== 'number' || !obj.progress) return false;
      data = migrate(obj);
      data.help.carriedOver = true;          // never re-apply the ?beat link on top
      write();
      return true;
    },
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
  // World 2 · "Backstage Swing" — walking bass, brushes and vibes.
  studio: { bpm: 126, style: 'swing', bars: [
    { chord: ['G2', 'Bb3', 'D4', 'F4'], mel: ['D5', '-', 'F5', '-', 'A5', 'G5', 'F5', '-'] },
    { chord: ['C3', 'Bb3', 'E4', 'G4'], mel: ['E5', '-', 'G5', '-', 'Bb5', '-', 'A5', '-'] },
    { chord: ['F2', 'A3', 'C4', 'E4'],  mel: ['A5', '-', '-', 'G5', 'F5', '-', 'C5', '-'] },
    { chord: ['D3', 'C4', 'F#4', 'A4'], mel: ['F#5', '-', 'A5', '-', 'C6', '-', '-', '-'] },
    { chord: ['G2', 'Bb3', 'D4', 'F4'], mel: ['Bb5', '-', 'A5', '-', 'G5', '-', 'D5', '-'] },
    { chord: ['C3', 'Bb3', 'E4', 'G4'], mel: ['G5', '-', 'E5', '-', 'C5', '-', 'D5', 'E5'] },
    { chord: ['F2', 'A3', 'C4', 'E4'],  mel: ['F5', '-', '-', '-', 'A5', '-', 'C6', '-'] },
    { chord: ['C3', 'Bb3', 'E4', 'G4'], mel: ['Bb5', '-', 'G5', '-', 'E5', '-', '-', '-'] },
  ] },
  // World 3 · "Snack Break" — bouncy ukulele strums and a little shaker.
  craft: { bpm: 124, style: 'bounce', bars: [
    { chord: ['C3', 'C4', 'E4', 'G4'],  mel: ['E5', 'G5', '-', 'E5', 'C5', '-', 'D5', 'E5'] },
    { chord: ['F2', 'C4', 'F4', 'A4'],  mel: ['F5', '-', 'A5', '-', 'G5', 'F5', 'E5', '-'] },
    { chord: ['G2', 'B3', 'D4', 'G4'],  mel: ['D5', '-', 'G5', '-', 'B5', '-', 'A5', 'G5'] },
    { chord: ['C3', 'C4', 'E4', 'G4'],  mel: ['E5', '-', 'C5', '-', '-', '-', 'G4', '-'] },
    { chord: ['A2', 'C4', 'E4', 'A4'],  mel: ['A5', '-', 'G5', 'E5', 'C5', '-', 'E5', '-'] },
    { chord: ['F2', 'C4', 'F4', 'A4'],  mel: ['F5', '-', 'E5', 'D5', 'C5', '-', 'A4', '-'] },
    { chord: ['D3', 'C4', 'F#4', 'A4'], mel: ['F#5', '-', 'A5', '-', 'D6', '-', 'C6', '-'] },
    { chord: ['G2', 'B3', 'D4', 'F4'],  mel: ['B5', '-', 'G5', '-', 'F5', '-', 'D5', '-'] },
  ] },
  // World 4 · "Golden Hour" — boom-chick guitar and a whistled tune out west.
  location: { bpm: 98, style: 'western', bars: [
    { chord: ['A2', 'A3', 'C4', 'E4'],  mel: ['E5', '-', '-', '-', 'A5', '-', 'G5', 'E5'] },
    { chord: ['G2', 'G3', 'B3', 'D4'],  mel: ['D5', '-', '-', '-', 'B4', '-', '-', '-'] },
    { chord: ['F2', 'F3', 'A3', 'C4'],  mel: ['C5', '-', 'D5', '-', 'E5', '-', 'F5', '-'] },
    { chord: ['E2', 'E3', 'G#3', 'B3'], mel: ['E5', '-', '-', '-', '-', '-', '-', '-'] },
    { chord: ['A2', 'A3', 'C4', 'E4'],  mel: ['A5', '-', '-', 'G5', 'E5', '-', 'D5', 'C5'] },
    { chord: ['C3', 'G3', 'C4', 'E4'],  mel: ['E5', '-', 'G5', '-', 'C6', '-', '-', '-'] },
    { chord: ['D3', 'F3', 'A3', 'D4'],  mel: ['A5', '-', 'F5', '-', 'D5', '-', 'E5', 'F5'] },
    { chord: ['E2', 'E3', 'G#3', 'B3'], mel: ['G#5', '-', '-', '-', 'B5', '-', '-', '-'] },
  ] },
  // World 5 · "Dance Floor" — four-on-the-floor disco.
  party: { bpm: 118, style: 'disco', bars: [
    { chord: ['D2', 'D4', 'F4', 'A4'],   mel: ['A5', '-', 'A5', '-', 'C6', '-', 'A5', 'G5'] },
    { chord: ['Bb1', 'D4', 'F4', 'Bb4'], mel: ['F5', '-', '-', '-', 'D5', '-', 'F5', '-'] },
    { chord: ['C2', 'C4', 'E4', 'G4'],   mel: ['G5', '-', 'G5', '-', 'A5', '-', 'G5', 'E5'] },
    { chord: ['A1', 'C#4', 'E4', 'A4'],  mel: ['E5', '-', '-', '-', 'C#5', '-', '-', '-'] },
    { chord: ['D2', 'D4', 'F4', 'A4'],   mel: ['D6', '-', 'C6', '-', 'A5', '-', 'F5', '-'] },
    { chord: ['G1', 'D4', 'G4', 'Bb4'],  mel: ['G5', '-', 'Bb5', '-', 'D6', '-', 'Bb5', '-'] },
    { chord: ['Bb1', 'D4', 'F4', 'Bb4'], mel: ['A5', '-', 'F5', '-', 'D5', '-', 'F5', 'G5'] },
    { chord: ['A1', 'C#4', 'E4', 'A4'],  mel: ['A5', '-', '-', '-', 'E5', '-', 'C#5', '-'] },
  ] },
  // World 6 · "Her Big Night" — a slow, grand theme for the red carpet.
  credits: { bpm: 76, style: 'anthem', bars: [
    { chord: ['Eb2', 'G3', 'Bb3', 'Eb4'], mel: ['Bb5', '-', '-', '-', 'G5', '-', 'Bb5', '-'] },
    { chord: ['C2', 'G3', 'C4', 'Eb4'],   mel: ['C6', '-', '-', '-', 'Eb6', '-', 'D6', '-'] },
    { chord: ['Ab1', 'Ab3', 'C4', 'Eb4'], mel: ['C6', '-', 'Bb5', '-', 'Ab5', '-', '-', '-'] },
    { chord: ['Bb1', 'F3', 'Bb3', 'D4'],  mel: ['Bb5', '-', '-', '-', 'F5', '-', '-', '-'] },
    { chord: ['Eb2', 'G3', 'Bb3', 'Eb4'], mel: ['G5', '-', 'Bb5', '-', 'Eb6', '-', '-', '-'] },
    { chord: ['G2', 'G3', 'Bb3', 'D4'],   mel: ['D6', '-', 'C6', '-', 'Bb5', '-', 'G5', '-'] },
    { chord: ['Ab1', 'Ab3', 'C4', 'Eb4'], mel: ['Ab5', '-', 'C6', '-', 'Eb6', '-', 'F6', '-'] },
    { chord: ['Bb1', 'F3', 'Bb3', 'D4'],  mel: ['G6', '-', 'F6', '-', 'D6', '-', 'Bb5', '-'] },
  ] },
};

// Which tune plays in each world. World 1 keeps its march on the title/map and the dreamy loop in play.
const WORLD_SONGS = { 1: { map: 'road', game: 'emerald' }, 2: 'studio', 3: 'craft', 4: 'location', 5: 'party', 6: 'credits' };
function songFor(world, screen) {
  const s = WORLD_SONGS[world] || WORLD_SONGS[1];
  return typeof s === 'string' ? s : (screen === 'game' ? s.game : s.map);
}

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
    if (song.style === 'swing') {
      const sw = s % 2 ? eighth * 0.32 : 0;                          // swung eighths
      const t = at + sw;
      if (s % 2 === 0) {                                           // walking bass
        const walk = [ch[0], ch[1] / 2, ch[2] / 2, ch[3] / 2][s / 2];
        S.tone(walk, t, eighth * 1.7, { type: 'triangle', vol: 0.2, bus });
        S.noiseHit(t, 0.05, { filter: 'highpass', freq: 8000, vol: 0.018, bus });   // ride
      }
      if (s === 2 || s === 6) S.noiseHit(t, 0.12, { filter: 'bandpass', freq: 2600, q: 0.6, vol: 0.035, bus });  // brushes
      if (s === 3 || s === 7) ch.slice(1).forEach(f => S.pluck(f, t, 0.035, eighth * 1.2, bus));
      if (mel !== '-') S.bell(noteFreq(mel), t, 0.06, eighth * 3.5, bus);
    } else if (song.style === 'bounce') {
      if (s === 0 || s === 4) S.tone(s === 0 ? ch[0] : ch[0] * 1.5, at, eighth * 1.5, { type: 'triangle', vol: 0.2, bus });
      const strum = [1, 0, 1, 1, 0, 1, 1, 0][s];
      if (strum) ch.slice(1).forEach((f, j) => S.pluck(f, at + j * 0.012, s % 2 ? 0.03 : 0.04, eighth * 1.1, bus));
      S.noiseHit(at, 0.03, { filter: 'highpass', freq: 6000, vol: s % 2 ? 0.02 : 0.012, bus });   // shaker
      if (mel !== '-') S.tone(noteFreq(mel), at, eighth * 1.6, { type: 'triangle', vol: 0.07, bus, lowpass: 4000 });
    } else if (song.style === 'western') {
      if (s === 0) S.tone(ch[0], at, eighth * 1.8, { type: 'triangle', vol: 0.22, bus });
      if (s === 4) S.tone(ch[0] * 1.5, at, eighth * 1.8, { type: 'triangle', vol: 0.18, bus });
      if (s === 2 || s === 6) ch.slice(1).forEach((f, j) => S.pluck(f, at + j * 0.02, 0.04, eighth * 1.3, bus));
      if (s === 0 || s === 3 || s === 4 || s === 7) S.noiseHit(at, 0.06, { filter: 'lowpass', freq: 900, vol: 0.03, bus });  // clip-clop
      if (mel !== '-') S.tone(noteFreq(mel), at, eighth * 3, { vol: 0.06, attack: 0.04, bus });          // whistle
    } else if (song.style === 'disco') {
      if (s % 2 === 0) S.tone(120, at, 0.22, { vol: 0.28, glide: 45, bus });                                // kick
      else S.noiseHit(at, 0.12, { filter: 'highpass', freq: 7000, vol: 0.03, bus });                       // open hat
      if (s === 2 || s === 6) S.noiseHit(at, 0.14, { filter: 'bandpass', freq: 1800, q: 0.8, vol: 0.06, bus }); // clap
      S.tone(s % 2 ? ch[0] * 2 : ch[0], at, eighth * 0.9, { type: 'square', vol: 0.06, lowpass: 900, bus }); // octave bass
      if (s === 3 || s === 7) ch.slice(1).forEach(f => S.tone(f, at, eighth * 0.8, { type: 'sawtooth', vol: 0.018, lowpass: 2200, bus }));
      if (mel !== '-') S.bell(noteFreq(mel), at, 0.065, eighth * 3, bus);
    } else if (song.style === 'anthem') {
      if (s === 0) {
        S.tone(ch[0], at, eighth * 8, { vol: 0.18, attack: 0.08, bus });
        S.noiseHit(at, 0.5, { filter: 'lowpass', freq: 220, vol: 0.09, bus });                            // soft timpani
        ch.slice(1).forEach(f => {
          S.tone(f, at, eighth * 8.5, { type: 'sawtooth', vol: 0.012, attack: 0.5, lowpass: 1400, bus });  // strings
          S.tone(f * 2, at, eighth * 8.5, { type: 'triangle', vol: 0.02, attack: 0.5, bus });
        });
      }
      const arp = ch.slice(1);
      S.pluck(arp[[0, 1, 2, 1, 0, 1, 2, 1][s]] * 2, at, 0.025, eighth * 1.8, bus);                        // harp
      if (mel !== '-') {
        S.tone(noteFreq(mel), at, eighth * 3.5, { type: 'triangle', vol: 0.07, attack: 0.06, bus });       // horn-ish lead
        S.bell(noteFreq(mel), at, 0.035, eighth * 3, bus);
      }
    } else if (song.style === 'march') {
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

/* ---------- 4e. PIP — her guide ----------
   A little mannequin head who travels with her. The hairstyle changes
   in every world; the face changes with the mood.
   moods: happy, blink, wow, oops, think, wink, cheer */
const Pip = {
  _cache: {},
  // Skin tones she can choose from: [highlight, shade]
  TONES: [
    ['#FCE9DC', '#E9C3AA'],
    ['#F4D2B6', '#DCA985'],
    ['#E2AE85', '#C4885E'],
    ['#C68C5F', '#A46B42'],
    ['#9A6443', '#7B4B2F'],
    ['#6B412C', '#4E2D1D'],
  ],
  tone() {
    const t = Save.data && Save.data.settings && Save.data.settings.pipTone;
    return typeof t === 'number' && this.TONES[t] ? t : 2;
  },
  setTone(i) {
    Save.data.settings.pipTone = i;
    Save.write();
    this.refresh();
    const tp = document.getElementById('titlePip');
    if (tp) tp.src = this.url(World.current, 'happy');
  },

  // Draw Pip into a 100 × 120 box.
  draw(ctx, world, mood, toneIdx = this.tone()) {
    const [skinTop, skinBot] = this.TONES[toneIdx] || this.TONES[2];
    const HAIR = {
      1: '#3B2416', 2: '#7A3B1F', 3: '#A4652F', 4: '#2A1A10', 5: '#4B2E6E', 6: '#E5BE6E',
    };
    const hair = HAIR[world] || HAIR[1];
    const skinG = ctx.createLinearGradient(0, 26, 0, 90);
    skinG.addColorStop(0, skinTop); skinG.addColorStop(1, skinBot);
    const circle = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

    // ---- stand
    ctx.fillStyle = skinBot;
    rr(ctx, 42, 80, 16, 22, 4); ctx.fill();
    const baseG = ctx.createLinearGradient(0, 100, 0, 116);
    baseG.addColorStop(0, '#3AAFA9'); baseG.addColorStop(1, '#1D7470');
    ctx.fillStyle = baseG;
    ctx.beginPath(); ctx.ellipse(50, 108, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(46, 105, 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // ---- hair behind the head
    if (world === 4) {                                   // braids
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) circle(50 + side * 26, 62 + i * 9, 6.5 - i * 0.5, hair);
        circle(50 + side * 26, 106, 3.5, '#EC5FA5');
      }
    }
    if (world === 2) {                                   // big curls
      [[24, 44], [20, 58], [24, 72], [76, 44], [80, 58], [76, 72], [32, 30], [68, 30], [50, 24], [38, 24], [62, 24]]
        .forEach(([x, y]) => circle(x, y, 11, hair));
    }
    if (world === 6) {                                   // long red-carpet waves
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(22, 46);
      ctx.bezierCurveTo(14, 70, 26, 80, 18, 96);
      ctx.bezierCurveTo(30, 100, 34, 88, 32, 78);
      ctx.lineTo(68, 78);
      ctx.bezierCurveTo(66, 88, 70, 100, 82, 96);
      ctx.bezierCurveTo(74, 80, 86, 70, 78, 46);
      ctx.closePath(); ctx.fill();
    }

    // ---- head
    ctx.fillStyle = skinG;
    ctx.beginPath(); ctx.ellipse(50, 56, 25, 28, 0, 0, Math.PI * 2); ctx.fill();

    // ---- hair on top
    ctx.fillStyle = hair;
    if (world === 1) {                                   // top-knot bun
      ctx.beginPath(); ctx.ellipse(50, 42, 26, 17, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(24, 44); ctx.quadraticCurveTo(36, 34, 50, 40); ctx.quadraticCurveTo(64, 34, 76, 44); ctx.lineTo(76, 40); ctx.lineTo(24, 40); ctx.fill();
      circle(50, 18, 13, hair);
      ctx.fillStyle = '#3AAFA9'; rr(ctx, 38, 27, 24, 6, 3); ctx.fill();          // scrunchie
      ctx.fillStyle = '#8BE6DF'; rr(ctx, 42, 28, 6, 3, 1.5); ctx.fill();
    } else if (world === 2) {
      ctx.beginPath(); ctx.ellipse(50, 40, 27, 15, 0, Math.PI, 0); ctx.fill();
      [[30, 36], [42, 31], [58, 31], [70, 36]].forEach(([x, y]) => circle(x, y, 8, hair));
      // crew headset
      ctx.strokeStyle = '#2A2A33'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(50, 50, 30, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      circle(22, 58, 6, '#2A2A33');
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(23, 62); ctx.quadraticCurveTo(26, 74, 38, 74); ctx.stroke();
      circle(39, 74, 2.6, '#EC5FA5');
    } else if (world === 3) {                            // beehive updo
      ctx.beginPath(); ctx.ellipse(50, 22, 22, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(50, 42, 26, 14, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#EC5FA5'; rr(ctx, 25, 37, 50, 6, 3); ctx.fill();          // headband
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(50, 22, 14, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    } else if (world === 4) {                            // braids + sun hat
      ctx.beginPath(); ctx.ellipse(50, 42, 26, 14, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#E8C77E';
      ctx.beginPath(); ctx.ellipse(50, 34, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(50, 26, 20, 14, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3AAFA9'; ctx.fillRect(30, 28, 40, 5);
      ctx.strokeStyle = 'rgba(122,82,8,.35)'; ctx.lineWidth = 1.2;
      for (let x = 16; x <= 84; x += 8) { ctx.beginPath(); ctx.moveTo(x, 31); ctx.lineTo(x + 3, 38); ctx.stroke(); }
    } else if (world === 5) {                            // sleek bob + neon streaks + heart shades
      ctx.beginPath();
      ctx.moveTo(22, 70); ctx.bezierCurveTo(16, 30, 84, 30, 78, 70);
      ctx.lineTo(72, 70); ctx.bezierCurveTo(74, 46, 60, 40, 50, 40); ctx.bezierCurveTo(40, 40, 26, 46, 28, 70);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.strokeStyle = '#FF5FB0'; ctx.beginPath(); ctx.moveTo(32, 38); ctx.quadraticCurveTo(24, 52, 26, 66); ctx.stroke();
      ctx.strokeStyle = '#3EF2E3'; ctx.beginPath(); ctx.moveTo(66, 36); ctx.quadraticCurveTo(76, 50, 74, 66); ctx.stroke();
      const heart = (x, y, col) => {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x, y + 5);
        ctx.bezierCurveTo(x - 9, y - 1, x - 5, y - 8, x, y - 3);
        ctx.bezierCurveTo(x + 5, y - 8, x + 9, y - 1, x, y + 5); ctx.fill();
      };
      heart(40, 34, '#FF5FB0'); heart(60, 34, '#FF5FB0');
      ctx.strokeStyle = '#FF5FB0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(45, 32); ctx.lineTo(55, 32); ctx.stroke();
    } else if (world === 6) {                            // glam side-part wave + emerald clip
      ctx.beginPath();
      ctx.moveTo(24, 50); ctx.bezierCurveTo(22, 26, 70, 22, 78, 44);
      ctx.bezierCurveTo(66, 36, 54, 40, 46, 34); ctx.bezierCurveTo(40, 40, 30, 42, 24, 50);
      ctx.fill();
      ctx.fillStyle = '#F4B83A'; rr(ctx, 60, 33, 12, 5, 2.5); ctx.fill();
      circle(66, 35.5, 3, '#2ECC71');
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(34, 34); ctx.quadraticCurveTo(46, 28, 58, 32); ctx.stroke();
    }

    // ---- face
    const eyeY = 58, ink = toneIdx >= 4 ? '#1A0D12' : '#3A2230';
    const openEye = (x, big) => {
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(x, eyeY, big ? 4.6 : 3.6, big ? 5.4 : 4.4, 0, 0, Math.PI * 2); ctx.fill();
      circle(x + 1.3, eyeY - 1.6, big ? 1.8 : 1.3, '#FFFFFF');
    };
    const arcEye = x => {                                 // happy ^ eye
      ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, eyeY + 2, 4.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    };
    const lineEye = x => {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 4, eyeY); ctx.lineTo(x + 4, eyeY); ctx.stroke();
    };
    if (mood === 'blink') { lineEye(41); lineEye(59); }
    else if (mood === 'cheer' || mood === 'happy') { arcEye(41); arcEye(59); }
    else if (mood === 'wink') { openEye(41); arcEye(59); }
    else if (mood === 'wow') { openEye(41, true); openEye(59, true); }
    else if (mood === 'think') {
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.ellipse(42, eyeY - 1.5, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(60, eyeY - 1.5, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      circle(43.5, eyeY - 4, 1.2, '#FFFFFF'); circle(61.5, eyeY - 4, 1.2, '#FFFFFF');
    } else { openEye(41); openEye(59); }

    // brows for oops / think
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    if (mood === 'oops') {                               // worried: inner ends up
      ctx.beginPath(); ctx.moveTo(36, 51); ctx.lineTo(45, 48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(64, 51); ctx.lineTo(55, 48); ctx.stroke();
    } else if (mood === 'think') {
      ctx.beginPath(); ctx.moveTo(36, 49); ctx.lineTo(45, 48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(55, 47); ctx.lineTo(64, 50); ctx.stroke();
    }

    // blush
    ctx.fillStyle = toneIdx >= 4 ? 'rgba(236,95,165,.45)' : 'rgba(236,95,165,.32)';
    ctx.beginPath(); ctx.ellipse(34, 67, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(66, 67, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

    // mouth
    ctx.strokeStyle = ink; ctx.fillStyle = '#C2416F'; ctx.lineWidth = 2.4;
    if (mood === 'wow') {
      ctx.beginPath(); ctx.ellipse(50, 72, 4, 5, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    } else if (mood === 'cheer') {
      ctx.beginPath(); ctx.moveTo(42, 68); ctx.quadraticCurveTo(50, 82, 58, 68); ctx.closePath();
      ctx.fillStyle = '#C2416F'; ctx.fill(); ctx.stroke();
    } else if (mood === 'oops') {
      ctx.beginPath(); ctx.moveTo(44, 74); ctx.quadraticCurveTo(50, 69, 56, 74); ctx.stroke();
    } else if (mood === 'think') {
      ctx.beginPath(); ctx.moveTo(45, 72); ctx.lineTo(55, 71); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(43, 69); ctx.quadraticCurveTo(50, 76, 57, 69); ctx.stroke();
    }
  },

  url(world, mood, px = 120, tone = this.tone()) {
    const key = world + ':' + mood + ':' + px + ':' + tone;
    if (!this._cache[key]) {
      const c = document.createElement('canvas');
      c.width = px; c.height = Math.round(px * 1.2);
      const ctx = c.getContext('2d');
      ctx.scale(px / 100, px / 100);
      this.draw(ctx, world, mood, tone);
      this._cache[key] = c.toDataURL();
    }
    return this._cache[key];
  },

  img(mood = 'happy', cls = '', world = World.current) {
    return `<img class="pip ${cls}" src="${this.url(world, mood)}" alt="Pip">`;
  },

  /* ---- the Pip that stands next to the board ---- */
  el: null,
  _moodTimer: 0,
  _blinkTimer: 0,
  mood: 'happy',
  mount() {
    const frame = document.querySelector('.board-frame');
    if (!frame || this.el) return;
    this.el = document.createElement('img');
    this.el.className = 'pip pip-board';
    this.el.alt = 'Pip';
    frame.appendChild(this.el);
    this.set('happy');
    const blink = () => {
      this._blinkTimer = setTimeout(() => {
        if (this.mood === 'happy') {
          this.el.src = this.url(World.current, 'blink');
          setTimeout(() => { if (this.mood === 'happy') this.el.src = this.url(World.current, 'happy'); }, 140);
        }
        blink();
      }, 2600 + Math.random() * 2600);
    };
    blink();
  },
  set(mood, holdMs = 0) {
    if (!this.el) return;
    this.mood = mood;
    this.el.src = this.url(World.current, mood);
    clearTimeout(this._moodTimer);
    if (holdMs) this._moodTimer = setTimeout(() => this.set('happy'), holdMs);
  },
  react(mood, holdMs = 2000, jump = true) {
    this.set(mood, holdMs);
    if (jump && this.el) {
      this.el.classList.remove('pip-jump');
      void this.el.offsetWidth;
      this.el.classList.add('pip-jump');
    }
  },
  refresh() { if (this.el) this.set(this.mood); },
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
    Array.from({ length: cols }, () => ({ gel: 0, box: 0, lock: null, drop: false })));
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
  dropsOnBoard() { let n = 0; this.forEachTile(t => { if (t.drop) n++; }); return n; },
  makeDrop(r, c) { const t = makeTile(DROP, r, c); t.drop = true; return t; },
  randomKind() { return Math.floor(Math.random() * this.kinds); },

  // Build the board for a level: blockers from the layout, tiles everywhere else.
  setup(spec, kinds) {
    this.kinds = kinds;
    spec = spec || blankSpec(this.rows, this.cols);
    this.cells = spec.map(row => row.map(s => ({ gel: s.gel, box: s.box, shake: 0 })));
    const isDrop = (r, c) => spec[r] && spec[r][c] && spec[r][c].drop;
    this.grid = spec.map(row => row.map(() => null));

    // No starting matches, and at least one move.
    for (let attempt = 0; attempt < 300; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.cells[r][c].box) { this.grid[r][c] = null; continue; }
          if (isDrop(r, c)) { this.grid[r][c] = this.makeDrop(r, c); continue; }
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
      if (!t1.drop && !t2.drop && (t1.special === 'bomb' || t2.special === 'bomb' || (t1.special && t2.special))) {
        moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });   // special combos always work
        return;
      }
      const a = k[r1][c1], b = k[r2][c2];
      if (r2 === r1 + 1 && t1.drop && !t2.drop) { moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } }); return; }
      if ((a < 0 && b < 0) || a === b) return;          // a drop can swap if the other tile makes a match
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
  /* 6 */ { moves: 20, kinds: 4, goals: [], drops: 2, dropsMax: 1, tip: 'Coffee run! Swipe the coffee down or clear the tiles under it.', layout: [
    '........',
    '........',
    '...d....',
    '........',
    '........',
    '........',
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
  /* 10 */ { moves: 24, kinds: 5, goals: [], drops: 3, dropsMax: 2, tip: 'Act 1 boss board — show the city what you’ve got!', layout: [
    '........',
    '........',
    '.d....d.',
    '..jjjj..',
    '..jjjj..',
    '........',
    '........',
    '........'] },
  /* 11 */ { moves: 21, kinds: 5, goals: [], tip: 'Pink gel takes two hits!', layout: [
    '........',
    '........',
    '..JJJJ..',
    '..JJJJ..',
    '..JJJJ..',
    '..JJJJ..',
    '........',
    '........'] },
  /* 12 */ { moves: 22, kinds: 5, goals: [], tip: 'Match frozen tiles to crack the ice.', layout: [
    '........',
    '.i....i.',
    '........',
    '...ii...',
    '...ii...',
    '........',
    '.i....i.',
    '........'] },
  /* 13 */ { moves: 22, kinds: 5, goals: [], tip: "Chained tiles can't move. Match them to break free!", layout: [
    '........',
    '........',
    '.hh..hh.',
    '........',
    '........',
    '.hh..hh.',
    '........',
    '........'] },
  /* 14 */ { moves: 22, kinds: 5, goals: [], tip: 'Darker boxes take more hits.', layout: [
    '........',
    '........',
    '..BBBB..',
    '........',
    '........',
    '..BBBB..',
    '........',
    '........'] },
  /* 15 */ { moves: 22, kinds: 5, goals: [], drops: 1, dropsMax: 1, breather: true, tip: 'Quick coffee break!', layout: [
    '........',
    '........',
    '....d...',
    'jjjjjjjj',
    '........',
    '........',
    '........',
    '........'] },
  /* 16 */ { moves: 28, kinds: 6, goals: [['collect', 'dryer', 18]], drops: 2, dropsMax: 1, tip: 'All six styles are in the salon now!', layout: [
    '........',
    '........',
    '..d.....',
    '........',
    '........',
    '........',
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
  /* 18 */ { moves: 28, kinds: 6, goals: [], drops: 2, dropsMax: 1, tip: 'Chains block the way — break them to keep the coffee moving!', layout: [
    '........',
    '........',
    '.h.d..h.',
    '.h....h.',
    '...hh...',
    '........',
    '........',
    '........'] },
  /* 19 */ { moves: 29, kinds: 6, goals: [['collect', 'spray', 18]], layout: [
    '........',
    '........',
    'b......b',
    'bb....bb',
    'bb....bb',
    'b......b',
    '........',
    '........'] },
  /* 20 */ { moves: 28, kinds: 6, goals: [], drops: 2, dropsMax: 1, tip: 'Act 2 boss board — every obstacle at once!', layout: [
    '........',
    '.b.d..b.',
    '..i..i..',
    '.h.jj.h.',
    '.h.jj.h.',
    '..i..i..',
    '.b....b.',
    '........'] },
  /* 21 */ { moves: 26, kinds: 6, goals: [], tip: 'Act 3: Master Boards — everything you’ve learned!', layout: [
    '........',
    '.jjjjjj.',
    '.J....J.',
    '.j....j.',
    '.j....j.',
    '.J....J.',
    '.jjjjjj.',
    '........'] },
  /* 22 */ { moves: 32, kinds: 6, goals: [], layout: [
    '........',
    '.I.bb.I.',
    '........',
    '.i....i.',
    '.i....i.',
    '........',
    '.I.bb.I.',
    '........'] },
  /* 23 */ { moves: 29, kinds: 6, goals: [], drops: 2, dropsMax: 1, layout: [
    '........',
    '.jj..jj.',
    '.jhd.hj.',
    '...hh...',
    '...hh...',
    '.jh..hj.',
    '.jj..jj.',
    '........'] },
  /* 24 */ { moves: 25, kinds: 6, goals: [['collect', 'comb', 18], ['collect', 'bow', 18], ['collect', 'curler', 18]], drops: 1, dropsMax: 1, layout: [
    '........',
    '........',
    '....d...',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 25 */ { moves: 26, kinds: 5, goals: [], drops: 1, dropsMax: 1, breather: true, tip: 'Coffee break before the big finish.', layout: [
    '........',
    '........',
    '...bbd..',
    '.j....j.',
    '.j....j.',
    '...ii...',
    '........',
    '........'] },
  /* 26 */ { moves: 28, kinds: 6, goals: [], drops: 2, dropsMax: 1, layout: [
    '........',
    '.BX..XB.',
    '.B.d..B.',
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
  /* 29 */ { moves: 30, kinds: 6, goals: [], drops: 1, dropsMax: 1, layout: [
    '........',
    '.jj..jj.',
    '.j.bb.j.',
    '.h.ii.h.',
    '.h.ii.h.',
    '.j.bb.j.',
    '.jj..jj.',
    '........'] },
  /* 30 */ { moves: 33, kinds: 6, goals: [['collect', 'bow', 16]], drops: 2, dropsMax: 1, tip: 'World 1 finale — the whole city is watching!', layout: [
    '........',
    '.jjhhjj.',
    '.jI.dIj.',
    '.j.BB.j.',
    '.j.BB.j.',
    '.jI..Ij.',
    '.jjjjjj.',
    '........'] },
  /* 31 */ { moves: 24, kinds: 5, goals: [['collect', 'clap', 24], ['collect', 'lipstick', 24]], tip: 'Welcome backstage! New styles, same rules.' },
  /* 32 */ { moves: 26, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.j....j.',
    '.j.JJ.j.',
    '.j.JJ.j.',
    '.j....j.',
    '.jjjjjj.',
    '........'] },
  /* 33 */ { moves: 29, kinds: 6, goals: [['collect', 'wig', 16]], layout: [
    '........',
    '..i..i..',
    '........',
    '.i.ii.i.',
    '........',
    '.i....i.',
    '..i..i..',
    '........'] },
  /* 34 */ { moves: 29, kinds: 6, drops: 2, dropsMax: 1, tip: 'Script run! Get the pages to set — swipe them down.', goals: [], layout: [
    '........',
    '...d....',
    '.h.bb.h.',
    '.h.bb.h.',
    '........',
    '.h....h.',
    '........',
    '........'] },
  /* 35 */ { moves: 24, kinds: 5, goals: [['score', 21000]], breather: true },
  /* 36 */ { moves: 27, kinds: 6, drops: 1, dropsMax: 1, goals: [['collect', 'mirror', 18]], layout: [
    '........',
    '...d....',
    '..JJJJ..',
    '..J..J..',
    '..J..J..',
    '..JJJJ..',
    '........',
    '........'] },
  /* 37 */ { moves: 29, kinds: 6, goals: [], tip: 'Clear the boxes to make room on stage!', layout: [
    '........',
    '.bb..bb.',
    '.bB..Bb.',
    '........',
    '........',
    '.bB..Bb.',
    '.bb..bb.',
    '........'] },
  /* 38 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'reel', 16]], layout: [
    '........',
    '.h.d..h.',
    '..h..h..',
    '...hh...',
    '...hh...',
    '..h..h..',
    '.h....h.',
    '........'] },
  /* 39 */ { moves: 27, kinds: 6, goals: [], layout: [
    '........',
    '.jj..jj.',
    '.jI..Ij.',
    '...jj...',
    '...jj...',
    '.jI..Ij.',
    '.jj..jj.',
    '........'] },
  /* 40 */ { moves: 27, kinds: 6, goals: [['collect', 'brush', 18]], drops: 2, dropsMax: 1, tip: 'Act 1 boss board — big scene, no retakes!', layout: [
    '........',
    '........',
    '...d....',
    '.jjjjjj.',
    '.jjjjjj.',
    '........',
    '........',
    '........'] },
  /* 41 */ { moves: 26, kinds: 6, goals: [], layout: [
    '........',
    '.BB..BB.',
    '........',
    '..IIII..',
    '........',
    '.BB..BB.',
    '........',
    '........'] },
  /* 42 */ { moves: 29, kinds: 6, goals: [['collect', 'lipstick', 18], ['collect', 'wig', 18]], layout: [
    '........',
    '........',
    '..h..h..',
    '.h....h.',
    '.h....h.',
    '..h..h..',
    '........',
    '........'] },
  /* 43 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '........',
    '.JJJJJJ.',
    '.Jdbb.J.',
    '.J.bb.J.',
    '.J....J.',
    '.JJJJJJ.',
    '........',
    '........'] },
  /* 44 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '..I..I..',
    '........',
    '.h.ii.h.',
    '.h....h.',
    '........',
    '..I..I..',
    '........'] },
  /* 45 */ { moves: 25, kinds: 5, drops: 1, dropsMax: 1, goals: [['score', 27000]], breather: true, layout: [
    '........',
    '...d....',
    '...bb...',
    '..b..b..',
    '..b..b..',
    '...bb...',
    '........',
    '........'] },
  /* 46 */ { moves: 29, kinds: 6, drops: 1, dropsMax: 1, goals: [['collect', 'clap', 22]], layout: [
    '........',
    '.XXd.XX.',
    '........',
    '...jj...',
    '...jj...',
    '........',
    '.XX..XX.',
    '........'] },
  /* 47 */ { moves: 32, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.jhhhhj.',
    '.j....j.',
    '.j....j.',
    '.jhhhhj.',
    '.jjjjjj.',
    '........'] },
  /* 48 */ { moves: 29, kinds: 6, goals: [['collect', 'mirror', 16], ['collect', 'reel', 16]], layout: [
    '........',
    '..i..i..',
    '........',
    '.i.II.i.',
    '.i.II.i.',
    '........',
    '..i..i..',
    '........'] },
  /* 49 */ { moves: 29, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '........',
    '.Bbd.bB.',
    '.bJ..Jb.',
    '...JJ...',
    '...JJ...',
    '.bJ..Jb.',
    '.Bb..bB.',
    '........'] },
  /* 50 */ { moves: 30, kinds: 6, goals: [['collect', 'wig', 16]], drops: 2, dropsMax: 1, tip: 'Act 2 boss board — the director is watching!', layout: [
    '........',
    '.b.d..b.',
    '.j.jj.j.',
    '.h....h.',
    '.h....h.',
    '.j.jj.j.',
    '.b....b.',
    '........'] },
  /* 51 */ { moves: 29, kinds: 6, goals: [], layout: [
    '........',
    '.H.h.hH.',
    '........',
    '..h..h..',
    '........',
    '.H.h.hH.',
    '........',
    '........'] },
  /* 52 */ { moves: 28, kinds: 6, goals: [], layout: [
    '........',
    '.JJJJJJ.',
    '.JJJJJJ.',
    '........',
    '........',
    '.JJJJJJ.',
    '.JJJJJJ.',
    '........'] },
  /* 53 */ { moves: 30, kinds: 6, drops: 1, dropsMax: 1, goals: [['collect', 'brush', 18]], layout: [
    '........',
    '.bdXX.b.',
    '.b....b.',
    '..IIII..',
    '........',
    '.b....b.',
    '.b.XX.b.',
    '........'] },
  /* 54 */ { moves: 28, kinds: 6, goals: [], layout: [
    '........',
    '.jh..hj.',
    '.hj..jh.',
    '...ii...',
    '...ii...',
    '.hj..jh.',
    '.jh..hj.',
    '........'] },
  /* 55 */ { moves: 26, kinds: 5, drops: 1, dropsMax: 1, goals: [['collect', 'lipstick', 34]], breather: true , layout: [
    '........',
    '........',
    '...d....',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 56 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '........',
    '.XX..XX.',
    '...d....',
    '.jjjjjj.',
    '.jjjjjj.',
    '........',
    '........',
    '........'] },
  /* 57 */ { moves: 34, kinds: 6, goals: [['collect', 'reel', 18], ['collect', 'clap', 18]], layout: [
    '........',
    '..ih.hi.',
    '........',
    '.H....H.',
    '..h..h..',
    '........',
    '..ih.hi.',
    '........'] },
  /* 58 */ { moves: 31, kinds: 6, drops: 1, dropsMax: 1, goals: [], layout: [
    '........',
    '.JbJJbJ.',
    '.b.d..b.',
    '.J.II.J.',
    '.J.II.J.',
    '.b....b.',
    '.JbJJbJ.',
    '........'] },
  /* 59 */ { moves: 31, kinds: 6, goals: [['collect', 'mirror', 16], ['collect', 'wig', 16]], layout: [
    '........',
    '..h..h..',
    '.H....H.',
    '..jjjj..',
    '..jjjj..',
    '.H....H.',
    '..h..h..',
    '........'] },
  /* 60 */ { moves: 39, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'lipstick', 16]], tip: 'Opening night — the big finale!', layout: [
    '...d....',
    '.jjhhjj.',
    '.jI..Ij.',
    '.j.XX.j.',
    '.j.XX.j.',
    '.ji..ij.',
    '.jjhhjj.',
    '........'] },
  /* ===== WORLD 3 · THE CRAFTY TABLE (levels 61–90) ===== */
  /* 61 */ { moves: 24, kinds: 5, goals: [['collect', 'donut', 24], ['collect', 'cupcake', 24]], tip: 'Break time! Big combos set off cascades — keep the crew fed.' },
  /* 62 */ { moves: 27, kinds: 6, goals: [], layout: [
    '........',
    '........',
    '..jjjj..',
    '.j....j.',
    '.j....j.',
    '..jjjj..',
    '........',
    '........'] },
  /* 63 */ { moves: 29, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'taco', 16]], tip: 'Dessert run! Slide the cake down to the crew.', layout: [
    '...d....',
    '........',
    '........',
    '..j..j..',
    '..j..j..',
    '........',
    '........',
    '........'] },
  /* 64 */ { moves: 30, kinds: 6, goals: [['collect', 'burger', 18]], layout: [
    '........',
    '........',
    '...ii...',
    '..i..i..',
    '..i..i..',
    '...ii...',
    '........',
    '........'] },
  /* 65 */ { moves: 24, kinds: 5, goals: [['score', 20000]], breather: true },
  /* 66 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '........',
    '.h....h.',
    '........',
    '........',
    '.h....h.',
    '........',
    '........'] },
  /* 67 */ { moves: 29, kinds: 6, goals: [], tip: 'Clear the crates off the snack table!', layout: [
    '........',
    '........',
    '.b.jj.b.',
    '.b....b.',
    '.b....b.',
    '.b.jj.b.',
    '........',
    '........'] },
  /* 68 */ { moves: 29, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'grapes', 18]], layout: [
    '..d.....',
    '........',
    '.jj..jj.',
    '........',
    '...ii...',
    '........',
    '.jj..jj.',
    '........'] },
  /* 69 */ { moves: 29, kinds: 6, goals: [], layout: [
    '........',
    '.i.hh.i.',
    '........',
    '..i..i..',
    '..i..i..',
    '........',
    '.i.hh.i.',
    '........'] },
  /* 70 */ { moves: 32, kinds: 6, drops: 3, dropsMax: 1, goals: [['collect', 'avocado', 18]], tip: 'Act 1 boss board — lunch rush!', layout: [
    '...d....',
    '........',
    '.jjjjjj.',
    '.j.bb.j.',
    '.j....j.',
    '.jjjjjj.',
    '........',
    '........'] },
  /* 71 */ { moves: 28, kinds: 6, goals: [], tip: 'Act 2: the table gets crowded — obstacles everywhere!', layout: [
    '........',
    '.J....J.',
    '..JJJJ..',
    '........',
    '........',
    '..JJJJ..',
    '.J....J.',
    '........'] },
  /* 72 */ { moves: 31, kinds: 6, goals: [['collect', 'donut', 18], ['collect', 'taco', 18]], layout: [
    '........',
    '..I..I..',
    '.i....i.',
    '........',
    '........',
    '.i....i.',
    '..I..I..',
    '........'] },
  /* 73 */ { moves: 30, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '........',
    '.B....B.',
    '..jjjj..',
    '..jjjj..',
    '........',
    '.B....B.',
    '........'] },
  /* 74 */ { moves: 31, kinds: 6, goals: [['collect', 'cupcake', 18]], layout: [
    '........',
    '.H....H.',
    '...hh...',
    '.i....i.',
    '.i....i.',
    '...hh...',
    '.H....H.',
    '........'] },
  /* 75 */ { moves: 26, kinds: 5, drops: 1, dropsMax: 1, goals: [['collect', 'burger', 34]], breather: true, layout: [
    '........',
    '....d...',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 76 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '..d.....',
    '........',
    '.XX..XX.',
    '........',
    '..jjjj..',
    '..jjjj..',
    '........',
    '........'] },
  /* 77 */ { moves: 31, kinds: 6, goals: [['collect', 'avocado', 18], ['collect', 'grapes', 18]], tip: 'Something green and sparkly is on the menu today…', layout: [
    '........',
    '..h..h..',
    '.I....I.',
    '...ii...',
    '...ii...',
    '.I....I.',
    '..h..h..',
    '........'] },
  /* 78 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.b.JJ.b.',
    '.J....J.',
    '.J.ii.J.',
    '.J....J.',
    '.b.JJ.b.',
    '........',
    '........'] },
  /* 79 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.hJ..Jh.',
    '.J....J.',
    '...bb...',
    '...bb...',
    '.J....J.',
    '.hJ..Jh.',
    '........'] },
  /* 80 */ { moves: 36, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'taco', 16]], tip: 'Act 2 boss board — the whole crew is starving!', layout: [
    '...d....',
    '.jjjjjj.',
    '.ji..ij.',
    '.j.bb.j.',
    '.j....j.',
    '.ji..ij.',
    '.jjjjjj.',
    '........'] },
  /* 81 */ { moves: 31, kinds: 6, goals: [], tip: 'Act 3: Master Boards — chef’s special!', layout: [
    '........',
    '.JJ..JJ.',
    '.J.hh.J.',
    '........',
    '........',
    '.J.hh.J.',
    '.JJ..JJ.',
    '........'] },
  /* 82 */ { moves: 34, kinds: 6, goals: [['collect', 'grapes', 18], ['collect', 'donut', 18]], layout: [
    '........',
    '.H.ii.H.',
    '........',
    '.i.HH.i.',
    '........',
    '.H.ii.H.',
    '........',
    '........'] },
  /* 83 */ { moves: 36, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'cupcake', 16]], layout: [
    '..d.....',
    '........',
    '.b.XX.b.',
    '.b....b.',
    '..iiii..',
    '........',
    '.b....b.',
    '........'] },
  /* 84 */ { moves: 32, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.jJJJJj.',
    '........',
    '........',
    '.jJJJJj.',
    '.jjjjjj.',
    '........'] },
  /* 85 */ { moves: 28, kinds: 5, drops: 1, dropsMax: 1, goals: [['score', 22000]], breather: true, layout: [
    '........',
    '...d....',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 86 */ { moves: 36, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.hj..jh.',
    '.jh..hj.',
    '...ii...',
    '...ii...',
    '.jh..hj.',
    '.hj..jh.',
    '........'] },
  /* 87 */ { moves: 35, kinds: 6, goals: [['collect', 'burger', 18], ['collect', 'avocado', 18]], layout: [
    '........',
    '..ih.hi.',
    '........',
    '.B....B.',
    '..h..h..',
    '........',
    '..ih.hi.',
    '........'] },
  /* 88 */ { moves: 38, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '.JbJJbJ.',
    '.b....b.',
    '.J.ii.J.',
    '.J.ii.J.',
    '.b....b.',
    '.JbJJbJ.',
    '........'] },
  /* 89 */ { moves: 33, kinds: 6, goals: [['collect', 'taco', 16], ['collect', 'cupcake', 16]], layout: [
    '........',
    '..H..H..',
    '.b....b.',
    '..JJJJ..',
    '..JJJJ..',
    '.b....b.',
    '..H..H..',
    '........'] },
  /* 90 */ { moves: 40, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'donut', 16]], tip: 'World 3 finale — dinner is served!', layout: [
    '....d...',
    '.jjhhjj.',
    '.jI..Ij.',
    '.j.XX.j.',
    '.j.XX.j.',
    '.ji..ij.',
    '.jjhhjj.',
    '........'] },
  /* ===== WORLD 4 · ON LOCATION (levels 91–120) ===== */
  /* 91 */ { moves: 25, kinds: 5, goals: [['collect', 'sun', 24], ['collect', 'shell', 24]], tip: 'We’re on location! Sun, sand and a long day of shooting.' },
  /* 92 */ { moves: 28, kinds: 6, goals: [], layout: [
    '........',
    '........',
    '.j.jj.j.',
    '..j..j..',
    '..j..j..',
    '.j.jj.j.',
    '........',
    '........'] },
  /* 93 */ { moves: 29, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'cactus', 16]], tip: 'Water run! It’s hot out here — get the water down to the crew.', layout: [
    '...d....',
    '........',
    '........',
    '.j....j.',
    '.j....j.',
    '........',
    '........',
    '........'] },
  /* 94 */ { moves: 30, kinds: 6, goals: [['collect', 'compass', 18]], layout: [
    '........',
    '........',
    '..i..i..',
    '...ii...',
    '...ii...',
    '..i..i..',
    '........',
    '........'] },
  /* 95 */ { moves: 25, kinds: 5, goals: [['score', 20000]], breather: true },
  /* 96 */ { moves: 30, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '........',
    '.h....h.',
    '........',
    '..h..h..',
    '........',
    '........',
    '........'] },
  /* 97 */ { moves: 30, kinds: 6, goals: [], tip: 'Equipment cases everywhere — clear a path for the camera!', layout: [
    '........',
    '........',
    '.b....b.',
    '.bj..jb.',
    '.bj..jb.',
    '.b....b.',
    '........',
    '........'] },
  /* 98 */ { moves: 31, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'parasol', 18]], layout: [
    '..d.....',
    '........',
    '.jj..jj.',
    '........',
    '...ii...',
    '........',
    '.jj..jj.',
    '........'] },
  /* 99 */ { moves: 35, kinds: 6, goals: [], layout: [
    '........',
    '.i.hh.i.',
    '........',
    '..i..i..',
    '..i..i..',
    '........',
    '.i.hh.i.',
    '........'] },
  /* 100 */ { moves: 33, kinds: 6, drops: 3, dropsMax: 1, goals: [['collect', 'shades', 18]], tip: 'Act 1 boss board — the sun is going down fast!', layout: [
    '...d....',
    '........',
    '.jjjjjj.',
    '.j.bb.j.',
    '.j....j.',
    '.jjjjjj.',
    '........',
    '........'] },
  /* 101 */ { moves: 30, kinds: 6, goals: [], tip: 'Act 2: the weather has other plans — obstacles everywhere!', layout: [
    '........',
    '.J....J.',
    '..JJJJ..',
    '........',
    '........',
    '..JJJJ..',
    '.J....J.',
    '........'] },
  /* 102 */ { moves: 33, kinds: 6, goals: [['collect', 'sun', 18], ['collect', 'compass', 18]], layout: [
    '........',
    '..I..I..',
    '.i....i.',
    '........',
    '........',
    '.i....i.',
    '..I..I..',
    '........'] },
  /* 103 */ { moves: 35, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '........',
    '.B....B.',
    '..jjjj..',
    '..jjjj..',
    '........',
    '.B....B.',
    '........'] },
  /* 104 */ { moves: 35, kinds: 6, goals: [['collect', 'shell', 18]], layout: [
    '........',
    '.H....H.',
    '........',
    '..i..i..',
    '..i..i..',
    '...hh...',
    '.H....H.',
    '........'] },
  /* 105 */ { moves: 27, kinds: 5, drops: 1, dropsMax: 1, goals: [['collect', 'sun', 34]], breather: true, layout: [
    '........',
    '....d...',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 106 */ { moves: 33, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '..d.....',
    '........',
    '.XX..XX.',
    '........',
    '..jjjj..',
    '..jjjj..',
    '........',
    '........'] },
  /* 107 */ { moves: 34, kinds: 6, goals: [['collect', 'parasol', 18], ['collect', 'shades', 18]], tip: 'Is that a twister on the horizon? Hold on to your hat, Pip!', layout: [
    '........',
    '..h..h..',
    '.I....I.',
    '...ii...',
    '...ii...',
    '.I....I.',
    '..h..h..',
    '........'] },
  /* 108 */ { moves: 32, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.b.JJ.b.',
    '.J....J.',
    '.J.ii.J.',
    '.J....J.',
    '.b.JJ.b.',
    '........',
    '........'] },
  /* 109 */ { moves: 32, kinds: 6, goals: [], layout: [
    '........',
    '.hJ..Jh.',
    '.J....J.',
    '...bb...',
    '...bb...',
    '.J....J.',
    '.hJ..Jh.',
    '........'] },
  /* 110 */ { moves: 39, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'sun', 16]], tip: 'Act 2 boss board — sandstorm on set!', layout: [
    '...d....',
    '.jjjjjj.',
    '.ji..ij.',
    '.j.bb.j.',
    '.j....j.',
    '.ji..ij.',
    '.jjjjjj.',
    '........'] },
  /* 111 */ { moves: 32, kinds: 6, goals: [], tip: 'Act 3: Master Boards — the big outdoor scene!', layout: [
    '........',
    '.JJ..JJ.',
    '.J.hh.J.',
    '........',
    '........',
    '.J.hh.J.',
    '.JJ..JJ.',
    '........'] },
  /* 112 */ { moves: 36, kinds: 6, goals: [['collect', 'shell', 18], ['collect', 'compass', 18]], layout: [
    '........',
    '.H.ii.H.',
    '........',
    '.i.HH.i.',
    '........',
    '.H.ii.H.',
    '........',
    '........'] },
  /* 113 */ { moves: 37, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'cactus', 16]], layout: [
    '..d.....',
    '........',
    '.b.XX.b.',
    '.b....b.',
    '..iiii..',
    '........',
    '.b....b.',
    '........'] },
  /* 114 */ { moves: 33, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.jJJJJj.',
    '........',
    '........',
    '.jJJJJj.',
    '.jjjjjj.',
    '........'] },
  /* 115 */ { moves: 28, kinds: 5, drops: 1, dropsMax: 1, goals: [['score', 22000]], breather: true, layout: [
    '........',
    '...d....',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 116 */ { moves: 36, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.hj..jh.',
    '.jh..hj.',
    '...ii...',
    '...ii...',
    '.jh..hj.',
    '.hj..jh.',
    '........'] },
  /* 117 */ { moves: 36, kinds: 6, goals: [['collect', 'shades', 18], ['collect', 'sun', 18]], layout: [
    '........',
    '..ih.hi.',
    '........',
    '.B....B.',
    '..h..h..',
    '........',
    '..ih.hi.',
    '........'] },
  /* 118 */ { moves: 40, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '.JbJJbJ.',
    '.b....b.',
    '.J.ii.J.',
    '.J.ii.J.',
    '.b....b.',
    '.JbJJbJ.',
    '........'] },
  /* 119 */ { moves: 34, kinds: 6, goals: [['collect', 'parasol', 16], ['collect', 'shell', 16]], layout: [
    '........',
    '..H..H..',
    '.b....b.',
    '..JJJJ..',
    '..JJJJ..',
    '.b....b.',
    '..H..H..',
    '........'] },
  /* 120 */ { moves: 43, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'compass', 16]], tip: 'World 4 finale — magic hour, one take only!', layout: [
    '....d...',
    '.jjhhjj.',
    '.jI..Ij.',
    '.j.XX.j.',
    '.j.XX.j.',
    '.ji..ij.',
    '.jjhhjj.',
    '........'] },
  /* ===== WORLD 5 · THE WRAP PARTY (levels 121–150) ===== */
  /* 121 */ { moves: 26, kinds: 5, goals: [['collect', 'note', 24], ['collect', 'partyhat', 24]], tip: 'It\'s a wrap! Time to celebrate — the party is on!' },
  /* 122 */ { moves: 29, kinds: 6, goals: [], layout: [
    '........',
    '........',
    '.j.jj.j.',
    '..j..j..',
    '..j..j..',
    '.j.jj.j.',
    '........',
    '........'] },
  /* 123 */ { moves: 30, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'glowstick', 16]], tip: 'Mixtape run! Get the tapes down to the DJ booth.', layout: [
    '...d....',
    '........',
    '........',
    '.j....j.',
    '.j....j.',
    '........',
    '........',
    '........'] },
  /* 124 */ { moves: 31, kinds: 6, goals: [['collect', 'disco', 18]], layout: [
    '........',
    '........',
    '..i..i..',
    '...ii...',
    '...ii...',
    '..i..i..',
    '........',
    '........'] },
  /* 125 */ { moves: 25, kinds: 5, goals: [['score', 20000]], breather: true },
  /* 126 */ { moves: 33, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '........',
    '.h....h.',
    '........',
    '..h..h..',
    '........',
    '........',
    '........'] },
  /* 127 */ { moves: 27, kinds: 6, goals: [], tip: 'Speakers and road cases everywhere — clear the dance floor!', layout: [
    '........',
    '..bbbb..',
    '...jj...',
    '........',
    '........',
    '...jj...',
    '..bbbb..',
    '........'] },
  /* 128 */ { moves: 32, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'boombox', 18]], layout: [
    '..d.....',
    '........',
    '.jj..jj.',
    '........',
    '...ii...',
    '........',
    '.jj..jj.',
    '........'] },
  /* 129 */ { moves: 39, kinds: 6, goals: [], layout: [
    '........',
    '.i....i.',
    '...ii...',
    '.h....h.',
    '.h....h.',
    '...ii...',
    '.i....i.',
    '........'] },
  /* 130 */ { moves: 34, kinds: 6, drops: 3, dropsMax: 1, goals: [['collect', 'headphones', 18]], tip: 'Act 1 boss board — the DJ just dropped the beat!', layout: [
    '...d....',
    '........',
    '.jjjjjj.',
    '.j.bb.j.',
    '.j....j.',
    '.jjjjjj.',
    '........',
    '........'] },
  /* 131 */ { moves: 32, kinds: 6, goals: [], tip: 'Act 2: the party gets packed — obstacles everywhere!', layout: [
    '........',
    '.J....J.',
    '..J..J..',
    '..J..J..',
    '..J..J..',
    '..J..J..',
    '.J....J.',
    '........'] },
  /* 132 */ { moves: 35, kinds: 6, goals: [['collect', 'note', 18], ['collect', 'disco', 18]], layout: [
    '........',
    '..I..I..',
    '.i....i.',
    '........',
    '........',
    '.i....i.',
    '..I..I..',
    '........'] },
  /* 133 */ { moves: 36, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '........',
    '.B....B.',
    '..jjjj..',
    '..jjjj..',
    '........',
    '.B....B.',
    '........'] },
  /* 134 */ { moves: 37, kinds: 6, goals: [['collect', 'partyhat', 18]], layout: [
    '........',
    '.H....H.',
    '........',
    '..i..i..',
    '..i..i..',
    '...hh...',
    '.H....H.',
    '........'] },
  /* 135 */ { moves: 27, kinds: 5, drops: 1, dropsMax: 1, goals: [['collect', 'note', 34]], breather: true, layout: [
    '........',
    '....d...',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 136 */ { moves: 34, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '..d.....',
    '........',
    '.XX..XX.',
    '........',
    '..jjjj..',
    '..jjjj..',
    '........',
    '........'] },
  /* 137 */ { moves: 35, kinds: 6, goals: [['collect', 'boombox', 18], ['collect', 'headphones', 18]], tip: 'Green lights on the dance floor tonight… very emerald.', layout: [
    '........',
    '..I..I..',
    '.h....h.',
    '...ii...',
    '...ii...',
    '.h....h.',
    '..I..I..',
    '........'] },
  /* 138 */ { moves: 33, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.b.JJ.b.',
    '.J....J.',
    '.J.ii.J.',
    '.J....J.',
    '.b.JJ.b.',
    '........',
    '........'] },
  /* 139 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.hJ..Jh.',
    '.J....J.',
    '...bb...',
    '...bb...',
    '.J....J.',
    '.hJ..Jh.',
    '........'] },
  /* 140 */ { moves: 40, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'note', 16]], tip: 'Act 2 boss board — the whole crew is on the dance floor!', layout: [
    '...d....',
    '.jjjjjj.',
    '.ji..ij.',
    '.j.bb.j.',
    '.j....j.',
    '.ji..ij.',
    '.jjjjjj.',
    '........'] },
  /* 141 */ { moves: 33, kinds: 6, goals: [], tip: 'Act 3: Master Boards — the last song of the night!', layout: [
    '........',
    '.JJ..JJ.',
    '.J....J.',
    '..h..h..',
    '..h..h..',
    '.J....J.',
    '.JJ..JJ.',
    '........'] },
  /* 142 */ { moves: 37, kinds: 6, goals: [['collect', 'partyhat', 18], ['collect', 'disco', 18]], layout: [
    '........',
    '.H.ii.H.',
    '........',
    '.i.HH.i.',
    '........',
    '.H.ii.H.',
    '........',
    '........'] },
  /* 143 */ { moves: 38, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'glowstick', 16]], layout: [
    '..d.....',
    '........',
    '.b.XX.b.',
    '.b....b.',
    '..iiii..',
    '........',
    '.b....b.',
    '........'] },
  /* 144 */ { moves: 34, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.jJJJJj.',
    '........',
    '........',
    '.jJJJJj.',
    '.jjjjjj.',
    '........'] },
  /* 145 */ { moves: 28, kinds: 5, drops: 1, dropsMax: 1, goals: [['score', 22000]], breather: true, layout: [
    '........',
    '...d....',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........'] },
  /* 146 */ { moves: 37, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '....d...',
    '.hj..jh.',
    '.jh..hj.',
    '...ii...',
    '...ii...',
    '.jh..hj.',
    '.hj..jh.',
    '........'] },
  /* 147 */ { moves: 37, kinds: 6, goals: [['collect', 'headphones', 18], ['collect', 'note', 18]], layout: [
    '........',
    '...B....',
    '.i..h.i.',
    '.h....h.',
    '........',
    '.h..h.h.',
    '.i.B..i.',
    '........'] },
  /* 148 */ { moves: 44, kinds: 6, drops: 2, dropsMax: 1, goals: [], layout: [
    '...d....',
    '.JbJJbJ.',
    '.b....b.',
    '.J.ii.J.',
    '.J.ii.J.',
    '.b....b.',
    '.JbJJbJ.',
    '........'] },
  /* 149 */ { moves: 35, kinds: 6, goals: [['collect', 'boombox', 16], ['collect', 'partyhat', 16]], layout: [
    '........',
    '..b..b..',
    '.H.JJ.H.',
    '...JJ...',
    '...JJ...',
    '.H.JJ.H.',
    '..b..b..',
    '........'] },
  /* 150 */ { moves: 44, kinds: 6, drops: 2, dropsMax: 1, goals: [['collect', 'disco', 16]], tip: 'World 5 finale — one more song before the credits roll!', layout: [
    '....d...',
    '.jjhhjj.',
    '.jI..Ij.',
    '.j.XX.j.',
    '.j.XX.j.',
    '.ji..ij.',
    '.jjhhjj.',
    '........'] },
];

/* World 6 · Cinematic Credits (levels 151–180): the red carpet and the awards. */
const LEVELS_W6 = [
  /* ===== WORLD 6 · CINEMATIC CREDITS (levels 151–180) ===== */
  /* 151 */ { moves: 26, kinds: 5, goals: [['collect', 'trophy', 24], ['collect', 'bouquet', 24]], tip: 'Welcome to the red carpet — the final world!' },
  /* 152 */ { moves: 28, kinds: 6, goals: [], layout: [
    '........',
    '..jjjj..',
    '.j....j.',
    '.j.ii.j.',
    '.j.ii.j.',
    '.j....j.',
    '..jjjj..',
    '........'] },
  /* 153 */ { moves: 28, kinds: 6, goals: [['collect', 'camera', 18]], layout: [
    '........',
    '.b....b.',
    '.bb..bb.',
    '...hh...',
    '........',
    '.bb..bb.',
    '.b....b.',
    '........'] },
  /* 154 */ { moves: 29, kinds: 6, goals: [], layout: [
    '........',
    '.JJ..JJ.',
    '.J.hh.J.',
    '........',
    '........',
    '.J.hh.J.',
    '.JJ..JJ.',
    '........'] },
  /* 155 */ { moves: 25, kinds: 5, goals: [['score', 23000]], breather: true },
  /* 156 */ { moves: 29, kinds: 6, goals: [['collect', 'envelope', 18]], layout: [
    '........',
    '..i..i..',
    '.i.BB.i.',
    '...BB...',
    '........',
    '.i....i.',
    '..i..i..',
    '........'] },
  /* 157 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.jjjjjj.',
    '.jJJJJj.',
    '........',
    '........',
    '.jJJJJj.',
    '.jjjjjj.',
    '........'] },
  /* 158 */ { moves: 31, kinds: 6, goals: [['collect', 'ribbon', 16], ['collect', 'flute', 16]], layout: [
    '........',
    '.h....h.',
    '...hh...',
    '........',
    '........',
    '...hh...',
    '.h....h.',
    '........'] },
  /* 159 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.X....X.',
    '..b..b..',
    '.j.ii.j.',
    '.j.ii.j.',
    '..b..b..',
    '.X....X.',
    '........'] },
  /* 160 */ { moves: 28, kinds: 5, goals: [['collect', 'trophy', 32]], breather: true, layout: [
    '........',
    '........',
    '..jjjj..',
    '........',
    '........',
    '..jjjj..',
    '........',
    '........'] },
  /* 161 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.i.HH.i.',
    '........',
    '.H....H.',
    '.H....H.',
    '........',
    '.i.HH.i.',
    '........'] },
  /* 162 */ { moves: 30, kinds: 6, goals: [['collect', 'bouquet', 20]], layout: [
    '........',
    '.JJJJJJ.',
    '.J....J.',
    '.J.bb.J.',
    '.J.bb.J.',
    '.J....J.',
    '.JJJJJJ.',
    '........'] },
  /* 163 */ { moves: 29, kinds: 6, goals: [['collect', 'camera', 18], ['collect', 'envelope', 18]], layout: [
    '........',
    '..I..I..',
    '........',
    '.i.hh.i.',
    '........',
    '........',
    '..I..I..',
    '........'] },
  /* 164 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.BXXXXB.',
    '........',
    '.jjjjjj.',
    '.jjjjjj.',
    '........',
    '........',
    '........'] },
  /* 165 */ { moves: 27, kinds: 5, goals: [['score', 32000]], breather: true, layout: [
    '........',
    '........',
    '...ii...',
    '..i..i..',
    '..i..i..',
    '...ii...',
    '........',
    '........'] },
  /* 166 */ { moves: 30, kinds: 6, goals: [['collect', 'flute', 20]], layout: [
    '........',
    '.jh..hj.',
    '.j....j.',
    '..JJJJ..',
    '..JJJJ..',
    '.j....j.',
    '.jh..hj.',
    '........'] },
  /* 167 */ { moves: 30, kinds: 6, goals: [], layout: [
    '........',
    '.Bb..bB.',
    '..I..I..',
    '.b.hh.b.',
    '.b....b.',
    '..I..I..',
    '.Bb..bB.',
    '........'] },
  /* 168 */ { moves: 30, kinds: 6, goals: [['collect', 'ribbon', 20], ['collect', 'trophy', 20]], layout: [
    '........',
    '..h..h..',
    '.H....H.',
    '...ii...',
    '...ii...',
    '.H....H.',
    '..h..h..',
    '........'] },
  /* 169 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.JJJJJJ.',
    '.JJJJJJ.',
    '.J.XX.J.',
    '.J.XX.J.',
    '.JJJJJJ.',
    '.JJJJJJ.',
    '........'] },
  /* 170 */ { moves: 32, kinds: 6, goals: [['collect', 'bouquet', 30]], breather: true, tip: 'Ten more to go — the big night is near!', layout: [
    '........',
    '........',
    '.j.jj.j.',
    '........',
    '........',
    '.j.jj.j.',
    '........',
    '........'] },
  /* 171 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.H.h.hH.',
    '........',
    '..I..I..',
    '........',
    '.H.h.hH.',
    '........',
    '........'] },
  /* 172 */ { moves: 30, kinds: 6, goals: [['collect', 'envelope', 22]], layout: [
    '........',
    '.X.bb.X.',
    '........',
    '.b.jj.b.',
    '.b.jj.b.',
    '........',
    '.X.bb.X.',
    '........'] },
  /* 173 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.jIjjIj.',
    '.j....j.',
    '.j.hh.j.',
    '.j.hh.j.',
    '.j....j.',
    '.jIjjIj.',
    '........'] },
  /* 174 */ { moves: 30, kinds: 6, goals: [['collect', 'camera', 20], ['collect', 'flute', 20]], layout: [
    '........',
    '..b..b..',
    '.h.BB.h.',
    '........',
    '........',
    '.h.BB.h.',
    '..b..b..',
    '........'] },
  /* 175 */ { moves: 28, kinds: 5, goals: [['collect', 'trophy', 36]], breather: true },
  /* 176 */ { moves: 31, kinds: 6, goals: [], layout: [
    '........',
    '.JJJJJJ.',
    '.JhJJhJ.',
    '........',
    '........',
    '.JhJJhJ.',
    '.JJJJJJ.',
    '........'] },
  /* 177 */ { moves: 31, kinds: 6, goals: [['collect', 'ribbon', 18]], layout: [
    '........',
    '.I.XX.I.',
    '........',
    '.i....i.',
    '........',
    '.i....i.',
    '.I.XX.I.',
    '........'] },
  /* 178 */ { moves: 33, kinds: 6, goals: [], layout: [
    '........',
    '.bjjjjb.',
    '.jh..hj.',
    '.j.II.j.',
    '.j.II.j.',
    '.jh..hj.',
    '.bjjjjb.',
    '........'] },
  /* 179 */ { moves: 31, kinds: 6, goals: [['collect', 'envelope', 20], ['collect', 'bouquet', 20]], layout: [
    '........',
    '..H..H..',
    '.b....b.',
    '..jjjj..',
    '..jjjj..',
    '.b....b.',
    '..H..H..',
    '........'] },
  /* 180 */ { moves: 38, kinds: 6, goals: [['collect', 'trophy', 16]], tip: 'The grand finale — this one is for you.', layout: [
    '........',
    '.jjhhjj.',
    '.jI..Ij.',
    '.j.XX.j.',
    '.j.XX.j.',
    '.jI..Ij.',
    '.jjhhjj.',
    '........'] },
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
  const tier = Math.min(1, Math.max(0, (n - 30) / 70));   // keeps ramping after the handmade levels, then holds
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
    goals.push(['collect', tilesFor(n)[Math.floor(rnd() * kinds)].id, Math.round(16 + 12 * tier)]);
    moves += 2;
  }
  return { moves, kinds, goals, breather, layout: grid.map(row => row.join('')) };
}

/* Turn a level entry into everything the game needs. */
function buildLevel(n) {
  const raw = n <= LEVELS.length ? LEVELS[n - 1]
    : n >= 151 && n < 151 + LEVELS_W6.length ? LEVELS_W6[n - 151]
    : generateLevel(n);
  const layout = raw.layout || [];
  const spec = blankSpec(CONFIG.rows, CONFIG.cols);
  const counts = { gel: 0, ice: 0, chain: 0, box: 0, drop: 0 };

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
        case 'd': s.drop = true; counts.drop++; break;
      }
    }
  }

  const goals = raw.goals.map(g => {
    if (g[0] === 'collect') return { type: 'collect', kind: tilesFor(n).findIndex(t => t.id === g[1]), need: g[2], have: 0 };
    if (g[0] === 'score') return { type: 'score', need: g[1], have: 0 };
    return { type: g[0], need: counts[g[0]] || 0, have: 0 };
  });
  ['gel', 'ice', 'chain', 'box'].forEach(t => {
    if (counts[t] && !goals.some(g => g.type === t)) goals.push({ type: t, need: counts[t], have: 0 });
  });
  // ingredient drops: `drops` = total to deliver (some start on the board as 'd', the rest fall in)
  const dropTotal = Math.max(raw.drops || 0, counts.drop);
  if (dropTotal) goals.unshift({ type: 'drop', need: dropTotal, have: 0 });

  const round100 = v => Math.round(v / 100) * 100;
  const perMove = CONFIG.scorePerMove[raw.kinds || 6] || 600;
  const scoreGoal = goals.find(g => g.type === 'score');
  const stars = scoreGoal
    ? [scoreGoal.need, round100(scoreGoal.need * 1.3), round100(scoreGoal.need * 1.6)]
    : [0, round100(raw.moves * perMove * CONFIG.star2Factor), round100(raw.moves * perMove * CONFIG.star3Factor)];

  return { n, moves: raw.moves, kinds: raw.kinds || 6, goals, spec, stars, tip: raw.tip || '',
           drops: { total: dropTotal, initial: counts.drop, max: raw.dropsMax || 2 } };
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
    this.dropSprite = buildDropSprite(px, World.current);
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
      if (t.drop) {
        const bob = Math.sin(now / 300 + t.c) * s * 0.03;
        ctx.drawImage(this.dropSprite, x, y + bob, size, size);
        ctx.globalAlpha = 1;
        return;
      }
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

    if (Game.level && Game.level.drops && Game.level.drops.total) {
      const a = 0.45 + 0.35 * Math.sin(now / 250);
      ctx.fillStyle = `rgba(244,184,58,${a.toFixed(2)})`;
      for (let c = 0; c < Board.cols; c++) {
        const er = Game.exitRow(c);
        if (er < 0) continue;
        const cx = (c + 0.5) * s, y = (er + 1) * s - s * 0.13;
        ctx.beginPath(); ctx.moveTo(cx - s * 0.12, y - s * 0.06); ctx.lineTo(cx + s * 0.12, y - s * 0.06); ctx.lineTo(cx, y + s * 0.07); ctx.closePath(); ctx.fill();
      }
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
      const ht = Board.grid[cell.r][cell.c];
      if (ht && ht.drop) { UI.toast(`Can't smash the ${dropItem(World.current).name} — bring it down!`, false, 'oops'); return; }
      if (ht || Board.cells[cell.r][cell.c].box) Game.hammerAt(cell);
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

    this.dropsToSpawn = lv.drops.total - lv.drops.initial;
    Board.setup(lv.spec, lv.kinds);
    World.apply(worldOf(n));                     // after the board exists (it redraws)
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
    else if (!Save.data.help.pip) setTimeout(() => UI.showMeetPip(), 500);
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
    const m = this.bestHint(moves);
    this.hint = { a: m.a, b: m.b, start: performance.now() };
    if (!silent) UI.toast(Lines.hint(), false, 'wink'); else Pip.react('wink', 1500, false);
    Sound.play('twinkle');
    Loop.wake();
  },

  // On coffee levels, prefer moves that bring a coffee down.
  bestHint(moves) {
    const want = this.level && this.level.goals.some(g => g.type === 'drop' && g.have < g.need);
    if (!want) return moves[Math.floor(Math.random() * moves.length)];
    let best = null, bestScore = -1;
    for (const m of moves) {
      const ta = Board.grid[m.a.r][m.a.c], tb = Board.grid[m.b.r][m.b.c];
      let sc = Math.random();
      // swapping a coffee downward
      if (ta.drop && m.b.r > m.a.r) sc += 30;
      if (tb.drop && m.a.r > m.b.r) sc += 30;
      // matches that clear tiles beneath a coffee
      Board.swap(m.a, m.b);
      const runs = Board.findMatches();
      Board.swap(m.a, m.b);
      runs.forEach(run => run.cells.forEach(p => {
        for (let r = 0; r < p.r; r++) { const t = Board.grid[r][p.c]; if (t && t.drop) sc += 10 + p.r; }
      }));
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return best;
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

    const combo = !ta.drop && !tb.drop && (ta.special === 'bomb' || tb.special === 'bomb' || !!(ta.special && tb.special));
    const k = Board.kindsMatrix();
    // a coffee can always be swiped straight down one space (it costs a move)
    const coffeeDown = (ta.drop && !tb.drop && ta.r > tb.r) || (tb.drop && !ta.drop && tb.r > ta.r);
    const makesMatch = combo || coffeeDown || Board.matchesAt(k, ta.r, ta.c) || Board.matchesAt(k, tb.r, tb.c);

    if (!makesMatch) {
      Board.swap(a, b);
      this.badStreak++;
      if (this.badStreak >= CONFIG.stuckAfter) {
        this.badStreak = 0;
        UI.toast(Lines.stuck(), false, 'think');
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(() => this.showHint(), 1700);
      } else {
        UI.toast(Lines.oops(), false, 'oops');
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
      while (await this.deliverDrops()) await this.collapse();
    }
    if (Board.findMoves().length === 0) await this.shuffle();
  },

  // Lowest cell in a column a tile can sit in (skips boxes and locked tiles at the bottom).
  exitRow(c) {
    if (!Board.grid.length || !Board.cells.length) return -1;
    for (let r = Board.rows - 1; r >= 0; r--) {
      const t = Board.grid[r][c];
      if (Board.cells[r][c].box || (t && t.lock)) continue;
      return r;
    }
    return -1;
  },

  // Drops that reach the bottom of their column get delivered.
  async deliverDrops() {
    const done = [];
    for (let c = 0; c < Board.cols; c++) {
      const r = this.exitRow(c);
      const t = r >= 0 && Board.grid[r][c];
      if (t && t.drop) done.push(t);
    }
    if (!done.length) return false;
    Sound.play('gift');
    await Promise.all(done.map(t => {
      Particles.burst(t.c + 0.5, t.r + 0.5, ['#F4B83A', '#FFFFFF', '#3AAFA9'], 14, { star: true, speed: 4 });
      FX.play({ type: 'text', r: t.r + 0.2, c: t.c + 0.5, text: '+1,000', big: true }, 900);
      return Tweens.to(t, { y: t.r + 0.7, scale: 0.4, alpha: 0 }, 380, { ease: Ease.inCubic });
    }));
    done.forEach(t => {
      Board.grid[t.r][t.c] = null;
      this.progress('drop');
    });
    this.addScore(done.length * 1000);
    UI.updateGoals();
    return true;
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
      if (Board.grid[r][c] && Board.grid[r][c].drop) return;   // drops can't be blasted
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
      Pip.react('wow', 1600);
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
      if (Board.grid[r][c] && Board.grid[r][c].drop) return;
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
        // Sometimes the top new tile in a column is an ingredient drop.
        const top = i === open.length - 1 && this.exitRow(c) >= Board.rows - 2;   // only where it can get out
        const onBoard = Board.dropsOnBoard();
        const wantDrop = top && this.dropsToSpawn > 0 && onBoard < ((this.level && this.level.drops.max) || 2) &&
                         (onBoard === 0 || Math.random() < 0.18);
        const t = wantDrop ? Board.makeDrop(r, c) : makeTile(Board.randomKind(), r, c);
        if (wantDrop) this.dropsToSpawn--;
        t.y = -0.6 - rank;                     // stacked just above the board
        Board.grid[r][c] = t;
        jobs.push(Tweens.to(t, { y: r }, fallMs(r - t.y), { ease: Ease.fall, delay: c * 10 + 40 }));
      }
    }
    await Promise.all(jobs);
  },

  // No moves left: reshuffle the movable tiles into a playable board.
  async shuffle(msg = 'No moves — shuffling!') {
    UI.toast(msg, false, 'wow');
    Sound.play('twister');
    const spots = [], tiles = [];
    Board.forEachTile((t, r, c) => { if (!t.lock && !t.drop) { spots.push({ r, c }); tiles.push(t); } });

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
      UI.toast('+5 moves!', false, 'cheer');
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
    UI.toast('+5 moves — you got this!', false, 'cheer');
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
      UI.toast('Finishing touches! ✨', false, 'cheer');
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
  _win: {},
  win(w = World.current) {
    if (!this._win[w]) this._win[w] = makePicker(() => CONFIG.winMessages.concat((CONFIG.worldWinMessages || {})[w] || []));
    return this._win[w]();
  },
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
    this.refreshHero();

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
    $('btnSaves').addEventListener('click', () => this.showSaves());
    $('goals').addEventListener('click', () => this.showGoalsHelp());
    $('btnHelpMap').addEventListener('click', () => this.showHowTo(0));
    $('btnHelpGame').addEventListener('click', () => { if (!Game.locked) this.showHowTo(0); });
    $('btnMapBack').addEventListener('click', () => this.showScreen('title'));
    $('btnMap').addEventListener('click', () => { Game.quit(); this.openMap(); });
    $('mapPath').addEventListener('click', e => {
      const node = e.target.closest('.node');
      if (node && !node.classList.contains('locked')) this.showIntro(+node.dataset.n);
    });
    $('panel').addEventListener('click', e => {
      const sw = e.target.closest('[data-tone]');
      if (!sw) return;
      e.stopPropagation();
      Pip.setTone(+sw.dataset.tone);
      document.querySelectorAll('.tone').forEach(b => b.classList.toggle('on', b === sw));
      const row = $('pipRow'); if (row) row.innerHTML = this.pipRow();
      document.querySelectorAll('.pip-card').forEach(img => { img.src = Pip.url(World.current, 'cheer'); });
      Sound.play('tap');
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
    if (name !== 'game') World.apply(worldOf(Save.data.progress.unlocked));
    if (name === 'game') Render.layout();
    Music.play(songFor(World.current, name));
    if (name === 'title') {
      const next = Save.data.progress.unlocked;
      $('btnPlay').textContent = next > 1 ? `Continue · Level ${next}` : 'Play';
    }
    Loop.wake();
  },

  refreshHero() {
    $('heroTiles').innerHTML = this.icons.tiles
      .map((src, i) => `<img src="${src}" alt="" style="animation-delay:${(i * 0.18).toFixed(2)}s">`).join('');
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
      drop: buildDropSprite(px, World.current).toDataURL(),
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

  toast(text, long = false, mood = 'happy') {
    Pip.react(mood, long ? 3500 : 2000, mood !== 'happy');
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
    const W1 = 30;                                    // last level of World 1
    const scroll = $('mapScroll'), path = $('mapPath');
    const W = scroll.clientWidth || 360;
    const gap = 92, padTop = 80, padBottom = 150;
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
      if (state === 'current') {
        nodes += `<img class="pip pip-map" src="${Pip.url(worldOf(n), 'cheer')}" alt="Pip" ` +
                 `style="left:${(x + (x > W / 2 ? -88 : 42)).toFixed(1)}px;top:${(y - 30).toFixed(1)}px">`;
      }
      nodes += `<button class="node ${state}${n % 10 === 0 ? ' milestone boss' : ''} w${worldOf(n)}" data-n="${n}" ` +
               `style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px" aria-label="Level ${n}">` +
               `<span class="node-num">${n}</span>` + (isBoss(n) ? '<span class="node-crown">👑</span>' : '') +
               (state === 'done' ? `<span class="node-stars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>` : '') +
               `</button>`;
    }
    const line = list => list.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
    const reached = Math.min(p.unlocked, total);
    const W2 = 60;                                    // last level of World 2
    const seg = (a, b) => pts.slice(Math.max(0, a - 1), Math.min(b, pts.length));
    const doneSeg = (a, b) => (reached > a ? seg(a, Math.min(b, reached)) : []);
    const W5 = 150;                                   // last level before the red carpet
    const W3 = 90, W4 = 120;
    const road = seg(1, W1), film = seg(W1, W2), carpet = seg(W5, total);
    const roadDone = seg(1, Math.min(reached, W1)), filmDone = doneSeg(W1, W2), carpetDone = doneSeg(W5, total);
    const tables = [[W2, W3]].map(([a, b]) => [seg(a, b), doneSeg(a, b)]);
    const neon = seg(W4, W5), neonDone = doneSeg(W4, W5);
    const dirt = seg(W3, W4), dirtDone = doneSeg(W3, W4);
    const d = list => (list.length > 1 ? line(list) : '');
    // banners on the open side of the path
    const banner = (num, name, x0, y) => {
      const x = x0 > W / 2 ? W * 0.27 : W * 0.73;
      return `<div class="world-banner wb${num}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px"><span>World ${num}</span>${name}</div>`;
    };
    const mid = (a, b) => [(pts[a - 1][0] + pts[b - 1][0]) / 2, (pts[a - 1][1] + pts[b - 1][1]) / 2];
    const m2 = mid(W1, W1 + 1), m3 = mid(W2, Math.min(W2 + 1, total)), m6 = total > W5 ? mid(W5, W5 + 1) : null, m4 = total > W3 ? mid(W3, W3 + 1) : null, m5 = total > W4 ? mid(W4, W4 + 1) : null;
    path.innerHTML =
      `<svg class="map-line" width="${W}" height="${H}" aria-hidden="true">` +
      `<path class="road-edge" d="${d(road)}"/>` +
      `<path class="road" d="${d(road)}"/>` +
      `<path class="road-glow" d="${d(roadDone)}"/>` +
      `<path class="road-done" d="${d(roadDone)}"/>` +
      `<path class="road-brick" d="${d(road)}"/>` +
      `<path class="road-lane" d="${d(road)}"/>` +
      `<path class="film-base" d="${d(film)}"/>` +
      `<path class="film-holes" d="${d(film)}"/>` +
      `<path class="film-mid" d="${d(film)}"/>` +
      `<path class="film-frames" d="${d(film)}"/>` +
      `<path class="film-glow" d="${d(filmDone)}"/><path class="film-done" d="${d(filmDone)}"/>` +
      tables.map(([table, tableDone]) =>
        `<path class="table-edge" d="${d(table)}"/>` +
        `<path class="table" d="${d(table)}"/>` +
        `<path class="table-check" d="${d(table)}"/>` +
        `<path class="table-glow" d="${d(tableDone)}"/><path class="table-done" d="${d(tableDone)}"/>` +
        `<path class="table-dots" d="${d(table)}"/>`).join('') +
      `<path class="dirt-edge" d="${d(dirt)}"/>` +
      `<path class="dirt" d="${d(dirt)}"/>` +
      `<path class="dirt-glow" d="${d(dirtDone)}"/><path class="dirt-done" d="${d(dirtDone)}"/>` +
      `<path class="dirt-tracks" d="${d(dirt)}"/>` +
      `<path class="neon-edge" d="${d(neon)}"/>` +
      `<path class="neon" d="${d(neon)}"/>` +
      `<path class="neon-glow" d="${d(neonDone)}"/><path class="neon-done" d="${d(neonDone)}"/>` +
      `<path class="neon-dash" d="${d(neon)}"/>` +
      `<path class="carpet-edge" d="${d(carpet)}"/>` +
      `<path class="carpet" d="${d(carpet)}"/>` +
      `<path class="carpet-glow" d="${d(carpetDone)}"/><path class="carpet-done" d="${d(carpetDone)}"/>` +
      `<path class="carpet-sheen" d="${d(carpet)}"/>` +
      `</svg>` +
      banner(1, WORLDS[1].name, pts[0][0], pts[0][1] + 58) +
      banner(2, WORLDS[2].name, m2[0], m2[1]) +
      (total > W2 ? banner(3, WORLDS[3].name, m3[0], m3[1]) : '') +
      (m4 ? banner(4, WORLDS[4].name, m4[0], m4[1]) : '') +
      (m5 ? banner(5, WORLDS[5].name, m5[0], m5[1]) : '') +
      (m6 ? banner(6, WORLDS[6].name, m6[0], m6[1]) : '') +
      nodes;

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

  /* ----- Save & load (backup file or code) ----- */
  saveSummary(d) {
    const p = d.progress;
    const stars = Object.values(p.stars || {}).reduce((a, b) => a + b, 0);
    const done = Math.max(0, (p.unlocked || 1) - 1);
    return `${done} level${done === 1 ? '' : 's'} done · ★ ${stars}`;
  },

  saveCode() {
    const json = JSON.stringify(Save.data);
    return 'SALON1-' + btoa(unescape(encodeURIComponent(json)));
  },

  readCode(text) {
    try {
      const t = String(text).trim();
      const body = t.startsWith('SALON1-') ? t.slice(7) : t;
      if (body.startsWith('{')) return JSON.parse(body);              // a pasted save file
      return JSON.parse(decodeURIComponent(escape(atob(body.replace(/\s+/g, '')))));
    } catch (e) { return null; }
  },

  showSaves(note = '') {
    Save.write();
    this.showModal(`
      <div class="panel-kicker">Your progress</div>
      <div class="panel-title">Save &amp; Load</div>
      <div class="save-now">${this.saveSummary(Save.data)}</div>
      <div class="panel-note">The game saves automatically on this device. Make a backup to move it to another phone or link.</div>
      ${note ? `<div class="save-note">${note}</div>` : ''}
      <div class="save-grid">
        <button class="btn" data-act="download">⬇️ Save file</button>
        <button class="btn" data-act="upload">⬆️ Load file</button>
        <button class="btn btn-ghost" data-act="copy">Copy code</button>
        <button class="btn btn-ghost" data-act="paste">Paste code</button>
      </div>
      ${Save.data.help.finale ? '<div class="panel-btns"><button class="btn" data-act="credits">🎬 Watch the credits</button></div>' : ''}
      <div class="panel-btns"><button class="btn btn-ghost" data-act="close">Close</button></div>
      <button class="save-restart" data-act="restart" type="button">↺ Start over from level 1</button>`,
      {
        restart: () => this.showRestart(),
        credits: () => this.showFinale(),
        download: () => this.downloadSave(),
        upload: () => this.pickSaveFile(),
        copy: () => this.copySaveCode(),
        paste: () => this.showPasteCode(),
      });
  },

  showRestart() {
    this.showModal(`
      <div class="panel-kicker">Start over?</div>
      <div class="panel-title save-title">Back to level 1</div>
      <div class="panel-note">This clears the progress on this device (now: ${this.saveSummary(Save.data)}). Tip: tap “Copy code” first if you might want it back.</div>
      <div class="panel-btns">
        <button class="btn btn-big btn-gold" data-act="yes">Yes, start over</button>
        <button class="btn btn-ghost" data-act="no">Cancel</button>
      </div>`,
      {
        yes: () => {
          Save.write = () => {};                     // don't let the leave-page autosave put it back
          try {
            localStorage.setItem('msalon.save.old', JSON.stringify(Save.data));   // quiet safety copy
            localStorage.removeItem('msalon.save'); localStorage.removeItem('msalon.save.bak');
          } catch (e) {}
          location.replace(location.pathname);
        },
        no: () => this.showSaves(),
      });
  },

  downloadSave() {
    const blob = new Blob([JSON.stringify(Save.data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salon-swap-save.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.showSaves('Saved! On iPhone it’s in the Files app → Downloads.');
  },

  pickSaveFile() {
    let input = $('saveFileInput');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json,text/plain';
      input.id = 'saveFileInput';
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        const r = new FileReader();
        r.onload = () => this.confirmLoad(this.readCode(r.result));
        r.readAsText(f);
      });
    }
    input.click();
  },

  copySaveCode() {
    const code = this.saveCode();
    const done = () => this.showSaves('Code copied! Paste it into Notes or a text to keep it.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, () => this.showCodeBox(code));
    } else {
      this.showCodeBox(code);
    }
  },

  // Fallback when copying isn't allowed: show the code so it can be selected by hand.
  showCodeBox(code) {
    this.showModal(`
      <div class="panel-kicker">Save code</div>
      <div class="panel-title">Copy this</div>
      <textarea class="save-code" readonly>${esc(code)}</textarea>
      <div class="panel-note">Press and hold the code → Select All → Copy.</div>
      <div class="panel-btns"><button class="btn btn-big" data-act="back">Done</button></div>`,
      { back: () => this.showSaves() });
    const ta = document.querySelector('.save-code');
    if (ta) { ta.focus(); ta.select(); }
  },

  showPasteCode() {
    this.showModal(`
      <div class="panel-kicker">Load a backup</div>
      <div class="panel-title">Paste code</div>
      <textarea class="save-code" id="pasteBox" placeholder="Paste your SALON1-… code here"></textarea>
      <div class="panel-btns">
        <button class="btn btn-big" data-act="check">Load</button>
        <button class="btn btn-ghost" data-act="back">Back</button>
      </div>`,
      {
        check: () => this.confirmLoad(this.readCode(this._pasted || '')),
        back: () => this.showSaves(),
      });
    const box = $('pasteBox');
    this._pasted = '';
    box.addEventListener('input', () => { this._pasted = box.value; });
  },

  confirmLoad(obj) {
    if (!obj || typeof obj.v !== 'number' || !obj.progress) {
      this.showSaves("That didn't look like a Salon Swap save. Try again?");
      return;
    }
    this.showModal(`
      <div class="panel-kicker">Load this save?</div>
      <div class="panel-title save-title">${this.saveSummary(obj)}</div>
      <div class="panel-note">This replaces the progress on this device (now: ${this.saveSummary(Save.data)}).</div>
      <div class="panel-btns">
        <button class="btn btn-big btn-gold" data-act="yes">Load it</button>
        <button class="btn btn-ghost" data-act="no">Cancel</button>
      </div>`,
      {
        yes: () => {
          Save.importData(obj);
          this.updateBoosters();
          this.updateSoundButtons();
          this.showScreen('title');
          this.showSaves('Loaded! You’re all caught up.');
        },
        no: () => this.showSaves(),
      });
  },

  // Plain-words explanation of a goal: what to do + how to do it.
  tileIcons(w) {
    this._tileIcons = this._tileIcons || {};
    if (!this._tileIcons[w]) this._tileIcons[w] = WORLDS[w].tiles.map(t => buildTileSprite(t, 72).toDataURL());
    return this._tileIcons[w];
  },

  goalText(g, w = World.current) {
    const left = Math.max(0, g.need - g.have);
    switch (g.type) {
      case 'collect': {
        const t = WORLDS[w].tiles[g.kind];
        return { icon: this.tileIcons(w)[g.kind], title: `Collect ${left} ${t.plural}`,
                 how: `Match ${t.plural.toLowerCase()} in rows of 3 or more. Each one cleared counts.` };
      }
      case 'gel':   return { icon: this.icons.gel,   title: `Clear the pink gel (${left})`,
                             how: 'Make matches on top of the pink squares. Darker pink needs two.' };
      case 'ice':   return { icon: this.icons.ice,   title: `Break the ice (${left})`,
                             how: 'Include the frozen tiles in a match. Thick ice takes two.' };
      case 'chain': return { icon: this.icons.chain, title: `Break the chains (${left})`,
                             how: "Chained tiles can't move. Match them where they sit to set them free." };
      case 'drop': {
        const it = dropItem(w);
        return { icon: buildDropSprite(72, w).toDataURL(), title: `${it.run}: deliver ${left}`,
                 how: `Swipe a ${it.name} down, or clear the tiles under it, until it reaches the bottom (follow the gold arrows).` };
      }
      case 'box':   return { icon: this.icons.box,   title: `Open the boxes (${left})`,
                             how: 'Make matches right next to a box. Darker boxes take more hits.' };
      case 'score': return { icon: null, title: `Reach ${g.need.toLocaleString()} points`,
                             how: 'Bigger matches, combos and chain reactions score the most.' };
    }
    return { icon: null, title: '', how: '' };
  },

  goalRows(goals, markNew, w = World.current) {
    return goals.map(g => {
      const t = this.goalText(g, w);
      const fresh = markNew && g.type !== 'collect' && g.type !== 'score' && !Save.data.help.seen[g.type];
      const icon = t.icon ? `<img src="${t.icon}" alt="">` : '<span class="gr-star">★</span>';
      return `<div class="goal-row">${icon}<div class="gr-text">` +
             `<div class="gr-title">${t.title}${fresh ? ' <span class="gr-new">NEW</span>' : ''}</div>` +
             `<div class="gr-how">${t.how}</div></div></div>`;
    }).join('');
  },

  toneRow() {
    const cur = Pip.tone();
    return `<div class="tone-label">Choose Pip's skin tone</div><div class="tone-row">` +
      Pip.TONES.map(([a, b], i) => `<button type="button" class="tone${i === cur ? ' on' : ''}" data-tone="${i}" ` +
        `style="background:linear-gradient(160deg, ${a}, ${b})" aria-label="Skin tone ${i + 1}"></button>`).join('') + `</div>`;
  },
  pipRow() {
    return [1, 2, 3, 4, 5, 6].map(w => `<img src="${Pip.url(w, 'happy', 80)}" alt="">`).join('');
  },

  // Tap Pip on the title screen to restyle.
  showPipStyle() {
    this.showModal(`
      <img class="pip pip-card pip-big" id="pipPreview" src="${Pip.url(World.current, 'cheer')}" alt="Pip">
      <div class="panel-kicker">Pip's look</div>
      <div class="panel-title">Style Pip</div>
      ${this.toneRow()}
      <div class="pip-row" id="pipRow">${this.pipRow()}</div>
      <div class="panel-btns"><button class="btn btn-big" data-act="close">Done</button></div>`);
  },

  showMeetPip() {
    this.showModal(`
      <img class="pip pip-card pip-big" src="${Pip.url(World.current, 'cheer')}" alt="Pip">
      <div class="panel-kicker">Your new sidekick</div>
      <div class="panel-title">Meet Pip!</div>
      <div class="ht-text">Hi ${esc(CONFIG.playerName)}! I'm Pip, your styling sidekick. I'll cheer you on, tease you a little, and get a brand-new look in every world.</div>
      ${this.toneRow()}
      <div class="pip-row" id="pipRow">${this.pipRow()}</div>
      <div class="panel-note">Pick my skin tone — you can change it anytime by tapping me on the title screen.</div>
      <div class="panel-btns"><button class="btn btn-big btn-gold" data-act="ok">Let's style!</button></div>`,
      { ok: () => { Save.data.help.pip = true; Save.write(); Pip.react('cheer', 1800); } });
  },

  showWorldIntro(w, then) {
    const icons = this.tileIcons(w);
    const tiles = WORLDS[w].tiles.map((t, i) =>
      `<div class="wi-tile"><img src="${icons[i]}" alt=""><span>${t.name}</span></div>`).join('');
    this.showModal(`
      <img class="pip pip-card" src="${Pip.url(w, 'cheer')}" alt="Pip">
      <div class="panel-kicker">World ${w}</div>
      <div class="panel-title">${WORLDS[w].name}</div>
      <div class="pip-says">Pip got a new look for ${WORLDS[w].name}!</div>
      <div class="ht-text">${esc(WORLDS[w].blurb.replace(/\{name\}/g, CONFIG.playerName))}</div>
      <div class="wi-grid">${tiles}</div>
      <div class="panel-note">Same rules as before, just a little tougher.</div>
      <div class="panel-btns"><button class="btn btn-big btn-gold" data-act="go">Let's go!</button></div>`,
      { go: () => { Save.data.help.world = Math.max(Save.data.help.world || 1, w); Save.write(); then(); } });
    Confetti.burst(90);
    Sound.play('fanfare');
  },

  showIntro(n) {
    const w = worldOf(n);
    if (w > (Save.data.help.world || 1)) { this.showWorldIntro(w, () => this.showIntro(n)); return; }
    const lv = buildLevel(n);
    const best = Save.data.progress.stars[n] || 0;
    const take = (Save.data.progress.fails[n] || 0) + 1;
    const kicker = w === 2 ? `Scene · Take ${take}` : w === 3 ? 'Order up' : w === 4 ? `Call sheet · Day ${n - 90}` : w === 5 ? `Track ${n - 120}` : w === 6 ? 'Category' : 'Level';
    this.showModal(`
      <div class="panel-act">World ${w} · Act ${actOf(n)} — ${ACT_NAMES[actOf(n) - 1]}</div>
      ${isBoss(n) ? '<div class="boss-tag">👑 Boss board</div>' : ''}
      <div class="panel-kicker">${kicker}</div>
      <div class="panel-title">${n}</div>
      <div class="panel-label">Your goals</div>
      <div class="goal-rows">${this.goalRows(lv.goals, true, worldOf(n))}</div>
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

  /* ----- Level 90 finale: trophy + end credits ----- */
  trophyArt(px = 320) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d');
    x.scale(px / 100, px / 100);
    drawTrophy(x, { dark: '#7a5208' });
    x.globalCompositeOperation = 'source-atop';      // paint the white trophy gold
    const g = x.createLinearGradient(0, 10, 0, 90);
    g.addColorStop(0, '#FFF6D8'); g.addColorStop(0.35, '#F7CF62'); g.addColorStop(0.7, '#E2A92E'); g.addColorStop(1, '#9C6A0A');
    x.fillStyle = g; x.fillRect(0, 0, 100, 100);
    return c.toDataURL();
  },

  showFinale(onDone) {
    this.hideModal();
    const p = Save.data.progress;
    const stars = Object.values(p.stars).reduce((a, b) => a + b, 0);
    const credits = (CONFIG.credits || []).map(c => `<div class="cr-item">${esc(c)}</div>`).join('');
    const el = document.createElement('div');
    el.className = 'finale';
    el.innerHTML = `
      <div class="fin-trophy">
        <img src="${this.trophyArt()}" alt="">
        <div class="fin-plate"><span>${esc(CONFIG.awardTitle)}</span>${esc(CONFIG.fullName)}</div>
      </div>
      <div class="fin-credits"><div class="cr-roll">
        <div class="cr-title">${esc(CONFIG.playerName)}'s<br>${esc(CONFIG.gameName)}</div>
        <div class="cr-role">Starring</div><div class="cr-name">${esc(CONFIG.fullName)}</div>
        <div class="cr-role">Hair Department Head</div><div class="cr-name">${esc(CONFIG.fullName)}</div>
        <div class="cr-role">Co-starring</div><div class="cr-name">Pip</div>
        <div class="cr-pips">${[1, 2, 3, 4, 5, 6].map(w => `<img src="${Pip.url(w, 'cheer', 80)}" alt="">`).join('')}</div>
        <div class="cr-role">Selected credits</div>${credits}
        <div class="cr-role">The journey</div>
        <div class="cr-item">${[1, 2, 3, 4, 5, 6].map(w => esc((WORLDS[w] || { name: WORLD_NAMES[w] }).name)).join(' · ')}</div>
        <div class="cr-item">180 levels · ★ ${stars}</div>
        <div class="cr-role">A special thank-you</div>
        <div class="cr-msg">${esc(CONFIG.finaleMessage)}</div>
        <div class="cr-sig">${esc(CONFIG.finaleSignature)}</div>
        <div class="cr-end">That's a wrap.</div>
      </div></div>
      <div class="fin-btns">
        <button class="btn btn-ghost" data-fin="skip" type="button">Skip</button>
        <button class="btn btn-big btn-gold" data-fin="done" type="button" hidden>Keep playing</button>
      </div>`;
    $('app').appendChild(el);
    Confetti.burst(200);
    Sound.play('heelClicks');
    Sound.play('fanfare', 0.55);
    Sound.play('fanfare', 2.2);
    const roll = el.querySelector('.cr-roll');
    const finish = () => {
      Save.data.help.finale = true;
      Save.write();
      el.classList.add('out');
      setTimeout(() => { el.remove(); if (onDone) onDone(); }, 450);
    };
    const showDone = () => {
      el.querySelector('[data-fin="done"]').hidden = false;
      el.querySelector('[data-fin="skip"]').hidden = true;
    };
    // trophy first, then the credits roll
    setTimeout(() => el.classList.add('rolling'), 4200);
    roll.addEventListener('animationend', showDone);
    setTimeout(showDone, 40000);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-fin]');
      if (!b) return;
      if (b.dataset.fin === 'skip') { showDone(); el.classList.add('rolling', 'skipped'); }
      else finish();
    });
  },

  showWin(n, stars, score) {
    if (n === 180 && !Save.data.help.finale) {
      this.showFinale(() => this.openMap());
      return;
    }
    const w = worldOf(n);
    const msg = Lines.win(w);
    const [kick, head] = w === 2 ? [`Scene ${n}`, "That's a wrap!"] : w === 3 ? [`Order ${n}`, 'Delicious!'] : w === 4 ? [`Day ${n - 90}`, 'That’s a print!'] : w === 5 ? [`Track ${n - 120}`, 'Encore!']
      : w === 6 ? [`Category ${n}`, 'Winner!'] : [`Level ${n}`, 'Complete!'];
    Pip.react('cheer', 3000);
    this.showModal(`
      <img class="pip pip-card pip-win" src="${Pip.url(w, 'cheer')}" alt="Pip">
      <div class="panel-kicker">${kick}</div>
      <div class="panel-title">${head}</div>
      <div class="big-stars">${[1, 2, 3].map(i =>
        `<span class="bstar${i <= stars ? ' on' : ''}" style="animation-delay:${(0.75 + i * 0.3).toFixed(2)}s">★</span>`).join('')}</div>
      <div class="panel-score">${score.toLocaleString()}</div>
      ${msg ? `<div class="panel-msg">${esc(msg)}</div>` : ''}
      <div class="panel-btns">
        <button class="btn btn-big" data-act="next">Next level</button>
        ${stars < 3 ? `<button class="btn" data-act="again">↻ Play again for ★★★</button>` : ''}
        <button class="btn btn-ghost" data-act="map">Level map</button>
      </div>`,
      { next: () => (worldOf(n + 1) > (Save.data.help.world || 1) ? this.showIntro(n + 1) : Game.startLevel(n + 1)),
        again: () => Game.startLevel(n),
        map: () => this.openMap() });
    Confetti.burst(160);
    Sound.play('heelClicks');
    Sound.play('fanfare', 0.55);
    for (let i = 1; i <= stars; i++) Sound.play('star', 0.85 + i * 0.3, i);
  },

  showLose(lv) {
    const left = lv.goals.filter(g => (g.type === 'score' ? Game.score < g.need : g.have < g.need));
    const w = worldOf(lv.n);
    const take = (Save.data.progress.fails[lv.n] || 0) + 1;
    const [kick, head, again] = w === 2 ? [`Scene ${lv.n} · Take ${take - 1}`, 'Cut!', `Take ${take}`]
      : w === 3 ? [`Order ${lv.n}`, 'Out of snacks!', 'Try again']
      : w === 4 ? [`Day ${lv.n - 90}`, 'We lost the light!', 'Go again']
      : w === 5 ? [`Track ${lv.n - 120}`, 'The music stopped!', 'Play it again']
      : w === 6 ? [`Category ${lv.n}`, 'So close!', 'Try again'] : [`Level ${lv.n}`, 'Out of moves', 'Try again'];
    this.showModal(`
      <div class="panel-kicker">${kick}</div>
      <div class="panel-title">${head}</div>
      ${w === 2 ? `<div class="panel-note">Let's go again from the top.</div>` : ''}
      <div class="panel-label">Still to go</div>
      <div class="goal-rows">${this.goalRows(left, false)}</div>
      <div class="panel-btns">
        ${Save.data.boosters.moves > 0
          ? `<button class="btn btn-big btn-gold" data-act="more">+5 moves <small>(${Save.data.boosters.moves} left)</small></button>`
          : ''}
        <button class="btn btn-big" data-act="retry">${again}</button>
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
    let html = '<div class="scene scene-road"><div class="bg-glow"></div><div class="bg-moon"></div>';

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
    </svg></div>`;
    html += this.stage();
    html += this.craft();
    html += this.location();
    html += this.party();
    html += this.awards();

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

  // World 3: the crafty table — string lights, a striped tent, a gingham table in perspective.
  craft() {
    const rnd = seededRandom(6161);
    let bulbs = '';
    for (let i = 0; i < 15; i++) {
      const x = 3 + i * 6.7, sag = Math.sin((i / 14) * Math.PI) * 5;
      const c = ['#FFE08A', '#FFA3CF', '#8BE6DF'][i % 3];
      bulbs += `<i class="bulb" style="left:${x.toFixed(1)}%;top:${(7 + sag).toFixed(1)}vh;--c:${c};` +
               `animation-delay:-${(rnd() * 3).toFixed(2)}s"></i>`;
    }
    let steam = '';
    [22, 47, 74].forEach((x, i) => {
      for (let k = 0; k < 2; k++) {
        steam += `<i class="steam" style="left:${(x + k * 3).toFixed(1)}%;animation-delay:-${(i * 1.1 + k * 1.7).toFixed(1)}s"></i>`;
      }
    });
    return `<div class="scene scene-craft">
      <div class="cr-tent"></div>
      <svg class="cr-lights" viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 6 Q50 18 100 6"/></svg>
      ${bulbs}
      <div class="cr-table"><div class="table-plane"></div></div>
      <div class="cr-food">
        <i class="f-urn"></i><i class="f-cake"></i><i class="f-bowl"></i><i class="f-pot"></i>
      </div>
      ${steam}
    </div>`;
  },

  // World 4: on location — golden-hour desert, mesas, base-camp trailers, a dirt road.
  location() {
    const rnd = seededRandom(9191);
    let dust = '';
    for (let i = 0; i < 14; i++) {
      dust += `<i class="dust" style="left:${(rnd() * 100).toFixed(1)}%;top:${(56 + rnd() * 40).toFixed(1)}%;` +
              `animation-delay:-${(rnd() * 8).toFixed(1)}s;animation-duration:${(6 + rnd() * 6).toFixed(1)}s"></i>`;
    }
    return `<div class="scene scene-loc">
      <div class="lo-sky"></div>
      <div class="lo-sun"></div>
      <svg class="lo-mesas" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60 L0 34 L28 34 L34 22 L78 22 L86 36 L120 36 L126 30 L150 30 L158 42 L210 42 L216 26 L262 26 L270 14 L300 14 L308 30 L346 30 L352 38 L400 38 L400 60Z" fill="#7a3b4f" opacity=".75"/>
        <path d="M0 60 L0 46 L60 46 L68 38 L110 38 L118 48 L180 48 L230 50 L290 44 L300 36 L338 36 L346 48 L400 48 L400 60Z" fill="#5a2a40"/>
      </svg>
      <div class="lo-ground"></div>
      <div class="lo-road"><div class="dirt-plane"></div></div>
      <div class="lo-camp">
        <i class="trailer t1"></i><i class="trailer t2"></i><i class="tent"></i><i class="cactus-s c1"></i><i class="cactus-s c2"></i>
      </div>
      <i class="tumble"></i>
      ${dust}
    </div>`;
  },

  // World 5: the wrap party — neon grid dance floor, disco ball, light beams, equalizer.
  party() {
    const rnd = seededRandom(1212);
    let eq = '';
    for (let i = 0; i < 24; i++) {
      eq += `<i style="animation-delay:-${(rnd() * 1.2).toFixed(2)}s;animation-duration:${(0.6 + rnd() * 0.7).toFixed(2)}s"></i>`;
    }
    let dots = '';
    for (let i = 0; i < 26; i++) {
      const c = ['#ff5fb4', '#5ff2ff', '#b48cff', '#ffe08a', '#7CC243'][i % 5];
      dots += `<i class="pd" style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 60).toFixed(1)}%;--c:${c};` +
              `animation-delay:-${(rnd() * 4).toFixed(2)}s;animation-duration:${(2.5 + rnd() * 3).toFixed(2)}s"></i>`;
    }
    return `<div class="scene scene-party">
      <div class="pa-sky"></div>
      <div class="beam b1"></div><div class="beam b2"></div><div class="beam b3"></div><div class="beam b4"></div>
      <div class="pa-ball"></div>
      ${dots}
      <div class="pa-sign"><span>That's a</span>WRAP!</div>
      <div class="pa-eq">${eq}</div>
      <div class="pa-floor"><div class="grid-plane"></div></div>
    </div>`;
  },

  // World 6: awards night — turquoise carpet, velvet ropes, flashes, searchlights.
  awards() {
    const rnd = seededRandom(9090);
    let flashes = '';
    for (let i = 0; i < 18; i++) {
      const left = i % 2 ? 4 + rnd() * 22 : 74 + rnd() * 22;
      flashes += `<i class="flash" style="left:${left.toFixed(1)}%;top:${(52 + rnd() * 36).toFixed(1)}%;` +
                 `animation-delay:-${(rnd() * 6).toFixed(2)}s;animation-duration:${(3.5 + rnd() * 4).toFixed(2)}s"></i>`;
    }
    let posts = '';
    // velvet-rope posts along both sides of the carpet, in perspective
    for (let i = 0; i < 6; i++) {
      const t = i / 5;                                   // 0 = far, 1 = near
      const y = 52 + t * 44, spread = 6 + t * 30, h = 2.2 + t * 6.5;
      posts += `<i class="post" style="left:${(50 - spread).toFixed(1)}%;top:${y.toFixed(1)}%;height:${h.toFixed(1)}vh"></i>` +
               `<i class="post" style="left:${(50 + spread).toFixed(1)}%;top:${y.toFixed(1)}%;height:${h.toFixed(1)}vh"></i>`;
    }
    return `<div class="scene scene-awards">
      <div class="aw-sky"></div>
      <div class="search s1"></div><div class="search s2"></div><div class="search s3"></div>
      <div class="aw-stage"><div class="aw-arch"></div><div class="aw-trophy"></div></div>
      <div class="aw-ground"></div>
      <div class="aw-carpet"><div class="carpet-plane"><div class="carpet-sheen-move"></div></div></div>
      <svg class="aw-ropes" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M44 52 Q42 60 39 62 Q33 72 29 74 Q22 84 20 96" />
        <path d="M56 52 Q58 60 61 62 Q67 72 71 74 Q78 84 80 96" />
      </svg>
      ${posts}${flashes}
    </div>`;
  },

  // World 2: a theater stage — curtains, marquee bulbs, sweeping spotlights.
  stage() {
    let bulbs = '';
    for (let i = 0; i < 26; i++) bulbs += `<i style="animation-delay:${(i % 3) * 0.35}s"></i>`;
    const chair = `<svg class="prop prop-chair" viewBox="0 0 60 70"><g fill="#0d0912">
        <rect x="8" y="10" width="44" height="14" rx="2"/><rect x="8" y="34" width="44" height="6" rx="2"/>
        <rect x="10" y="10" width="4" height="58"/><rect x="46" y="10" width="4" height="58"/>
        <path d="M12 40 L48 68 L44 70 L10 44Z"/><path d="M48 40 L12 68 L16 70 L50 44Z"/></g>
        <text x="30" y="21" text-anchor="middle" font-size="8" font-weight="700" fill="#F4B83A" font-family="Fredoka, sans-serif">${esc(CONFIG.playerName.toUpperCase())}</text></svg>`;
    const camera = `<svg class="prop prop-camera" viewBox="0 0 70 80"><g fill="#0d0912">
        <circle cx="20" cy="14" r="11"/><circle cx="42" cy="14" r="11"/>
        <rect x="10" y="22" width="40" height="22" rx="3"/><path d="M50 27 L66 20 L66 46 L50 39Z"/>
        <path d="M30 44 L14 80 L18 80 L30 52 L42 80 L46 80Z"/><rect x="28" y="44" width="4" height="36"/></g>
        <circle cx="20" cy="14" r="4" fill="#3a2a40"/><circle cx="42" cy="14" r="4" fill="#3a2a40"/></svg>`;
    return `<div class="scene scene-stage">
      <div class="stage-wall"></div>
      <div class="stage-spot s1"></div><div class="stage-spot s2"></div><div class="stage-spot s3"></div>
      <div class="stage-floor"><div class="floor-plane"></div></div>
      <div class="stage-pool"></div>
      ${chair}${camera}
      <div class="curtain curtain-l"></div><div class="curtain curtain-r"></div>
      <div class="valance"></div>
      <div class="marquee">${bulbs}</div>
    </div>`;
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
    const W = 1200, H = 150;   // wide, so big screens show more city instead of zooming in
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
      <g>${towers(95, 45, 100, 'url(#cityFar)', false)}</g>
      <g filter="url(#cityGlow)">${towers(90, 22, 72, 'url(#cityNear)', true)}</g>
    </svg>`;
  },
};


/* ---------- 12. BOOT ---------- */
function boot() {
  // ?reset=1 → start this device over from level 1.
  if (new URLSearchParams(location.search).get('reset') === '1') {
    try { localStorage.removeItem('msalon.save'); localStorage.removeItem('msalon.save.bak'); } catch (e) {}
    location.replace(location.pathname);
    return;
  }
  Save.load();
  Render.init();
  Input.init();
  UI.init();
  Background.init();
  Pip.mount();
  const titlePip = document.createElement('img');
  titlePip.id = 'titlePip';
  titlePip.className = 'pip pip-title';
  titlePip.alt = 'Pip';
  titlePip.src = Pip.url(World.current, 'happy');
  $('screenTitle').appendChild(titlePip);
  titlePip.addEventListener('click', () => { Sound.play('button'); UI.showPipStyle(); });

  // One-time: carry over levels she beat on the old link (only via ?beat=N).
  const p = Save.data.progress, h = Save.data.help;
  const beat = parseInt(new URLSearchParams(location.search).get('beat'), 10);
  if (beat > 0 && beat <= 500 && beat + 1 > p.unlocked) {   // only ever moves progress forward
    for (let n = 1; n <= beat; n++) if (!p.stars[n]) p.stars[n] = 1;
    p.unlocked = Math.max(p.unlocked, beat + 1);
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
window.__game = { Board, Game, Save, Render, Loop, FX, UI, Tweens, BOMB, makeTile, buildLevel, LEVELS, Pip, World,
                  Sound, Music, Particles, Shake, Confetti, Daily };
