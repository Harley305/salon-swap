'use strict';
/* =========================================================
   Myesha's Salon Swap — js/progress.js
   Everything she earns: boss & world-clear boosters, coins & gems, the 📋 Call Sheet,
   the 🎬 Career Track and the daily gift.
   ========================================================= */

/* Booster rewards for beating levels (first win only, so replays can't farm them).
   👑 Boss board (every 10th level): 1 random booster.
   Last level of a world (30, 60 … 180): a bundle of 2 of each. */
const LevelRewards = {
  KINDS: ['hammer', 'shuffle', 'moves'],
  NAMES: { hammer: '🔨 Hammer', shuffle: '🌪️ Twister', moves: '+5 Moves' },
  forWin(n) {
    const out = [];
    if (isBoss(n)) {
      const k = this.KINDS[Math.floor(Math.random() * this.KINDS.length)];
      out.push({ label: '👑 Boss reward', items: { [k]: 1 } });
    }
    if (n % 30 === 0 && n <= 180) {
      out.push({ label: '🏆 ' + WORLD_NAMES[worldOf(n)] + ' cleared', items: { hammer: 2, shuffle: 2, moves: 2 } });
    }
    return out;
  },
  give(rewards) {
    const inv = Save.data.boosters;
    rewards.forEach(r => Object.keys(r.items).forEach(k => { inv[k] = (inv[k] || 0) + r.items[k]; }));
  },
  describe(items) {
    return Object.keys(items).map(k => this.NAMES[k] + (items[k] > 1 ? ' ×' + items[k] : '')).join(' · ');
  },
};

/* ---------- Coins & gems ----------
   Coins: 30 for a level's first clear, 10 for a repeat clear, +200 for clearing a world.
   Gems: 3 for clearing a world, +1 when every level in that world has ★★★.
   Coins buy boosters; gems buy looks and bundles. Free boosters still come from
   the Daily Gift and boss / world-clear rewards. */
const MAX_COINS = 99999;
const MAX_GEMS = 999;
const ECON = {
  firstClear: 30, repeatClear: 10,
  worldCoins: 200, worldGems: 3, perfectGems: 1,
  prices: { hammer: 75, shuffle: 60, moves: 90 },
  bundleGems: 3, bundle: { hammer: 3, shuffle: 3, moves: 3 },
  lightTilesGems: 4,
  pipLookGems: 2,
};

const Wallet = {
  get d() { return Save.data.wallet; },
  coins() { return this.d.coins; },
  gems() { return this.d.gems; },
  addCoins(n) { const b = this.d.coins; this.d.coins = Math.min(MAX_COINS, b + n); return this.d.coins - b; },
  addGems(n) { const b = this.d.gems; this.d.gems = Math.min(MAX_GEMS, b + n); return this.d.gems - b; },
  spendCoins(n) { if (this.d.coins < n) return false; this.d.coins -= n; Save.write(); return true; },
  spendGems(n) { if (this.d.gems < n) return false; this.d.gems -= n; Save.write(); return true; },
  owns(id) { return !!this.d.owned[id]; },

  worldDone(w) { return (Save.data.progress.stars[w * 30] || 0) > 0; },
  perfect(w) {
    const st = Save.data.progress.stars;
    for (let n = (w - 1) * 30 + 1; n <= w * 30; n++) if ((st[n] || 0) < 3) return false;
    return true;
  },

  // One time: pay for levels she already cleared before coins existed.
  backpay() {
    const d = this.d;
    if (d.backpaid) return null;
    d.backpaid = true;
    let coins = 0, gems = 0;
    const st = Save.data.progress.stars;
    Object.keys(st).forEach(k => { if (st[k] > 0) coins += ECON.firstClear; });
    for (let w = 1; w <= 6; w++) {
      if (!this.worldDone(w)) continue;
      coins += ECON.worldCoins; gems += ECON.worldGems; d.worldPaid[w] = true;
      if (this.perfect(w)) { gems += ECON.perfectGems; d.perfectPaid[w] = true; }
    }
    this.addCoins(coins); this.addGems(gems);
    Save.write();
    return coins || gems ? { coins, gems } : null;
  },

  // Pay out for a win. Call after the level's stars are saved.
  forWin(n, firstWin) {
    const d = this.d, out = { coins: 0, gems: 0, cards: [] };
    out.coins += this.addCoins(firstWin ? ECON.firstClear : ECON.repeatClear);
    const w = worldOf(n);
    if (n <= 180 && n % 30 === 0 && firstWin && !d.worldPaid[w]) {
      d.worldPaid[w] = true;
      const c = this.addCoins(ECON.worldCoins), g = this.addGems(ECON.worldGems);
      out.coins += c; out.gems += g;
      out.cards.push({ label: '💰 World bonus', text: `🪙 ${c} · 💎 ${g}` });
    }
    if (n <= 180 && d.worldPaid[w] && !d.perfectPaid[w] && this.perfect(w)) {
      d.perfectPaid[w] = true;
      const g = this.addGems(ECON.perfectGems);
      out.gems += g;
      out.cards.push({ label: '✨ Perfect world — all ★★★', text: `💎 +${g}` });
    }
    Save.write();
    return out;
  },
};

/* ---------- 📋 Call Sheet missions ----------
   5 missions (2 easy, 2 medium, 1 hard) every 48 hours, picked from the pool below.
   Each finished mission is claimed for boosters; all 5 = "That's a wrap!" bonus,
   then a bonus mission unlocks (worth a gem). Progress counts during normal play. */
const MISSION_POOL = [
  // easy
  { id: 'e_win',    tier: 0, target: 2,     ev: 'win',     text: m => `Win ${m.target} levels` },
  { id: 'e_play',   tier: 0, target: 3,     ev: 'played',  text: m => `Play ${m.target} levels` },
  { id: 'e_clear',  tier: 0, target: 40,    ev: 'clear',   kind: true, text: m => `Clear ${m.target} ${m.kindPlural}` },
  { id: 'e_line',   tier: 0, target: 3,     ev: 'line',    text: m => `Make ${m.target} Line clears` },
  { id: 'e_gel',    tier: 0, target: 15,    ev: 'gel',     text: m => `Clear ${m.target} gel squares` },
  { id: 'e_drop',   tier: 0, target: 3,     ev: 'drop',    drop: true, text: m => `Bring down ${m.target} ${m.dropPlural}` },
  { id: 'e_score',  tier: 0, target: 60000, ev: 'score',   text: m => `Score ${m.target.toLocaleString()} points` },
  { id: 'e_blast',  tier: 0, target: 2,     ev: 'blast',   text: m => `Make ${m.target} Glitter Blasts` },
  // medium
  { id: 'm_first',  tier: 1, target: 2,     ev: 'firstTry', text: m => `Win ${m.target} levels on the first try` },
  { id: 'm_three',  tier: 1, target: 2,     ev: 'threeStar', text: m => `Earn ★★★ on ${m.target} levels` },
  { id: 'm_clear',  tier: 1, target: 90,    ev: 'clear',   kind: true, text: m => `Clear ${m.target} ${m.kindPlural}` },
  { id: 'm_glam',   tier: 1, target: 2,     ev: 'bomb',    text: m => `Make ${m.target} Glam Balls` },
  { id: 'm_combo',  tier: 1, target: 2,     ev: 'combo',   text: m => `Swap two specials together ${m.target} times` },
  { id: 'm_ice',    tier: 1, target: 12,    ev: 'ice',     minLevel: 20, text: m => `Break ${m.target} ice` },
  { id: 'm_box',    tier: 1, target: 12,    ev: 'box',     minLevel: 20, text: m => `Break ${m.target} boxes` },
  { id: 'm_spare',  tier: 1, target: 1,     ev: 'spare5',  text: () => 'Win a level with 5+ moves left' },
  { id: 'm_line',   tier: 1, target: 8,     ev: 'line',    text: m => `Make ${m.target} Line clears` },
  { id: 'm_score',  tier: 1, target: 150000, ev: 'score',  text: m => `Score ${m.target.toLocaleString()} points` },
  // hard
  { id: 'h_streak', tier: 2, target: 4,     ev: 'win',     streak: true, text: m => `Win ${m.target} levels in a row` },
  { id: 'h_boss',   tier: 2, target: 1,     ev: 'boss',    text: () => 'Beat a 👑 boss board' },
  { id: 'h_first',  tier: 2, target: 4,     ev: 'firstTry', text: m => `Win ${m.target} levels on the first try` },
  { id: 'h_glam',   tier: 2, target: 3,     ev: 'bomb',    text: m => `Make ${m.target} Glam Balls` },
  { id: 'h_three',  tier: 2, target: 4,     ev: 'threeStar', text: m => `Earn ★★★ on ${m.target} levels` },
  { id: 'h_combo',  tier: 2, target: 5,     ev: 'combo',   text: m => `Swap two specials together ${m.target} times` },
];
const TIER_NAMES = ['Easy', 'Medium', 'Hard', 'Bonus'];

const Missions = {
  PERIOD: 48 * 3600 * 1000,
  ANCHOR: new Date(2026, 0, 1).getTime(),           // sheets change at local midnight, every 2 days
  get d() { return Save.data.missions; },
  windowIdx(now = Date.now()) { return Math.floor((now - this.ANCHOR) / this.PERIOD); },
  endsAt() { return this.ANCHOR + (this.windowIdx() + 1) * this.PERIOD; },
  tpl(id) { return MISSION_POOL.find(t => t.id === id); },
  text(m) { const t = this.tpl(m.id); return t ? t.text(m) : m.id; },
  rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },

  make(t, rand, w) {
    const m = { id: t.id, target: t.target, progress: 0, done: false, claimed: false };
    if (t.kind) { const tiles = WORLDS[w].tiles; const k = tiles[Math.floor(rand() * tiles.length)]; m.kindId = k.id; m.kindPlural = k.plural.toLowerCase(); }
    if (t.drop) m.dropPlural = dropItem(w).plural;
    const B = ['hammer', 'shuffle', 'moves'], pick = () => B[Math.floor(rand() * 3)];
    if (t.tier === 0) m.reward = { [pick()]: 1 };
    else if (t.tier === 1) { const a = pick(); let b = pick(); if (b === a) b = B[(B.indexOf(a) + 1) % 3]; m.reward = { [a]: 1, [b]: 1 }; }
    else m.reward = { [pick()]: 2 };
    return m;
  },

  // Make sure the current sheet exists (new one every 48 hours).
  ensure() {
    const d = this.d, idx = this.windowIdx();
    if (d.win === idx && d.list.length) return d;
    const unlocked = Save.data.progress.unlocked;
    const w = Math.min(6, worldOf(unlocked));
    const rand = this.rng(idx * 7919 + 13);
    const pool = MISSION_POOL.filter(t => !t.minLevel || unlocked >= t.minLevel)
      .filter(t => !t.drop || DROP_ITEMS[w]);
    const take = (tier, n, used) => {
      const opts = pool.filter(t => t.tier === tier && !used.has(t.ev));
      const out = [];
      while (out.length < n && opts.length) {
        const t = opts.splice(Math.floor(rand() * opts.length), 1)[0];
        out.push(t); used.add(t.ev);
      }
      return out;
    };
    const used = new Set();
    const chosen = [...take(0, 2, used), ...take(1, 2, used), ...take(2, 1, used)];
    Object.assign(d, { win: idx, world: w, list: chosen.map(t => this.make(t, rand, w)), wrapClaimed: false, bonus: null, streak: 0 });
    Save.write();
    return d;
  },

  allDone() { const d = this.d; return d.list.length && d.list.every(m => m.done); },
  claimable() {
    const d = this.ensure();
    return d.list.some(m => m.done && !m.claimed) || (this.allDone() && !d.wrapClaimed) || (d.bonus && d.bonus.done && !d.bonus.claimed);
  },

  // Gameplay reports what happened; matching missions move forward.
  event(ev, data = {}) {
    if (!Save.data || !Save.data.missions) return;
    if (Save.data.career) Career.event(ev, data);
    const d = this.ensure();
    const list = d.bonus ? [...d.list, d.bonus] : d.list;
    const finished = [];
    list.forEach(m => {
      if (m.done) return;
      const t = this.tpl(m.id);
      if (!t) return;
      if (t.streak && ev === 'lose') { m.progress = 0; return; }
      if (t.ev !== ev) return;
      if (t.kind && data.id !== m.kindId) return;
      m.progress = Math.min(m.target, m.progress + (data.amount || 1));
      if (m.progress >= m.target) { m.done = true; finished.push(m); }
    });
    if (finished.length || ev === 'lose' || ev === 'win') Save.write();
    finished.forEach(m => { if (typeof UI !== 'undefined' && UI.missionDone) UI.missionDone(m); });
  },

  claim(m) {
    if (!m || !m.done || m.claimed) return null;
    m.claimed = true;
    const inv = Save.data.boosters;
    if (m.reward) Object.keys(m.reward).forEach(k => { inv[k] = (inv[k] || 0) + m.reward[k]; });
    if (m.gems) Wallet.addGems(m.gems);
    Save.write();
    return m;
  },
  claimWrap() {
    const d = this.d;
    if (!this.allDone() || d.wrapClaimed) return false;
    d.wrapClaimed = true;
    const inv = Save.data.boosters;
    ['hammer', 'shuffle', 'moves'].forEach(k => { inv[k] = (inv[k] || 0) + 1; });
    Wallet.addCoins(100);
    // unlock the bonus mission
    const used = new Set(d.list.map(m => m.id));
    const hard = MISSION_POOL.filter(t => t.tier === 2 && !used.has(t.id));
    const t = hard[Math.floor(this.rng(d.win * 31 + 7)() * hard.length)] || MISSION_POOL[0];
    const b = this.make(t, this.rng(d.win * 17 + 3), d.world);
    b.reward = null; b.gems = 1; b.bonus = true;
    d.bonus = b;
    Save.write();
    return true;
  },
};

/* ---------- 🎬 Career Track ----------
   A permanent 150-level climb, one challenge at a time, counted during normal play.
   Every level pays a reward (bigger every 10th). Every 25 levels = a promotion
   (new rank title, 2 💎 and a free Pip look). Finishing level 150 unlocks the
   light tile style and 5 💎. Challenges get harder as she climbs. */
const CAREER_MAX = 150;
const CAREER_RANKS = ['Day Player', 'Hair Assistant', 'Key Hairstylist', 'Department Head', 'Award Nominee', 'Hall of Fame'];
const CAREER_TYPES = [
  { t: 'win',      ev: 'win',       min: 1,  goal: L => 2 + Math.floor(L / 15),   text: n => `Win ${n} levels` },
  { t: 'line',     ev: 'line',      min: 1,  goal: L => 3 + Math.floor(L / 6),    text: n => `Make ${n} Line clears` },
  { t: 'clear',    ev: 'clear',     min: 1,  goal: L => 100 + L * 10,             text: n => `Clear ${n.toLocaleString()} tiles` },
  { t: 'score',    ev: 'score',     min: 1,  goal: L => 50000 + L * 2000,         text: n => `Score ${n.toLocaleString()} points` },
  { t: 'firstTry', ev: 'firstTry',  min: 3,  goal: L => 1 + Math.floor(L / 20),   text: n => n === 1 ? 'Win a level on the first try' : `Win ${n} levels on the first try` },
  { t: 'threeStar',ev: 'threeStar', min: 3,  goal: L => 1 + Math.floor(L / 20),   text: n => `Earn ★★★ on ${n} level${n > 1 ? 's' : ''}` },
  { t: 'blast',    ev: 'blast',     min: 4,  goal: L => 2 + Math.floor(L / 10),   text: n => `Make ${n} Glitter Blasts` },
  { t: 'gel',      ev: 'gel',       min: 5,  goal: L => 15 + L,                   text: n => `Clear ${n} gel squares` },
  { t: 'bomb',     ev: 'bomb',      min: 6,  goal: L => 1 + Math.floor(L / 25),   text: n => n === 1 ? 'Make a Glam Ball' : `Make ${n} Glam Balls` },
  { t: 'drop',     ev: 'drop',      min: 8,  goal: L => 2 + Math.floor(L / 15),   text: n => `Bring down ${n} delivery items` },
  { t: 'combo',    ev: 'combo',     min: 10, goal: L => 1 + Math.floor(L / 20),   text: n => n === 1 ? 'Swap two specials together' : `Swap two specials together ${n} times` },
  { t: 'boss',     ev: 'boss',      min: 12, goal: L => 1 + Math.floor(L / 50),   text: n => n === 1 ? 'Beat a 👑 boss board' : `Beat ${n} 👑 boss boards` },
  { t: 'spare',    ev: 'spare5',    min: 14, goal: L => 1 + Math.floor(L / 30),   text: n => n === 1 ? 'Win a level with 5+ moves left' : `Win ${n} levels with 5+ moves left` },
  { t: 'streak',   ev: 'win',       min: 15, goal: L => 2 + Math.floor(L / 30),   text: n => `Win ${n} levels in a row`, streak: true },
  { t: 'blocker',  ev: 'blocker',   min: 25, goal: L => 10 + Math.floor(L / 2),   text: n => `Break ${n} ice, chains or boxes` },
];

const Career = {
  get d() { return Save.data.career; },
  rankOf(L) { return Math.min(CAREER_RANKS.length - 1, Math.floor((Math.min(L, CAREER_MAX) - 1) / 25)); },
  complete() { return this.d.lvl > CAREER_MAX; },

  // The challenge for track level L (always the same for the same level).
  _cache: {},
  challenge(L) {
    if (this._cache[L]) return this._cache[L];
    let prev = null;
    let pick = null;
    for (let i = 1; i <= L; i++) {
      const opts = CAREER_TYPES.filter(c => c.min <= i && c.t !== prev);
      const r = Missions.rng(i * 2654435761 % 2147483647)();
      pick = opts[Math.floor(r * opts.length)];
      prev = pick.t;
    }
    const n = pick.goal(L);
    return (this._cache[L] = { L, type: pick, target: n, text: pick.text(n), reward: this.reward(L) });
  },

  reward(L) {
    if (L === CAREER_MAX) return { gems: 5, light: true, label: '💎 5 + Light tiles' };
    if (L % 25 === 0) return { gems: 2, look: true, boosters: { hammer: 1, shuffle: 1, moves: 1 }, label: '💎 2 + Pip look + 1 of each' };
    if (L % 10 === 0) return { coins: 100, boosters: { hammer: 1, shuffle: 1, moves: 1 }, label: '🪙 100 + 1 of each' };
    if (L % 2 === 0) { const k = ['hammer', 'shuffle', 'moves'][(L / 2) % 3]; return { boosters: { [k]: 1 }, label: { hammer: '🔨', shuffle: '🌪️', moves: '+5' }[k] + ' ×1' }; }
    return { coins: 25 + Math.floor(L / 10) * 5, label: `🪙 ${25 + Math.floor(L / 10) * 5}` };
  },

  give(L) {
    const r = this.reward(L), inv = Save.data.boosters, out = { L, label: r.label };
    if (r.coins) Wallet.addCoins(r.coins);
    if (r.gems) Wallet.addGems(r.gems);
    if (r.boosters) Object.keys(r.boosters).forEach(k => { inv[k] = (inv[k] || 0) + r.boosters[k]; });
    if (r.look) {                                       // a free Pip look she doesn't own yet
      const owned = Save.data.wallet.owned;
      for (let w = 1; w <= 6; w++) if (!owned['pip' + w]) { owned['pip' + w] = true; out.look = w; break; }
    }
    if (r.light) Save.data.wallet.owned.lightTiles = true;
    return out;
  },

  event(ev, data = {}) {
    const d = this.d;
    if (!d || this.complete()) return;
    if (ev === 'ice' || ev === 'chain' || ev === 'box') ev = 'blocker';
    const c = this.challenge(d.lvl);
    if (c.type.streak && ev === 'lose') { d.progress = 0; return; }
    if (c.type.ev !== ev) return;
    d.progress = Math.min(c.target, d.progress + (data.amount || 1));
    if (d.progress < c.target) return;
    // level done → reward, move up
    const got = this.give(d.lvl);
    const rankBefore = this.rankOf(d.lvl);
    d.recent.push({ L: d.lvl, text: c.text, label: got.label });
    if (d.recent.length > 6) d.recent.shift();
    if (d.lvl % 25 === 0 && d.lvl < CAREER_MAX) d.pendingRank = this.rankOf(d.lvl + 1);
    if (d.lvl === CAREER_MAX) d.pendingRank = -1;      // career complete
    d.lvl++;
    d.progress = 0;
    Save.write();
    if (typeof UI !== 'undefined' && UI.careerDone) UI.careerDone(got, c, rankBefore);
  },

  // Levels finished since the last check (for the win screen).
  takeRecent(sinceL) { return this.d.recent.filter(r => r.L >= sinceL); },
};

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
