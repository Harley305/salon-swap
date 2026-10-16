'use strict';
/* =========================================================
   Myesha's Salon Swap — js/art.js
   Everything drawn in code: tile icons for all six worlds, world settings,
   delivery items and blocker art (gel, ice, chains, boxes).
   ========================================================= */

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

/* ----- World 6: Cinematic Credits (award) tiles ----- */
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
function hexRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* Gel marker look: a light tile with the icon drawn in the tile's own color.
   Only tiles sitting on gel use it; they switch back once the gel is cleared. */
function buildFlipSprite(type, px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';                 // drop shadow
  rr(ctx, 6, 9, 88, 88, 22); ctx.fill();
  const g = ctx.createLinearGradient(0, 4, 0, 94);    // cream-white body
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#ECE6F0');
  ctx.fillStyle = g;
  rr(ctx, 5, 4, 90, 88, 22); ctx.fill();
  ctx.strokeStyle = type.base;                        // thin colored rim
  ctx.lineWidth = 4;
  rr(ctx, 7, 6, 86, 84, 20); ctx.stroke();

  // Draw the normal icon off-screen, then repaint: white → tile color, details → white.
  const ink = mixHex(type.base, type.dark, 0.3);
  const [ir, ig, ib] = hexRgb(ink);
  const ic = document.createElement('canvas');
  ic.width = ic.height = px;
  const ix = ic.getContext('2d');
  ix.scale(px / 100, px / 100);
  ix.translate(50, 49); ix.scale(0.9, 0.9); ix.translate(-50, -50);
  type.draw(ix, type);
  const im = ix.getImageData(0, 0, px, px), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    const k = Math.min(1, Math.max(0, (lum - 0.55) / 0.3));
    d[i]     = Math.round(ir * k + 255 * (1 - k));
    d[i + 1] = Math.round(ig * k + 255 * (1 - k));
    d[i + 2] = Math.round(ib * k + 255 * (1 - k));
  }
  ix.putImageData(im, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = px * 0.02; ctx.shadowOffsetY = px * 0.015;
  ctx.drawImage(ic, 0, 0);
  return c;
}

/* Goal icon for gel: a light tile with a lilac gel drop (matches the gel look on the board). */
function buildGelGoalIcon(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.scale(px / 100, px / 100);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, 6, 9, 88, 88, 22); ctx.fill();
  const g = ctx.createLinearGradient(0, 4, 0, 94);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#ECE6F0');
  ctx.fillStyle = g; rr(ctx, 5, 4, 90, 88, 22); ctx.fill();
  ctx.strokeStyle = '#9B7FD6'; ctx.lineWidth = 4; rr(ctx, 7, 6, 86, 84, 20); ctx.stroke();
  ctx.beginPath();                                   // gel drop
  ctx.moveTo(50, 20);
  ctx.bezierCurveTo(72, 44, 74, 58, 74, 62);
  ctx.bezierCurveTo(74, 76, 63, 84, 50, 84);
  ctx.bezierCurveTo(37, 84, 26, 76, 26, 62);
  ctx.bezierCurveTo(26, 58, 28, 44, 50, 20);
  const dg = ctx.createLinearGradient(0, 20, 0, 84);
  dg.addColorStop(0, '#C9AEF2'); dg.addColorStop(1, '#7A55C4');
  ctx.fillStyle = dg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(40, 58, 5, 9, -0.3, 0, Math.PI * 2); ctx.fill();
  return c;
}

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
  const a = layers > 1 ? 0.42 : 0.26;
  const g = ctx.createRadialGradient(50, 40, 10, 50, 50, 70);
  g.addColorStop(0, `rgba(248,226,255,${a + 0.1})`);
  g.addColorStop(1, `rgba(206,160,240,${a})`);
  ctx.fillStyle = g;
  rr(ctx, 2, 2, 96, 96, 20); ctx.fill();
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
