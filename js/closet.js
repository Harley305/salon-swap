'use strict';
/* =========================================================
   Myesha's Salon Swap — js/closet.js
   Pip's closet: every Pip look is built from pieces — face, hair, hair color,
   outfit, head accessory and jewelry — so she can mix and match them.
   The six world looks and the three Mimi looks are just ready-made outfits
   built from these pieces. Hair colors and piece names live in js/config.js.
   ========================================================= */

/* ----- Ready-made looks ----- */
const WORLD_LOOKS = {
  1: { face: 'pip', hair: 'bun',      color: '#3B2416', outfit: 'none', head: 'scrunchie', jewels: [] },
  2: { face: 'pip', hair: 'bigcurls', color: '#7A3B1F', outfit: 'none', head: 'headset',   jewels: [] },
  3: { face: 'pip', hair: 'beehive',  color: '#A4652F', outfit: 'none', head: 'headband',  jewels: [] },
  4: { face: 'pip', hair: 'braids',   color: '#2A1A10', outfit: 'none', head: 'sunhat',    jewels: [] },
  5: { face: 'pip', hair: 'bob',      color: '#4B2E6E', outfit: 'none', head: 'shades',    jewels: [] },
  6: { face: 'pip', hair: 'waves',    color: '#E5BE6E', outfit: 'none', head: 'clip',      jewels: [] },
};
const MIMI_LOOKS = {
  curls:  { face: 'mimi', hair: 'mcurls',    color: '#1A1012', outfit: 'blazer',  head: 'none', jewels: ['necklaces', 'stud', 'septum'],          lips: 'plum' },
  twists: { face: 'mimi', hair: 'twists',    color: '#5E1A24', outfit: 'mustard', head: 'none', jewels: ['cords', 'stud', 'hoop', 'septum'],     lips: 'mauve' },
  braids: { face: 'mimi', hair: 'boxbraids', color: '#2E2018', outfit: 'knit',    head: 'none', jewels: ['stud', 'septum'],                      lips: 'deepplum', liner: true },
};

/* ----- Closet pieces: name + how it's unlocked ('free', 'pipN' = that world's look from the shop, 'mimi' = after the Oz finale).
   To add a new piece: add a line here, then draw it in drawLook() below under the matching step
   (outfit = step 2, hair = steps 4 + 6, head accessory = step 7). Hair colors are in js/config.js. ----- */
const CLOSET = {
  face: [
    { id: 'pip',  name: 'Pip',  unlock: 'free' },
    { id: 'mimi', name: 'Mimi', unlock: 'mimi' },
  ],
  hair: [
    { id: 'bun',       name: 'Top bun',      unlock: 'free' },
    { id: 'bigcurls',  name: 'Big curls',    unlock: 'pip2' },
    { id: 'beehive',   name: 'Beehive',      unlock: 'pip3' },
    { id: 'braids',    name: 'Side braids',  unlock: 'pip4' },
    { id: 'bob',       name: 'Neon bob',     unlock: 'pip5' },
    { id: 'waves',     name: 'Glam waves',   unlock: 'pip6' },
    { id: 'mcurls',    name: 'Mimi curls',   unlock: 'mimi' },
    { id: 'twists',    name: 'Twists',       unlock: 'mimi' },
    { id: 'boxbraids', name: 'Box braids',   unlock: 'mimi' },
  ],
  outfit: [
    { id: 'none',    name: 'Just Pip',     unlock: 'free' },
    { id: 'turq',    name: 'Turquoise top', unlock: 'free' },
    { id: 'blazer',  name: 'Blazer',       unlock: 'mimi' },
    { id: 'mustard', name: 'Mustard wrap', unlock: 'mimi' },
    { id: 'knit',    name: 'Cozy knit',    unlock: 'mimi' },
  ],
  head: [
    { id: 'none',      name: 'Nothing',      unlock: 'free' },
    { id: 'scrunchie', name: 'Scrunchie',    unlock: 'free' },
    { id: 'headset',   name: 'Crew headset', unlock: 'pip2' },
    { id: 'headband',  name: 'Headband',     unlock: 'pip3' },
    { id: 'sunhat',    name: 'Sun hat',      unlock: 'pip4' },
    { id: 'shades',    name: 'Heart shades', unlock: 'pip5' },
    { id: 'clip',      name: 'Emerald clip', unlock: 'pip6' },
  ],
  jewels: [
    { id: 'necklaces', name: 'Gold layers', unlock: 'mimi' },
    { id: 'cords',     name: 'Black cords', unlock: 'mimi' },
    { id: 'hoop',      name: 'Gold hoop',   unlock: 'mimi' },
    { id: 'stud',      name: 'Gold stud',   unlock: 'mimi', face: 'mimi' },
    { id: 'septum',    name: 'Septum ring', unlock: 'mimi', face: 'mimi' },
  ],
  lips: [
    { id: 'plum',     name: 'Plum',      color: ['#6B3138', '#9A5560'] },
    { id: 'mauve',    name: 'Mauve',     color: ['#7A4A4E', '#A87478'] },
    { id: 'deepplum', name: 'Deep plum', color: ['#4E2A30', '#734650'] },
    { id: 'berry',    name: 'Berry',     color: ['#9C3456', '#C9708C'] },
  ],
};
const HAIR_DEFAULT_COLOR = { bun: '#3B2416', bigcurls: '#7A3B1F', beehive: '#A4652F', braids: '#2A1A10', bob: '#4B2E6E', waves: '#E5BE6E',
                             mcurls: '#1A1012', twists: '#5E1A24', boxbraids: '#2E2018' };

/* The look spec for anything Pip can wear: a world number, 'mimi-curls', 'custom', or a spec object. */
function lookSpec(look) {
  if (look && typeof look === 'object') return look;
  if (look === 'custom') return (Save.data && Save.data.settings.closet) || WORLD_LOOKS[1];
  if (typeof look === 'string' && look.startsWith('mimi-')) return MIMI_LOOKS[look.slice(5)] || MIMI_LOOKS.curls;
  return WORLD_LOOKS[look] || WORLD_LOOKS[1];
}

/* Draw Pip (or Mimi) in a 100 × 120 box from a look spec. */
function drawLook(ctx, spec, mood, toneIdx) {
  const isMimi = spec.face === 'mimi';
  const [skinTop, skinBot] = isMimi ? ['#B07448', '#8A5534'] : (Pip.TONES[toneIdx] || Pip.TONES[2]);
  const hairStyle = spec.hair || 'bun';
  const dflt = HAIR_DEFAULT_COLOR[hairStyle];
  const hair = spec.color || dflt;
  const custom = hair.toLowerCase() !== (dflt || '').toLowerCase();
  const tint = (c, amt) => mixHex(hair, c, amt);
  const has = j => (spec.jewels || []).includes(j);
  const GOLD = '#E2B54E';
  const circle = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const skinG = ctx.createLinearGradient(0, 26, 0, 90);
  skinG.addColorStop(0, skinTop); skinG.addColorStop(1, skinBot);

  // Mimi's hair shades (exact originals unless she picked a new color)
  const M_HI = custom ? tint('#FFFFFF', 0.22) : '#4A3236';
  const TW = hair, TW_HI = custom ? tint('#FFFFFF', 0.35) : '#9C3442';
  const TW_CAP = custom ? tint('#000000', 0.38) : '#3A1218', TW_TEX = custom ? tint('#FFFFFF', 0.35) + '8C' : 'rgba(160,60,72,.55)';
  const BR_A = hair, BR_B = custom ? tint('#FFFFFF', 0.25) : '#5C4330', BR_L = custom ? tint('#FFFFFF', 0.42) : '#8A6A4C';
  const BR_SEC = custom ? BR_L + '8C' : 'rgba(138,106,76,.55)';

  const curl = (x, y, r) => {                               // one spiral ringlet
    circle(x, y, r, hair);
    ctx.strokeStyle = M_HI; ctx.lineWidth = Math.max(0.9, r * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.05, r * 0.55, Math.PI * 1.05, Math.PI * 2.2); ctx.stroke();
  };
  const rope = (pts, w, wraps = []) => {                    // one rope twist, with gold thread wraps
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
      const n = Math.max(1, Math.round(len / (w * 0.9)));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang + ((k + i) % 2 ? 0.5 : -0.5));
        ctx.fillStyle = TW; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TW_HI; ctx.beginPath(); ctx.ellipse(-w * 0.12, -w * 0.15, w * 0.3, w * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    wraps.forEach(f => {
      const seg = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1))), t = f * (pts.length - 1) - seg;
      const [x1, y1] = pts[seg], [x2, y2] = pts[seg + 1];
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, ang = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 0.7;
      for (let j = -0.5; j <= 0.5; j += 1) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * w * 0.5 + j * 1.1 * Math.cos(ang - Math.PI / 2), y + Math.sin(ang) * w * 0.5 + j * 1.1 * Math.sin(ang - Math.PI / 2));
        ctx.lineTo(x - Math.cos(ang) * w * 0.5 + j * 1.1 * Math.cos(ang - Math.PI / 2), y - Math.sin(ang) * w * 0.5 + j * 1.1 * Math.sin(ang - Math.PI / 2));
        ctx.stroke();
      }
    });
  };
  const braid = (pts, w, light) => {                        // one box braid: plaited chevrons
    const A = BR_A, B = light ? BR_L : BR_B;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
      const n = Math.max(1, Math.round(len / (w * 0.75)));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = A; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, w * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = B;
        ctx.beginPath(); ctx.ellipse(0, -w * 0.18, w * 0.42, w * 0.2, 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, w * 0.18, w * 0.42, w * 0.2, -0.55, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  };

  // ---- 1. neck + stand
  if (isMimi) {
    ctx.fillStyle = skinBot; rr(ctx, 42, 78, 16, 16, 4); ctx.fill();
  } else {
    ctx.fillStyle = skinBot; rr(ctx, 42, 80, 16, 22, 4); ctx.fill();
  }
  const baseG = ctx.createLinearGradient(0, 100, 0, 116);
  baseG.addColorStop(0, '#3AAFA9'); baseG.addColorStop(1, '#1D7470');
  ctx.fillStyle = baseG; ctx.beginPath(); ctx.ellipse(50, 108, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (!isMimi) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(46, 105, 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- 2. outfit
  const o = spec.outfit || 'none';
  if (o === 'knit') {
    ctx.fillStyle = '#1E1C22';
    ctx.beginPath(); ctx.moveTo(29, 104); ctx.quadraticCurveTo(29, 89, 42, 87); ctx.quadraticCurveTo(50, 91, 58, 87);
    ctx.quadraticCurveTo(71, 89, 71, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3A3742'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(42, 87.5); ctx.quadraticCurveTo(50, 92, 58, 87.5); ctx.stroke();
    ctx.lineWidth = 1;
    for (const cx of [37, 50, 63]) {
      for (let y = 93; y < 104; y += 3.4) { ctx.beginPath(); ctx.moveTo(cx - 2, y); ctx.quadraticCurveTo(cx, y + 2, cx + 2, y); ctx.stroke(); }
    }
  } else if (o === 'mustard') {
    ctx.fillStyle = '#D9A93A';
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.quadraticCurveTo(30, 90, 42, 88); ctx.lineTo(50, 103); ctx.lineTo(58, 88);
    ctx.quadraticCurveTo(70, 90, 70, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#B88A24'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(42, 88); ctx.lineTo(50, 103); ctx.lineTo(58, 88); ctx.stroke();
  } else if (o === 'blazer') {
    ctx.fillStyle = '#16161C';
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.quadraticCurveTo(30, 90, 42, 88); ctx.lineTo(50, 102); ctx.lineTo(58, 88);
    ctx.quadraticCurveTo(70, 90, 70, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#33333D'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(42, 88); ctx.lineTo(46, 97); ctx.moveTo(58, 88); ctx.lineTo(54, 97); ctx.stroke();
  } else if (o === 'turq') {                                // her color: a turquoise scoop-neck top
    ctx.fillStyle = '#3AAFA9';
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.quadraticCurveTo(30, 90, 42, 88); ctx.quadraticCurveTo(50, 96, 58, 88);
    ctx.quadraticCurveTo(70, 90, 70, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1D7470'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(42, 88); ctx.quadraticCurveTo(50, 96, 58, 88); ctx.stroke();
  }

  // ---- 3. neck jewelry
  if (has('cords')) {
    ctx.strokeStyle = '#1A1012'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(44, 86); ctx.lineTo(49, 99); ctx.moveTo(56, 86); ctx.lineTo(51, 99); ctx.moveTo(45.5, 86); ctx.lineTo(50.5, 101); ctx.stroke();
  }
  if (has('necklaces')) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(43, 86); ctx.quadraticCurveTo(50, 92, 57, 86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(42.5, 86); ctx.quadraticCurveTo(50, 97, 57.5, 86); ctx.stroke();
    ctx.fillStyle = '#C7C9D3'; ctx.beginPath(); ctx.arc(50, 91.5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C4472F'; ctx.beginPath(); ctx.moveTo(48.6, 95.5); ctx.lineTo(51.4, 95.5); ctx.lineTo(51.4, 99); ctx.lineTo(50, 101); ctx.lineTo(48.6, 99); ctx.closePath(); ctx.fill();
    ctx.fillStyle = GOLD; ctx.fillRect(48.4, 94.6, 3.2, 1.2);
  }

  // ---- 4. hair behind the head
  if (hairStyle === 'braids') {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) circle(50 + side * 26, 62 + i * 9, 6.5 - i * 0.5, hair);
      circle(50 + side * 26, 106, 3.5, '#EC5FA5');
    }
  } else if (hairStyle === 'bigcurls') {
    [[24, 44], [20, 58], [24, 72], [76, 44], [80, 58], [76, 72], [32, 30], [68, 30], [50, 24], [38, 24], [62, 24]]
      .forEach(([x, y]) => circle(x, y, 11, hair));
  } else if (hairStyle === 'waves') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(22, 46);
    ctx.bezierCurveTo(14, 70, 26, 80, 18, 96);
    ctx.bezierCurveTo(30, 100, 34, 88, 32, 78);
    ctx.lineTo(68, 78);
    ctx.bezierCurveTo(66, 88, 70, 100, 82, 96);
    ctx.bezierCurveTo(74, 80, 86, 70, 78, 46);
    ctx.closePath(); ctx.fill();
  } else if (hairStyle === 'boxbraids') {
    ctx.fillStyle = BR_A; ctx.beginPath(); ctx.ellipse(50, 42, 28, 20, 0, Math.PI, 0); ctx.fill();
    [[[30, 40], [22, 60], [19, 82], [20, 106]], [[34, 38], [27, 58], [25, 82], [26, 108]], [[26, 46], [17, 66], [14, 88], [15, 104]],
     [[70, 40], [78, 60], [81, 82], [80, 106]], [[66, 38], [73, 58], [75, 82], [74, 108]], [[74, 46], [83, 66], [86, 88], [85, 104]]]
      .forEach((p, i) => braid(p, 5.6, i % 2 === 1));
  } else if (hairStyle === 'twists') {
    ctx.fillStyle = TW; ctx.beginPath(); ctx.ellipse(48, 38, 27, 18, 0, Math.PI, 0); ctx.fill();
    rope([[40, 22], [30, 30], [22, 44], [18, 60], [18, 76], [22, 92], [26, 104]], 7.5, [0.35, 0.7]);
    rope([[46, 20], [34, 32], [27, 48], [24, 64], [25, 80], [30, 96], [34, 106]], 7, [0.5, 0.85]);
    rope([[34, 26], [24, 38], [16, 52], [13, 68], [14, 84], [18, 98]], 6.5, [0.6]);
    rope([[52, 18], [44, 14], [36, 16], [30, 22]], 6.5, [0.4]);
    rope([[58, 20], [50, 12], [42, 10], [36, 13]], 6, []);
    rope([[74, 46], [78, 60], [78, 74]], 5, []);
  } else if (hairStyle === 'mcurls') {
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.ellipse(50, 40, 29, 20, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(21, 40); ctx.bezierCurveTo(12, 60, 12, 84, 18, 100); ctx.lineTo(34, 100); ctx.bezierCurveTo(30, 80, 28, 60, 30, 42); ctx.closePath(); ctx.fill();
    [[20, 48, 8.5], [15, 60, 9.5], [14, 72, 10], [16, 84, 9.5], [20, 95, 9], [28, 102, 7], [25, 66, 8.5], [26, 80, 8.5], [32, 92, 7]]
      .forEach(([x, y, r]) => curl(x, y, r));
    [[79, 66, 5.5], [80, 77, 6], [78, 88, 5.5], [74, 96, 4.5]].forEach(([x, y, r]) => curl(x, y, r));
  }

  // ---- 5. head (+ ear on Mimi)
  ctx.fillStyle = skinG; ctx.beginPath(); ctx.ellipse(50, 56, 25, 28, 0, 0, Math.PI * 2); ctx.fill();
  if (isMimi) {
    ctx.fillStyle = skinBot; ctx.beginPath(); ctx.ellipse(75, 59, 3.4, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (has('stud')) circle(75.5, 63.5, 1.1, GOLD);
  }

  // ---- 6. hair on top
  ctx.fillStyle = hair;
  if (hairStyle === 'bun') {
    ctx.beginPath(); ctx.ellipse(50, 42, 26, 17, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, 44); ctx.quadraticCurveTo(36, 34, 50, 40); ctx.quadraticCurveTo(64, 34, 76, 44); ctx.lineTo(76, 40); ctx.lineTo(24, 40); ctx.fill();
    circle(50, 18, 13, hair);
  } else if (hairStyle === 'bigcurls') {
    ctx.beginPath(); ctx.ellipse(50, 40, 27, 15, 0, Math.PI, 0); ctx.fill();
    [[30, 36], [42, 31], [58, 31], [70, 36]].forEach(([x, y]) => circle(x, y, 8, hair));
  } else if (hairStyle === 'beehive') {
    ctx.beginPath(); ctx.ellipse(50, 22, 22, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(50, 42, 26, 14, 0, Math.PI, 0); ctx.fill();
  } else if (hairStyle === 'braids') {
    ctx.beginPath(); ctx.ellipse(50, 42, 26, 14, 0, Math.PI, 0); ctx.fill();
  } else if (hairStyle === 'bob') {
    ctx.beginPath();
    ctx.moveTo(22, 70); ctx.bezierCurveTo(16, 30, 84, 30, 78, 70);
    ctx.lineTo(72, 70); ctx.bezierCurveTo(74, 46, 60, 40, 50, 40); ctx.bezierCurveTo(40, 40, 26, 46, 28, 70);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.strokeStyle = '#FF5FB0'; ctx.beginPath(); ctx.moveTo(32, 38); ctx.quadraticCurveTo(24, 52, 26, 66); ctx.stroke();
    ctx.strokeStyle = '#3EF2E3'; ctx.beginPath(); ctx.moveTo(66, 36); ctx.quadraticCurveTo(76, 50, 74, 66); ctx.stroke();
  } else if (hairStyle === 'waves') {
    ctx.beginPath();
    ctx.moveTo(24, 50); ctx.bezierCurveTo(22, 26, 70, 22, 78, 44);
    ctx.bezierCurveTo(66, 36, 54, 40, 46, 34); ctx.bezierCurveTo(40, 40, 30, 42, 24, 50);
    ctx.fill();
  } else if (hairStyle === 'boxbraids') {
    ctx.fillStyle = BR_A;
    ctx.beginPath(); ctx.moveTo(25, 52); ctx.bezierCurveTo(22, 24, 78, 24, 75, 52);
    ctx.bezierCurveTo(70, 40, 58, 37, 50, 38); ctx.bezierCurveTo(42, 37, 30, 40, 25, 52); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8A5A3C'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(50, 38); ctx.lineTo(50, 27); ctx.stroke();
    ctx.strokeStyle = BR_SEC; ctx.lineWidth = 0.9;
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(50 + sx * (4 + i * 7), 38 - i * 0.6); ctx.quadraticCurveTo(50 + sx * (6 + i * 8), 31, 50 + sx * (2 + i * 6), 27); ctx.stroke();
    }
    braid([[31, 42], [26, 56], [24, 72], [24, 90]], 5.4, true);
    braid([[69, 42], [74, 56], [76, 72], [76, 90]], 5.4, false);
  } else if (hairStyle === 'twists') {
    ctx.fillStyle = TW_CAP;
    ctx.beginPath(); ctx.moveTo(25, 50); ctx.bezierCurveTo(22, 22, 78, 22, 75, 50);
    ctx.bezierCurveTo(68, 40, 58, 37, 50, 37); ctx.bezierCurveTo(40, 37, 30, 42, 25, 50); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = TW_TEX; ctx.lineWidth = 1;
    for (let x = 36; x <= 70; x += 5) { ctx.beginPath(); ctx.moveTo(x, 38); ctx.quadraticCurveTo(x - 6, 31, x - 14, 27); ctx.stroke(); }
    rope([[46, 30], [36, 34], [28, 44], [25, 58], [26, 72]], 6.5, [0.3, 0.75]);
  } else if (hairStyle === 'mcurls') {
    ctx.beginPath();
    ctx.moveTo(68, 32);
    ctx.bezierCurveTo(58, 28, 36, 28, 27, 40);
    ctx.bezierCurveTo(22, 50, 24, 62, 27, 72);
    ctx.bezierCurveTo(31, 60, 34, 48, 44, 42);
    ctx.bezierCurveTo(54, 37, 62, 36, 68, 32);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(68, 32); ctx.bezierCurveTo(74, 36, 76, 44, 74, 52); ctx.lineTo(71, 52);
    ctx.bezierCurveTo(72, 44, 70, 38, 66, 35); ctx.closePath(); ctx.fill();
    [[44, 28, 5], [35, 31, 5.5], [27, 38, 6], [22, 48, 6.5], [27, 50, 5.5], [25, 61, 6], [27, 72, 5.5]].forEach(([x, y, r]) => curl(x, y, r));
    ctx.strokeStyle = M_HI; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(60, 33); ctx.quadraticCurveTo(46, 33, 36, 42); ctx.stroke();
  }

  // ---- 7. head accessory
  const h = spec.head || 'none';
  if (h === 'scrunchie') {
    ctx.fillStyle = '#3AAFA9'; rr(ctx, 38, 27, 24, 6, 3); ctx.fill();
    ctx.fillStyle = '#8BE6DF'; rr(ctx, 42, 28, 6, 3, 1.5); ctx.fill();
  } else if (h === 'headset') {
    ctx.strokeStyle = '#2A2A33'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(50, 50, 30, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    circle(22, 58, 6, '#2A2A33');
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(23, 62); ctx.quadraticCurveTo(26, 74, 38, 74); ctx.stroke();
    circle(39, 74, 2.6, '#EC5FA5');
  } else if (h === 'headband') {
    ctx.fillStyle = '#EC5FA5'; rr(ctx, 25, 37, 50, 6, 3); ctx.fill();
  } else if (h === 'sunhat') {
    ctx.fillStyle = '#E8C77E';
    ctx.beginPath(); ctx.ellipse(50, 34, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(50, 26, 20, 14, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3AAFA9'; ctx.fillRect(30, 28, 40, 5);
    ctx.strokeStyle = 'rgba(122,82,8,.35)'; ctx.lineWidth = 1.2;
    for (let x = 16; x <= 84; x += 8) { ctx.beginPath(); ctx.moveTo(x, 31); ctx.lineTo(x + 3, 38); ctx.stroke(); }
  } else if (h === 'shades') {
    const heart = (x, y, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x, y + 5);
      ctx.bezierCurveTo(x - 9, y - 1, x - 5, y - 8, x, y - 3);
      ctx.bezierCurveTo(x + 5, y - 8, x + 9, y - 1, x, y + 5); ctx.fill();
    };
    heart(40, 34, '#FF5FB0'); heart(60, 34, '#FF5FB0');
    ctx.strokeStyle = '#FF5FB0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(45, 32); ctx.lineTo(55, 32); ctx.stroke();
  } else if (h === 'clip') {
    ctx.fillStyle = '#F4B83A'; rr(ctx, 60, 33, 12, 5, 2.5); ctx.fill();
    circle(66, 35.5, 3, '#2ECC71');
  }
  // the little shine strokes that belong to the beehive and the waves (drawn after their accessory, as before)
  if (hairStyle === 'beehive') {
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(50, 22, 14, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  } else if (hairStyle === 'waves') {
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(34, 34); ctx.quadraticCurveTo(46, 28, 58, 32); ctx.stroke();
  }
  if (has('hoop')) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(26, 72, 4.5, 6, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // ---- 8. face
  if (isMimi) drawMimiFace(ctx, mood, spec, has); else drawPipFace(ctx, mood, toneIdx);
}

function drawPipFace(ctx, mood, toneIdx) {
  const circle = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const eyeY = 58, ink = toneIdx >= 4 ? '#1A0D12' : '#3A2230';
  const openEye = (x, big) => {
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(x, eyeY, big ? 4.6 : 3.6, big ? 5.4 : 4.4, 0, 0, Math.PI * 2); ctx.fill();
    circle(x + 1.3, eyeY - 1.6, big ? 1.8 : 1.3, '#FFFFFF');
  };
  const arcEye = x => {
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

  ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  if (mood === 'oops') {
    ctx.beginPath(); ctx.moveTo(36, 51); ctx.lineTo(45, 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(64, 51); ctx.lineTo(55, 48); ctx.stroke();
  } else if (mood === 'think') {
    ctx.beginPath(); ctx.moveTo(36, 49); ctx.lineTo(45, 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(55, 47); ctx.lineTo(64, 50); ctx.stroke();
  }

  ctx.fillStyle = toneIdx >= 4 ? 'rgba(236,95,165,.45)' : 'rgba(236,95,165,.32)';
  ctx.beginPath(); ctx.ellipse(34, 67, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(66, 67, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

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
}

function drawMimiFace(ctx, mood, spec, has) {
  const circle = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const lipSet = (CLOSET.lips.find(l => l.id === spec.lips) || CLOSET.lips[0]).color;
  const LIP = lipSet[0], LIP_HI = lipSet[1], BROW = '#1A1012';
  const eyeY = 57, ink = '#1A0D12';
  const lashes = (x, up) => {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    const y = eyeY + (up ? -1 : 2);
    ctx.beginPath(); ctx.moveTo(x - 4.6, y - 1); ctx.lineTo(x - 6.6, y - 3); ctx.moveTo(x + 4.6, y - 1); ctx.lineTo(x + 6.6, y - 3); ctx.stroke();
  };
  const openEye = (x, big) => {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, eyeY, big ? 4.4 : 3.6, big ? 5.2 : 4.4, 0, 0, Math.PI * 2); ctx.fill();
    circle(x + 1.3, eyeY - 1.6, big ? 1.7 : 1.3, '#FFFFFF'); lashes(x, true);
    if (spec.liner) { ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.beginPath(); const s = x < 50 ? -1 : 1;
      ctx.moveTo(x + s * 3.6, eyeY - 2.4); ctx.lineTo(x + s * 7.4, eyeY - 4.8); ctx.stroke(); }
  };
  const arcEye = x => {
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, eyeY + 2, 4.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); lashes(x, false);
  };
  const lineEye = x => { ctx.strokeStyle = ink; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x - 4, eyeY); ctx.lineTo(x + 4, eyeY); ctx.stroke(); };
  if (mood === 'blink') { lineEye(41); lineEye(59); }
  else if (mood === 'cheer' || mood === 'happy') { arcEye(41); arcEye(59); }
  else if (mood === 'wink') { openEye(41); arcEye(59); }
  else if (mood === 'wow') { openEye(41, true); openEye(59, true); }
  else { openEye(41); openEye(59); }
  ctx.strokeStyle = BROW; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (mood === 'oops') {
    ctx.beginPath(); ctx.moveTo(35, 50); ctx.lineTo(45, 47); ctx.moveTo(65, 50); ctx.lineTo(55, 47); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(35, 49); ctx.quadraticCurveTo(40, 45.5, 46, 47.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(54, 47.5); ctx.quadraticCurveTo(60, 45.5, 65, 49); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,35,20,.55)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(47.5, 65); ctx.quadraticCurveTo(50, 67, 52.5, 65); ctx.stroke();
  if (has('septum')) {
    ctx.strokeStyle = '#D9DEE8'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(50, 66.4, 1.7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(205,90,110,.35)';
  ctx.beginPath(); ctx.ellipse(33, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(67, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (mood === 'wow') {
    ctx.fillStyle = LIP; ctx.beginPath(); ctx.ellipse(50, 73, 4.6, 5.4, 0, 0, Math.PI * 2); ctx.fill();
    circle(50, 73.5, 2.6, '#3A1418');
  } else if (mood === 'oops') {
    ctx.strokeStyle = LIP; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(44, 75); ctx.quadraticCurveTo(50, 70, 56, 75); ctx.stroke();
  } else if (mood === 'think') {
    ctx.strokeStyle = LIP; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(45, 73); ctx.quadraticCurveTo(51, 71, 56, 72); ctx.stroke();
  } else {
    const wide = mood === 'cheer' ? 1 : 0.8;
    ctx.fillStyle = LIP;
    ctx.beginPath(); ctx.moveTo(50 - 10 * wide, 69.5);
    ctx.quadraticCurveTo(50, 67.4, 50 + 10 * wide, 69.5);
    ctx.quadraticCurveTo(50, 83 * (wide === 1 ? 1 : 0.98), 50 - 10 * wide, 69.5); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(50 - 8 * wide, 70.4);
    ctx.quadraticCurveTo(50, 69, 50 + 8 * wide, 70.4);
    ctx.quadraticCurveTo(50, 76.5, 50 - 8 * wide, 70.4); ctx.fill();
    ctx.strokeStyle = LIP_HI; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(45, 77.3); ctx.quadraticCurveTo(50, 78.6, 55, 77.3); ctx.stroke();
  }
}

/* Is a closet piece unlocked? */
function closetOwned(piece) {
  if (!piece || piece.unlock === 'free' || !piece.unlock) return true;
  const owned = (Save.data && Save.data.wallet && Save.data.wallet.owned) || {};
  return !!owned[piece.unlock];
}
