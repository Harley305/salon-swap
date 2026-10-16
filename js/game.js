'use strict';
/* =========================================================
   Myesha's Salon Swap — js/game.js
   Playing a level: drawing the board, touch / mouse input, moves, cascades,
   specials, boosters, the freeze safety net, winning and losing.
   ========================================================= */

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
    this.flipSprites = TILE_TYPES.map(t => buildFlipSprite(t, px));
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
        const cl = Board.cells && Board.cells[t.r] && Board.cells[t.r][t.c];
        const onGel = !!(cl && cl.gel && Math.abs(t.y - t.r) < 0.05);
        ctx.drawImage((onGel !== !!Save.data.settings.lightTiles ? this.flipSprites : this.sprites)[t.kind], x, y, size, size);
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

    // Double gel: a small ×2 badge in the corner (the light tile already marks gel).
    if (hasCells) {
      const bw = s * 0.36, bh = s * 0.24;
      ctx.save();
      ctx.font = `700 ${Math.round(bh * 0.72)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let r = 0; r < Board.rows; r++) {
        for (let c = 0; c < Board.cols; c++) {
          if ((Board.cells[r][c].gel || 0) < 2) continue;
          const t = Board.grid[r][c];
          if (t && Math.abs(t.y - r) >= 0.05) continue;   // tile still falling in
          const x = c * s + s - bw - s * 0.04, y = r * s + s * 0.03;
          ctx.fillStyle = '#6B4FA8';
          rr(ctx, x, y, bw, bh, bh / 2); ctx.fill();
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('×2', x + bw / 2, y + bh / 2 + 0.5);
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
    try {
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
    } catch (err) {
      await this.recover(err, 'swap');
    } finally {
      this.unlockIfPlaying();
    }
  },

  /* ----- safety net -----
     If anything throws in the middle of a move, the board is repaired and
     unlocked instead of freezing. Win/lose screens keep the board locked. */
  unlockIfPlaying() {
    if (this.state !== 'play') return;
    this.locked = false;
    this._stuckSince = 0;
    UI.updateDebug();
    this.armIdle();
  },

  async recover(err, where) {
    console.error('[Salon Swap] recovered from an error in ' + where + ':', err);
    this.recoveries = (this.recoveries || 0) + 1;            // for testing
    await this.repairBoard();
    if (this.state !== 'play' || !this.level) return;
    if (this.goalsDone()) await this.win();
    else if (this.movesLeft <= 0) await this.lose();
  },

  // Put every tile back in its cell, fill holes, clear leftover matches.
  async repairBoard() {
    try {
      FX.list.length = 0;
      Board.grid.forEach((row, r) => row.forEach((t, c) => {
        if (!t) return;
        if (t.alpha < 0.5) { row[c] = null; return; }       // was mid-pop: finish clearing it
        Object.assign(t, { r, c, x: c, y: r, scale: 1, alpha: 1, shake: 0, triggered: false });
      }));
      await this.collapse();
      if (Board.findMatches().length) await this.resolveBoard();
      else if (!Board.findMoves().length) await this.shuffle();
    } catch (err) {
      console.error('[Salon Swap] board repair failed:', err);
    }
  },

  // Runs every half second: a board locked with nothing animating means a
  // move got stuck (a promise that never finished). Repair and unlock it.
  watchdog() {
    if (this.state !== 'play' || !this.locked || Tweens.busy || this._repairing) {
      this._stuckSince = 0;
      return;
    }
    const now = performance.now();
    if (!this._stuckSince) { this._stuckSince = now; return; }
    if (now - this._stuckSince < CONFIG.unstickMs) return;
    this._repairing = true;
    this._stuckSince = 0;
    this.recover(new Error('board stayed locked with nothing moving'), 'watchdog')
      .finally(() => { this._repairing = false; this.unlockIfPlaying(); });
  },

  /* ----- goals ----- */
  goalsDone() {
    return this.level.goals.every(g => (g.type === 'score' ? this.score >= g.need : g.have >= g.need));
  },

  progress(type, kind) {
    if (type === 'collect') { const tt = TILE_TYPES[kind]; if (tt) Missions.event('clear', { id: tt.id }); }
    else Missions.event(type);
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
          Missions.event(sp.special === 'lineH' || sp.special === 'lineV' ? 'line' : sp.special);
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
    Missions.event('combo');
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
    if (!inv[type]) { UI.showShop(); return; }
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
      try {
        await this.shuffle('Twister!');
      } catch (err) {
        await this.recover(err, 'shuffle');
      } finally {
        this.unlockIfPlaying();
      }
      return;
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
    try {
      Sound.play('hammer');
      Shake.add(0.4);
      const set = new Map([[cell.r * Board.cols + cell.c, { r: cell.r, c: cell.c, depth: 0 }]]);
      await this.resolveBoard([], { set, fx: [{ type: 'ring', r: cell.r, c: cell.c, R: 0, depth: 0 }] });
      if (this.goalsDone()) { await this.win(); return; }
    } catch (err) {
      await this.recover(err, 'hammer');
    } finally {
      this.unlockIfPlaying();
    }
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
    const careerStart = Save.data.career ? Save.data.career.lvl : 0;
    const firstTry = !(Save.data.progress.fails[n] > 0);
    const movesLeftAtWin = this.movesLeft;

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
      try {
        await this.resolveBoard([], { set, fx: [] });
      } catch (err) {
        console.error('[Salon Swap] finale sparkle failed (stars still saved):', err);
        await this.repairBoard();
      }
    }

    const stars = this.starsFor(this.score);
    const p = Save.data.progress;
    const firstWin = !(p.stars[n] > 0);
    const rewards = firstWin ? LevelRewards.forWin(n) : [];
    LevelRewards.give(rewards);
    p.stars[n] = Math.max(p.stars[n] || 0, stars);
    p.best[n] = Math.max(p.best[n] || 0, this.score);
    p.unlocked = Math.max(p.unlocked, n + 1);
    p.fails[n] = 0;
    const pay = Wallet.forWin(n, firstWin);
    Missions.event('played'); Missions.event('win');
    Missions.event('score', { amount: this.score });
    if (firstTry) Missions.event('firstTry');
    if (stars === 3) Missions.event('threeStar');
    if (movesLeftAtWin >= 5) Missions.event('spare5');
    if (isBoss(n)) Missions.event('boss');
    Save.data.stats.levelsWon = (Save.data.stats.levelsWon || 0) + 1;
    Save.write();

    await wait(450);
    UI.updateBoosters();
    UI.renderWallet();
    if (careerStart && pay) Career.takeRecent(careerStart).forEach(r =>
      pay.cards.push({ label: `🎬 Career Track · level ${r.L} done`, text: r.label }));
    UI.showWin(n, stars, this.score, rewards, pay);
  },

  async lose() {
    this.state = 'lost';
    this.locked = true;
    this.clearHint();
    this.mode = null;
    clearTimeout(this._idleTimer);
    Sound.play('lose');
    const n = this.level.n;
    Missions.event('played'); Missions.event('lose');
    Missions.event('score', { amount: this.score });
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
