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
    settings: { muted: false, showDebug: CONFIG.showDebug, pipLook: 0, lightTiles: false },
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
function drawMimi(ctx, mood, style = 'curls') {
  const SKIN_T = '#B07448', SKIN_B = '#8A5534';             // warm deep brown
  const HAIR = '#1A1012', HAIR_HI = '#4A3236';
  const LIP = { twists: '#7A4A4E', braids: '#4E2A30' }[style] || '#6B3138';
  const LIP_HI = { twists: '#A87478', braids: '#734650' }[style] || '#9A5560';
  const circle = (x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const curl = (x, y, r) => {                               // one spiral ringlet
    circle(x, y, r, HAIR);
    ctx.strokeStyle = HAIR_HI; ctx.lineWidth = Math.max(0.9, r * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.05, r * 0.55, Math.PI * 1.05, Math.PI * 2.2); ctx.stroke();
  };
  const TW = '#5E1A24', TW_HI = '#9C3442', GOLD = '#E2B54E';
  // one rope twist along a path of points, with optional gold thread wraps
  const rope = (pts, w, wraps = []) => {
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
    wraps.forEach(f => {                                      // gold thread wrapped around the twist
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
  // one box braid hanging along a path: plaited chevrons in a brown / ash-brown blend
  const braid = (pts, w, light) => {
    const A = '#2E2018', B = light ? '#8A6A4C' : '#5C4330';
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
  const skinG = ctx.createLinearGradient(0, 26, 0, 90);
  skinG.addColorStop(0, SKIN_T); skinG.addColorStop(1, SKIN_B);

  // ---- stand: black blazer + layered gold necklaces with a red crystal
  ctx.fillStyle = SKIN_B; rr(ctx, 42, 78, 16, 16, 4); ctx.fill();
  const baseG = ctx.createLinearGradient(0, 100, 0, 116);
  baseG.addColorStop(0, '#3AAFA9'); baseG.addColorStop(1, '#1D7470');
  ctx.fillStyle = baseG; ctx.beginPath(); ctx.ellipse(50, 108, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (style === 'braids') {                                  // chunky black cable-knit sweater, crew neck
    ctx.fillStyle = '#1E1C22';
    ctx.beginPath(); ctx.moveTo(29, 104); ctx.quadraticCurveTo(29, 89, 42, 87); ctx.quadraticCurveTo(50, 91, 58, 87);
    ctx.quadraticCurveTo(71, 89, 71, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3A3742'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(42, 87.5); ctx.quadraticCurveTo(50, 92, 58, 87.5); ctx.stroke();      // ribbed collar
    ctx.lineWidth = 1;
    for (const cx of [37, 50, 63]) {                                                                  // cable stitches
      for (let y = 93; y < 104; y += 3.4) { ctx.beginPath(); ctx.moveTo(cx - 2, y); ctx.quadraticCurveTo(cx, y + 2, cx + 2, y); ctx.stroke(); }
    }
  } else if (style === 'twists') {                                  // mustard wrap top + black cord necklaces
    ctx.fillStyle = '#D9A93A';
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.quadraticCurveTo(30, 90, 42, 88); ctx.lineTo(50, 103); ctx.lineTo(58, 88);
    ctx.quadraticCurveTo(70, 90, 70, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#B88A24'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(42, 88); ctx.lineTo(50, 103); ctx.lineTo(58, 88); ctx.stroke();
    ctx.strokeStyle = '#1A1012'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(44, 86); ctx.lineTo(49, 99); ctx.moveTo(56, 86); ctx.lineTo(51, 99); ctx.moveTo(45.5, 86); ctx.lineTo(50.5, 101); ctx.stroke();
  } else {
    ctx.fillStyle = '#16161C';                                 // blazer shoulders + lapels
    ctx.beginPath(); ctx.moveTo(30, 104); ctx.quadraticCurveTo(30, 90, 42, 88); ctx.lineTo(50, 102); ctx.lineTo(58, 88);
    ctx.quadraticCurveTo(70, 90, 70, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#33333D'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(42, 88); ctx.lineTo(46, 97); ctx.moveTo(58, 88); ctx.lineTo(54, 97); ctx.stroke();
    ctx.strokeStyle = '#E2B54E'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(43, 86); ctx.quadraticCurveTo(50, 92, 57, 86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(42.5, 86); ctx.quadraticCurveTo(50, 97, 57.5, 86); ctx.stroke();
    ctx.fillStyle = '#C7C9D3'; ctx.beginPath(); ctx.arc(50, 91.5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C4472F'; ctx.beginPath(); ctx.moveTo(48.6, 95.5); ctx.lineTo(51.4, 95.5); ctx.lineTo(51.4, 99); ctx.lineTo(50, 101); ctx.lineTo(48.6, 99); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E2B54E'; ctx.fillRect(48.4, 94.6, 3.2, 1.2);
  }

  if (style === 'braids') {
    // long box braids falling past the shoulders on both sides
    ctx.fillStyle = '#2E2018'; ctx.beginPath(); ctx.ellipse(50, 42, 28, 20, 0, Math.PI, 0); ctx.fill();
    [[[30, 40], [22, 60], [19, 82], [20, 106]], [[34, 38], [27, 58], [25, 82], [26, 108]], [[26, 46], [17, 66], [14, 88], [15, 104]],
     [[70, 40], [78, 60], [81, 82], [80, 106]], [[66, 38], [73, 58], [75, 82], [74, 108]], [[74, 46], [83, 66], [86, 88], [85, 104]]]
      .forEach((p, i) => braid(p, 5.6, i % 2 === 1));
  } else if (style === 'twists') {
    // twists gathered up at the crown, cascading long down her right side (our left)
    ctx.fillStyle = TW; ctx.beginPath(); ctx.ellipse(48, 38, 27, 18, 0, Math.PI, 0); ctx.fill();
    rope([[40, 22], [30, 30], [22, 44], [18, 60], [18, 76], [22, 92], [26, 104]], 7.5, [0.35, 0.7]);
    rope([[46, 20], [34, 32], [27, 48], [24, 64], [25, 80], [30, 96], [34, 106]], 7, [0.5, 0.85]);
    rope([[34, 26], [24, 38], [16, 52], [13, 68], [14, 84], [18, 98]], 6.5, [0.6]);
    rope([[52, 18], [44, 14], [36, 16], [30, 22]], 6.5, [0.4]);          // twists piled at the crown
    rope([[58, 20], [50, 12], [42, 10], [36, 13]], 6, []);
    rope([[74, 46], [78, 60], [78, 74]], 5, []);                         // a few behind the tucked side
  } else {
    // ---- hair behind the head: smooth crown, long ringlets cascading down her right side (our left),
    //      only a few curls peeking out behind the tucked side
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.ellipse(50, 40, 29, 20, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(21, 40); ctx.bezierCurveTo(12, 60, 12, 84, 18, 100); ctx.lineTo(34, 100); ctx.bezierCurveTo(30, 80, 28, 60, 30, 42); ctx.closePath(); ctx.fill();
    [[20, 48, 8.5], [15, 60, 9.5], [14, 72, 10], [16, 84, 9.5], [20, 95, 9], [28, 102, 7], [25, 66, 8.5], [26, 80, 8.5], [32, 92, 7]]
      .forEach(([x, y, r]) => curl(x, y, r));
    [[79, 66, 5.5], [80, 77, 6], [78, 88, 5.5], [74, 96, 4.5]].forEach(([x, y, r]) => curl(x, y, r));
  }

  // ---- head
  ctx.fillStyle = skinG; ctx.beginPath(); ctx.ellipse(50, 56, 25, 28, 0, 0, Math.PI * 2); ctx.fill();
  // ear on the tucked side (our right) + tiny stud
  ctx.fillStyle = SKIN_B; ctx.beginPath(); ctx.ellipse(75, 59, 3.4, 5, 0, 0, Math.PI * 2); ctx.fill();
  circle(75.5, 63.5, 1.1, '#E2B54E');

  if (style === 'braids') {
    // middle part with braids starting at the hairline and falling to each side
    ctx.fillStyle = '#2E2018';
    ctx.beginPath(); ctx.moveTo(25, 52); ctx.bezierCurveTo(22, 24, 78, 24, 75, 52);
    ctx.bezierCurveTo(70, 40, 58, 37, 50, 38); ctx.bezierCurveTo(42, 37, 30, 40, 25, 52); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8A5A3C'; ctx.lineWidth = 1.1;                                               // the part
    ctx.beginPath(); ctx.moveTo(50, 38); ctx.lineTo(50, 27); ctx.stroke();
    ctx.strokeStyle = 'rgba(138,106,76,.55)'; ctx.lineWidth = 0.9;                                  // braid sections
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(50 + sx * (4 + i * 7), 38 - i * 0.6); ctx.quadraticCurveTo(50 + sx * (6 + i * 8), 31, 50 + sx * (2 + i * 6), 27); ctx.stroke();
    }
    braid([[31, 42], [26, 56], [24, 72], [24, 90]], 5.4, true);                                     // front braids framing the face
    braid([[69, 42], [74, 56], [76, 72], [76, 90]], 5.4, false);
  } else if (style === 'twists') {
    // pulled back with smooth edges: a dark cap over the whole crown, hairline at the forehead
    ctx.fillStyle = '#3A1218';
    ctx.beginPath(); ctx.moveTo(25, 50); ctx.bezierCurveTo(22, 22, 78, 22, 75, 50);
    ctx.bezierCurveTo(68, 40, 58, 37, 50, 37); ctx.bezierCurveTo(40, 37, 30, 42, 25, 50); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,60,72,.55)'; ctx.lineWidth = 1;          // brushed-back texture
    for (let x = 36; x <= 70; x += 5) { ctx.beginPath(); ctx.moveTo(x, 38); ctx.quadraticCurveTo(x - 6, 31, x - 14, 27); ctx.stroke(); }
    rope([[46, 30], [36, 34], [28, 44], [25, 58], [26, 72]], 6.5, [0.3, 0.75]);
    // gold hoop on the curl side
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(26, 72, 4.5, 6, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    // ---- hair on top: deep side part (our right), swept across to our left
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(68, 32);                                         // part line
    ctx.bezierCurveTo(58, 28, 36, 28, 27, 40);
    ctx.bezierCurveTo(22, 50, 24, 62, 27, 72);                  // sweep down her right side
    ctx.bezierCurveTo(31, 60, 34, 48, 44, 42);
    ctx.bezierCurveTo(54, 37, 62, 36, 68, 32);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                            // tucked side, close to the head
    ctx.moveTo(68, 32); ctx.bezierCurveTo(74, 36, 76, 44, 74, 52); ctx.lineTo(71, 52);
    ctx.bezierCurveTo(72, 44, 70, 38, 66, 35); ctx.closePath(); ctx.fill();
    [[44, 28, 5], [35, 31, 5.5], [27, 38, 6], [22, 48, 6.5], [27, 50, 5.5], [25, 61, 6], [27, 72, 5.5]].forEach(([x, y, r]) => curl(x, y, r));
    ctx.strokeStyle = HAIR_HI; ctx.lineWidth = 1.4; ctx.lineCap = 'round';   // shine on the sweep
    ctx.beginPath(); ctx.moveTo(60, 33); ctx.quadraticCurveTo(46, 33, 36, 42); ctx.stroke();
  }

  // ---- face
  const eyeY = 57, ink = '#1A0D12';
  const lashes = (x, up) => {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    const y = eyeY + (up ? -1 : 2);
    ctx.beginPath(); ctx.moveTo(x - 4.6, y - 1); ctx.lineTo(x - 6.6, y - 3); ctx.moveTo(x + 4.6, y - 1); ctx.lineTo(x + 6.6, y - 3); ctx.stroke();
  };
  const openEye = (x, big) => {
    ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, eyeY, big ? 4.4 : 3.6, big ? 5.2 : 4.4, 0, 0, Math.PI * 2); ctx.fill();
    circle(x + 1.3, eyeY - 1.6, big ? 1.7 : 1.3, '#FFFFFF'); lashes(x, true);
    if (style === 'braids') { ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.beginPath(); const s = x < 50 ? -1 : 1;
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
  // defined brows
  ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (mood === 'oops') {
    ctx.beginPath(); ctx.moveTo(35, 50); ctx.lineTo(45, 47); ctx.moveTo(65, 50); ctx.lineTo(55, 47); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(35, 49); ctx.quadraticCurveTo(40, 45.5, 46, 47.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(54, 47.5); ctx.quadraticCurveTo(60, 45.5, 65, 49); ctx.stroke();
  }
  // nose + silver septum ring
  ctx.strokeStyle = 'rgba(70,35,20,.55)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(47.5, 65); ctx.quadraticCurveTo(50, 67, 52.5, 65); ctx.stroke();
  ctx.strokeStyle = '#D9DEE8'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(50, 66.4, 1.7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // cheeks
  ctx.fillStyle = 'rgba(205,90,110,.35)';
  ctx.beginPath(); ctx.ellipse(33, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(67, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  // mouth: her big bright smile with plum-brown lips
  if (mood === 'wow') {
    ctx.fillStyle = LIP; ctx.beginPath(); ctx.ellipse(50, 73, 4.6, 5.4, 0, 0, Math.PI * 2); ctx.fill();
    circle(50, 73.5, 2.6, '#3A1418');
  } else if (mood === 'oops') {
    ctx.strokeStyle = LIP; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(44, 75); ctx.quadraticCurveTo(50, 70, 56, 75); ctx.stroke();
  } else if (mood === 'think') {
    ctx.strokeStyle = LIP; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(45, 73); ctx.quadraticCurveTo(51, 71, 56, 72); ctx.stroke();
  } else {
    const wide = mood === 'cheer' ? 1 : 0.8;
    ctx.fillStyle = LIP;                                        // lips
    ctx.beginPath(); ctx.moveTo(50 - 10 * wide, 69.5);
    ctx.quadraticCurveTo(50, 67.4, 50 + 10 * wide, 69.5);
    ctx.quadraticCurveTo(50, 83 * (wide === 1 ? 1 : 0.98), 50 - 10 * wide, 69.5); ctx.fill();
    ctx.fillStyle = '#FFFFFF';                                  // teeth
    ctx.beginPath(); ctx.moveTo(50 - 8 * wide, 70.4);
    ctx.quadraticCurveTo(50, 69, 50 + 8 * wide, 70.4);
    ctx.quadraticCurveTo(50, 76.5, 50 - 8 * wide, 70.4); ctx.fill();
    ctx.strokeStyle = LIP_HI; ctx.lineWidth = 0.9;               // gloss
    ctx.beginPath(); ctx.moveTo(45, 77.3); ctx.quadraticCurveTo(50, 78.6, 55, 77.3); ctx.stroke();
  }
}

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
    if (typeof world === 'string' && world.startsWith('mimi-')) return drawMimi(ctx, mood, world.slice(5));
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

  // A look she bought in the shop keeps Pip in that world's hairstyle (0 = change each world).
  lookFor(world) {
    const l = Save.data && Save.data.settings && Save.data.settings.pipLook;
    if (l === 'mimi-auto') return 'mimi-' + (MIMI_BY_WORLD[world] || 'curls');
    if (typeof l === 'string' && l.startsWith('mimi-')) return l;
    return l >= 1 && l <= 6 ? l : world;
  },
  url(world, mood, px = 120, tone = this.tone(), raw = false) {
    if (!raw) world = this.lookFor(world);
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
