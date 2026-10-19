'use strict';
/* =========================================================
   Myesha's Salon Swap — js/engine.js
   Behind the scenes: saving (with backup), animation timing, sound & music,
   particles / confetti, and Pip the guide.
   ========================================================= */

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
    settings: { muted: false, showDebug: CONFIG.showDebug, pipLook: 0, lightTiles: false, closet: null },
    progress: { unlocked: 1, stars: {}, best: {}, fails: {} },
    help: { howTo: false, seen: {}, carriedOver: false, world: 1 },
    boosters: { hammer: 2, shuffle: 2, moves: 2 },    // starting boosters
    wallet: { coins: 0, gems: 0, backpaid: false, worldPaid: {}, perfectPaid: {}, owned: {} },
    missions: { win: -1, world: 1, list: [], wrapClaimed: false, bonus: null, streak: 0 },
    career: { lvl: 1, progress: 0, pendingRank: 0, recent: [] },
    daily: { lastClaim: null, streak: 0 },            // daily gift streak
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
  // Hidden Oz finale: an original dreamy rising melody.
  ozTheme: (S, at) => {
    const mel = ['G5', 'B5', 'D6', 'G6', 'F#6', 'D6', 'B5', 'D6', 'E6', 'G6', 'B6', 'A6', 'G6', 'D6', 'E6', 'G6'];
    mel.forEach((n, i) => S.bell(noteFreq(n), at + i * 0.32, 0.07, 1.1));
    [['G3', 0], ['E3', 1.28], ['C3', 2.56], ['D3', 3.84]].forEach(([n, t]) =>
      S.tone(noteFreq(n), at + t, 1.3, { type: 'triangle', vol: 0.05, attack: 0.08 }));
  },
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


/* ---------- 4e. PIP — her guide ----------
   A little mannequin head who travels with her. The hairstyle changes
   in every world; the face changes with the mood.
   moods: happy, blink, wow, oops, think, wink, cheer */
/* ---------- Mimi-Pip ----------
   A cartoon of Myesha in Pip's style, drawn entirely in code (no photo is stored).
   Three looks: 'curls' (black side-swept curls, blazer), 'twists' (burgundy twists with
   gold thread, mustard top) and 'braids' (long brown box braids, black knit).
   She first appears in the hidden Oz finale, then unlocks in the shop. */
// Mimi-Pip (see js/closet.js for the pieces)
function drawMimi(ctx, mood, style = 'curls') { drawLook(ctx, MIMI_LOOKS[style] || MIMI_LOOKS.curls, mood); }

const MIMI_BY_WORLD = { 1: 'braids', 2: 'braids', 3: 'twists', 4: 'twists', 5: 'curls', 6: 'curls' };

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
    drawLook(ctx, lookSpec(world), mood, toneIdx);   // all the pieces live in js/closet.js
  },

  // A look she bought in the shop keeps Pip in that world's hairstyle (0 = change each world).
  lookFor(world) {
    const l = Save.data && Save.data.settings && Save.data.settings.pipLook;
    if (l === 'mimi-auto') return 'mimi-' + (MIMI_BY_WORLD[world] || 'curls');
    if (l === 'custom' && Save.data.settings.closet) return 'custom';
    if (typeof l === 'string' && l.startsWith('mimi-')) return l;
    return l >= 1 && l <= 6 ? l : world;
  },
  url(world, mood, px = 120, tone = this.tone(), raw = false) {
    if (!raw) world = this.lookFor(world);
    const key = (world === 'custom' ? JSON.stringify(Save.data.settings.closet) : typeof world === 'object' ? JSON.stringify(world) : world) + ':' + mood + ':' + px + ':' + tone;
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
