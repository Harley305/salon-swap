'use strict';
/* =========================================================
   Myesha's Salon Swap — js/ui.js
   Screens and pop-ups: title, level map, shop, missions, win / lose, finale credits,
   and the animated world backgrounds.
   ========================================================= */

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
    ['walletTitle', 'walletMap', 'btnShop'].forEach(id => { const el = $(id); if (el) el.addEventListener('click', () => this.showShop()); });
    ['btnMissions', 'btnMissionsMap'].forEach(id => { const el = $(id); if (el) el.addEventListener('click', () => this.showMissions()); });
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
      const cl = e.target.closest('[data-cl]');
      if (cl && this._cl) { e.stopPropagation(); return this.closetPick(cl.dataset.cl); }
      const sw = e.target.closest('[data-tone]');
      if (!sw) return;
      e.stopPropagation();
      Pip.setTone(+sw.dataset.tone);
      document.querySelectorAll('.tone').forEach(b => b.classList.toggle('on', b === sw));
      const row = $('pipRow'); if (row) row.innerHTML = this.pipRow();
      document.querySelectorAll('.pip-card').forEach(img => { img.src = Pip.url(World.current, 'cheer'); });
      if (this._cl && !$('modal').hidden) this.renderCloset('', true);
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
    if (name !== 'game') {
      this.renderWallet(); this.updateMissionDot();
      if (Save.data.career && Save.data.career.pendingRank) setTimeout(() => { if ($('modal').hidden) this.showRankUp(); }, 700);
    }
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
      gel: buildGelGoalIcon(px).toDataURL(),
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

  /* ----- 📋 Missions (Call Sheet + Career Track) ----- */
  updateMissionDot() {
    const on = Missions.claimable() || !!(Save.data.career && Save.data.career.pendingRank);
    ['btnMissions', 'btnMissionsMap'].forEach(id => { const el = $(id); if (el) el.classList.toggle('has-dot', on); });
  },

  careerDone(got, c) {
    this.updateMissionDot();
    this.renderWallet();
    this.updateBoosters();
    if (Game.state === 'play') this.toast(`🎬 Career level ${got.L} done! ${got.label}`, false, 'cheer');
  },

  // Promotion pop-up (shown the next time she's on the title, map or missions screen).
  showRankUp() {
    const d = Save.data.career;
    if (!d.pendingRank) return false;
    const done = d.pendingRank === -1;
    const title = done ? 'Career complete!' : CAREER_RANKS[d.pendingRank];
    d.pendingRank = 0; Save.write();
    this.showModal(`
      <img class="pip pip-card pip-big" src="${Pip.url(World.current, 'cheer')}" alt="Pip">
      <div class="panel-kicker">${done ? '🏆 Hall of Fame' : '🎬 Promotion'}</div>
      <div class="panel-title">${esc(title)}</div>
      <div class="ht-text">${done ? `All 150 Career Track levels, ${esc(CONFIG.playerName)}. Light tiles are unlocked in the shop, plus 5 💎.`
        : `You've been promoted to <b>${esc(title)}</b>! 2 💎, 1 of each booster and a new Pip look are yours (pick it in the shop).`}</div>
      <div class="panel-btns"><button class="btn btn-big btn-gold" data-act="track">See my Career Track</button>
      <button class="btn btn-ghost" data-act="close">Nice!</button></div>`,
      { track: () => this.showMissions('track') });
    Confetti.burst(160); Sound.play('fanfare', 0.55);
    this.updateMissionDot();
    return true;
  },

  careerTab() {
    const d = Save.data.career;
    if (Career.complete()) {
      return `<div class="ct-rank"><span class="ct-kicker">Career complete</span><b>🏆 Hall of Fame</b>
        <span class="ct-sub">All ${CAREER_MAX} levels done. Legend.</span></div>${this.rankLadder(CAREER_RANKS.length)}`;
    }
    const L = d.lvl, c = Career.challenge(L), r = Career.rankOf(L);
    const inRank = (L - 1) % 25, pct = Math.round(100 * d.progress / c.target);
    const next = [1, 2, 3].map(i => L + i).filter(x => x <= CAREER_MAX).map(x => {
      const cx = Career.challenge(x);
      return `<div class="ct-next${x % 25 === 0 ? ' promo' : ''}"><span class="ct-num">${x}</span><span class="ct-ntext">${esc(cx.text)}</span><span class="ct-nrew">${cx.reward.label}</span></div>`;
    }).join('');
    return `
      <div class="ct-rank"><span class="ct-kicker">Your rank</span><b>${esc(CAREER_RANKS[r])}</b>
        <span class="ct-sub">Level ${L} of ${CAREER_MAX} · ${25 - inRank} to ${r < CAREER_RANKS.length - 1 ? esc(CAREER_RANKS[r + 1]) : 'the finish'}</span>
        <div class="ms-bar"><i style="width:${Math.round(100 * inRank / 25)}%"></i></div></div>
      <div class="shop-sec">Now shooting · level ${L}</div>
      <div class="ms-row ct-now"><div class="ms-main"><b>${esc(c.text)}</b>
        <div class="ms-bar"><i style="width:${pct}%"></i></div>
        <small>${c.target >= 1000 ? d.progress.toLocaleString() : d.progress} / ${c.target.toLocaleString()}</small></div>
        <span class="ms-reward">${c.reward.label}</span></div>
      ${next ? `<div class="shop-sec">Up next</div>${next}` : ''}
      ${this.rankLadder(r)}`;
  },

  rankLadder(cur) {
    return `<div class="shop-sec">Ranks</div><div class="ct-ladder">` + CAREER_RANKS.map((name, i) =>
      `<div class="ct-step${i < cur ? ' past' : i === cur ? ' on' : ''}" title="${esc(name)}"><span>${i < cur ? '✓' : i * 25 + 1}</span><small>${esc(name)}</small></div>`).join('') + `</div>` +
      (cur < CAREER_RANKS.length - 1 ? `<div class="ct-ranks-note">Next promotion: <b>${esc(CAREER_RANKS[cur + 1])}</b> at level ${(cur + 1) * 25 + 1}</div>` : '');
  },

  missionDone(m) {
    this.updateMissionDot();
    if (Game.state === 'play') this.toast(`📋 Call Sheet: ${Missions.text(m)} ✓`, false, 'cheer');
  },

  rewardText(m) {
    if (m.gems) return `💎 ${m.gems}`;
    const ic = { hammer: '🔨', shuffle: '🌪️', moves: '+5' };
    return Object.keys(m.reward || {}).map(k => ic[k] + (m.reward[k] > 1 ? '×' + m.reward[k] : '')).join(' ');
  },

  showMissions(tab = 'sheet', note = '') {
    if (Save.data.career && Save.data.career.pendingRank && this.showRankUp()) return;
    const d = Missions.ensure();
    const actions = { tab_sheet: () => this.showMissions('sheet'), tab_track: () => this.showMissions('track') };
    const tabs = `<div class="ms-tabs"><button class="ms-tab${tab === 'sheet' ? ' on' : ''}" data-act="tab_sheet">Call Sheet</button>` +
                 `<button class="ms-tab${tab === 'track' ? ' on' : ''}" data-act="tab_track">Career Track</button></div>`;
    let body;
    if (tab === 'track') {
      body = this.careerTab();
    } else {
      const left = Math.max(0, Missions.endsAt() - Date.now());
      const h = Math.floor(left / 3600000), mm = Math.floor(left % 3600000 / 60000);
      const row = (m, i, tier) => {
        const pct = Math.round(100 * m.progress / m.target);
        let btn;
        if (m.claimed) btn = `<span class="ms-check">✓</span>`;
        else if (m.done) { actions['claim' + i] = () => { const got = Missions.claim(m); if (got) { Sound.play('gift'); Confetti.burst(50); this.updateBoosters(); this.renderWallet(); } this.showMissions('sheet', got ? `Claimed ${this.rewardText(m)}!` : ''); };
          btn = `<button class="btn btn-gold ms-claim" data-act="claim${i}">Claim</button>`; }
        else btn = `<span class="ms-reward">${this.rewardText(m)}</span>`;
        return `<div class="ms-row${m.claimed ? ' claimed' : ''}"><div class="ms-main">` +
          `<span class="ms-tier t${tier}">${TIER_NAMES[tier]}</span><b>${esc(Missions.text(m))}</b>` +
          `<div class="ms-bar"><i style="width:${pct}%"></i></div><small>${(m.target >= 1000 ? m.progress.toLocaleString() : m.progress)} / ${m.target.toLocaleString()}</small></div>${btn}</div>`;
      };
      const tiers = d.list.map(m => Missions.tpl(m.id) ? Missions.tpl(m.id).tier : 0);
      let rows = d.list.map((m, i) => row(m, i, tiers[i])).join('');
      const doneCount = d.list.filter(m => m.done).length;
      let wrap;
      if (d.wrapClaimed) wrap = `<div class="ms-wrap done"><b>That's a wrap! ✓</b><span>Bonus mission unlocked below.</span></div>`;
      else if (Missions.allDone()) {
        actions.wrap = () => { if (Missions.claimWrap()) { Sound.play('fanfare', 0.55); Confetti.burst(140); this.updateBoosters(); this.renderWallet(); } this.showMissions('sheet', "That's a wrap! +1 of each booster, +100 🪙"); };
        wrap = `<button class="ms-wrap ready" data-act="wrap"><b>🎬 That's a wrap! — claim</b><span>1 of each booster + 100 🪙</span></button>`;
      } else wrap = `<div class="ms-wrap"><b>Finish all 5: That's a wrap!</b><span>${doneCount} / 5 done · 1 of each booster + 100 🪙</span></div>`;
      const bonus = d.bonus ? `<div class="shop-sec">Bonus mission</div>` + row(d.bonus, 'b', 3) : '';
      body = `<div class="ms-timer">New Call Sheet in ${h}h ${mm}m</div>${rows}${wrap}${bonus}`;
    }
    this.showModal(`
      <div class="panel-kicker">📋 Missions</div>
      ${tabs}
      ${note ? `<div class="shop-note">${esc(note)}</div>` : ''}
      ${body}
      <div class="panel-btns"><button class="btn btn-ghost" data-act="close">Done</button></div>`, actions);
    this.updateMissionDot();
  },

  /* ----- Coins & gems ----- */
  renderWallet() {
    const paid = Wallet.backpay();
    const txt = `🪙 ${Wallet.coins().toLocaleString()} · 💎 ${Wallet.gems()}`;
    ['walletTitle', 'walletMap'].forEach(id => { const el = $(id); if (el) el.textContent = txt; });
    if (paid) {
      const show = () => { if (!$('modal').hidden) return setTimeout(show, 1200); this.showModal(`
        <div class="panel-kicker">New: coins &amp; gems</div>
        <div class="panel-title">Back pay!</div>
        <div class="ht-text">You get coins for every level you clear and gems for every world. Here's what you've already earned:</div>
        <div class="panel-reward"><b>Your earnings so far</b>🪙 ${paid.coins.toLocaleString()} · 💎 ${paid.gems}</div>
        <div class="panel-note">Spend them in the shop — tap your coins anytime.</div>
        <div class="panel-btns"><button class="btn btn-big btn-gold" data-act="shop">Open the shop</button>
        <button class="btn btn-ghost" data-act="close">Later</button></div>`,
        { shop: () => this.showShop() }); };
      setTimeout(show, 900);
    }
  },

  showShop(note = '') {
    this.renderWallet();
    const inv = Save.data.boosters, set = Save.data.settings;
    const B = [['hammer', '🔨', 'Hammer', 'Smash any one tile'], ['shuffle', '🌪️', 'Twister', 'Shuffle the board'], ['moves', '+5', '+5 Moves', 'Five extra moves']];
    const row = (icon, name, sub, btn) =>
      `<div class="shop-row"><span class="shop-icon">${icon}</span><span class="shop-text"><b>${name}</b><small>${sub}</small></span>${btn}</div>`;
    const buyBtn = (act, label, ok) => `<button class="btn shop-buy${ok ? '' : ' off'}" data-act="${act}">${label}</button>`;
    const coins = Wallet.coins(), gems = Wallet.gems();

    const boosterRows = B.map(([k, ic, nm, sub]) =>
      row(ic, nm, `${sub} · you have ${inv[k] || 0}`, buyBtn('buy_' + k, `${ECON.prices[k]} 🪙`, coins >= ECON.prices[k]))).join('');

    const lightOwned = Wallet.owns('lightTiles');
    const gemRows =
      row('🎁', 'Booster bundle', '3 of each booster', buyBtn('gem_bundle', `${ECON.bundleGems} 💎`, gems >= ECON.bundleGems)) +
      row('◻️', 'Light tiles', lightOwned ? (set.lightTiles ? 'On · gel shows as color' : 'Off') : 'Light tiles everywhere; gel shows as color',
        lightOwned ? buyBtn('toggle_light', set.lightTiles ? 'Turn off' : 'Turn on', true)
                   : buyBtn('gem_light', `${ECON.lightTilesGems} 💎`, gems >= ECON.lightTilesGems));

    const looks = [0, 1, 2, 3, 4, 5, 6].map(w => {
      const on = (set.pipLook || 0) === w;
      if (w === 0) return `<button class="pip-look${on ? ' on' : ''}" data-act="look_0"><span class="pl-auto">Auto</span><small>${on ? 'Using' : 'Each world'}</small></button>`;
      const owned = Wallet.owns('pip' + w);
      return `<button class="pip-look${on ? ' on' : ''}${owned ? '' : ' locked'}" data-act="look_${w}">` +
        `<img src="${Pip.url(w, 'happy', 80, undefined, true)}" alt=""><small>${on ? 'Using' : owned ? 'Use' : ECON.pipLookGems + ' 💎'}</small></button>`;
    }).join('');

    const mimiLooks = [['mimi-auto', 'Auto'], ['mimi-curls', 'Curls'], ['mimi-twists', 'Twists'], ['mimi-braids', 'Braids']];
    const mimiRow = Wallet.owns('mimi') ? mimiLooks.map(([id, name]) => {
      const on = set.pipLook === id;
      const img = id === 'mimi-auto' ? 'mimi-curls' : id;
      return `<button class="pip-look${on ? ' on' : ''}" data-act="look_${id}"><img src="${Pip.url(img, 'happy', 80, undefined, true)}" alt=""><small>${on ? 'Using' : name}</small></button>`;
    }).join('') : '';

    const actions = {};
    mimiLooks.forEach(([id, name]) => { actions['look_' + id] = () => {
      if (!Wallet.owns('mimi')) return;
      set.pipLook = id; Save.write(); Pip.refresh && Pip.refresh();
      const tp = $('titlePip'); if (tp) tp.src = Pip.url(World.current, 'happy');
      this.showShop(id === 'mimi-auto' ? 'Mimi changes looks with each world.' : `Mimi · ${name} it is!`);
    }; });
    B.forEach(([k]) => { actions['buy_' + k] = () => {
      if (!Wallet.spendCoins(ECON.prices[k])) return this.showRefill();
      inv[k] = (inv[k] || 0) + 1; Save.write(); Sound.play('gift'); this.updateBoosters(); this.showShop(`+1 ${k === 'moves' ? '+5 Moves' : k === 'hammer' ? 'Hammer' : 'Twister'}!`);
    }; });
    actions.gem_bundle = () => {
      if (!Wallet.spendGems(ECON.bundleGems)) return this.showShop('Gems come from clearing worlds.');
      Object.keys(ECON.bundle).forEach(k => { inv[k] = (inv[k] || 0) + ECON.bundle[k]; });
      Save.write(); Sound.play('gift'); this.updateBoosters(); this.showShop('Bundle added — 3 of each!');
    };
    actions.gem_light = () => {
      if (!Wallet.spendGems(ECON.lightTilesGems)) return this.showShop('Gems come from clearing worlds.');
      Wallet.d.owned.lightTiles = true; set.lightTiles = true; Save.write(); Sound.play('gift'); Render.draw(performance.now()); this.showShop('Light tiles on!');
    };
    actions.toggle_light = () => { set.lightTiles = !set.lightTiles; Save.write(); Render.draw(performance.now()); this.showShop(); };
    for (let w = 0; w <= 6; w++) actions['look_' + w] = () => {
      if (w > 0 && !Wallet.owns('pip' + w)) {
        if (!Wallet.spendGems(ECON.pipLookGems)) return this.showShop('Gems come from clearing worlds.');
        Wallet.d.owned['pip' + w] = true; Sound.play('gift');
      }
      set.pipLook = w; Save.write(); Pip.refresh && Pip.refresh();
      const tp = $('titlePip'); if (tp) tp.src = Pip.url(World.current, 'happy');
      this.showShop(w ? 'Pip loves the new look!' : 'Pip will change looks each world.');
    };
    actions.refill = () => this.showRefill();

    this.showModal(`
      <div class="panel-kicker">Salon shop</div>
      <div class="panel-title">Shop</div>
      <div class="wallet-big">🪙 ${coins.toLocaleString()} · 💎 ${gems}</div>
      ${note ? `<div class="shop-note">${esc(note)}</div>` : ''}
      <div class="shop-sec">Boosters · coins</div>${boosterRows}
      <div class="shop-sec">Gem shop</div>${gemRows}
      ${mimiRow ? `<div class="shop-sec">Mimi · free</div><div class="pip-looks">${mimiRow}</div>` : ''}
      <div class="shop-sec">Pip's look · ${ECON.pipLookGems} 💎 each</div><div class="pip-looks">${looks}</div>
      <div class="panel-btns"><button class="btn" data-act="refill">Get more coins</button>
      <button class="btn btn-ghost" data-act="close">Done</button></div>`, actions);
    this.$panelScrollTop();
  },

  $panelScrollTop() { const p = $('panel'); if (p) p.scrollTop = 0; },

  showRefill() {
    const actions = { shop: () => this.showShop(), map: () => this.openMap() };
    const packs = (CONFIG.coinPacks || []).map((pk, i) => {
      actions['pack' + i] = () => {
        const got = Wallet.addCoins(pk.coins); Save.write(); Sound.play('gift'); Confetti.burst(60);
        this.renderWallet(); this.showShop(`+${got.toLocaleString()} coins — ${pk.name}!`);
      };
      return `<button class="shop-pack" data-act="pack${i}"><b>🪙 ${pk.coins.toLocaleString()}</b><span>${esc(pk.name)}</span><small>${esc(pk.price)}</small></button>`;
    }).join('');
    this.showModal(`
      <div class="panel-kicker">Running low?</div>
      <div class="panel-title">Get coins</div>
      <div class="wallet-big">🪙 ${Wallet.coins().toLocaleString()} · 💎 ${Wallet.gems()}</div>
      <div class="shop-sec">Coin packs · on the house</div>
      <div class="shop-packs">${packs}</div>
      <div class="panel-note">No real money — just tap one. 💕</div>
      <div class="shop-sec">Or earn them free</div>
      <div class="ht-text">Replay any level you've already cleared for +${ECON.repeatClear} 🪙 each.</div>
      <div class="panel-btns"><button class="btn" data-act="map">Level map</button>
      <button class="btn btn-ghost" data-act="shop">Back to shop</button></div>`, actions);
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
      case 'gel':   return { icon: this.icons.gel,   title: `Clear the gel (${left})`,
                             how: 'Light tiles are sitting on gel. Match them to clear it. Tiles marked ×2 need two matches.' };
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
    return [1, 2, 3, 4, 5, 6].map(w => `<img src="${Pip.url(w, 'happy', 80, undefined, true)}" alt="">`).join('');
  },

  // Tap Pip on the title screen to restyle: the closet (mix & match). Pieces live in js/closet.js.
  showPipStyle() {
    const set = Save.data.settings;
    {                                                           // start from what Pip wears now
      const cur = lookSpec(Pip.lookFor(World.current));
      const d = JSON.parse(JSON.stringify(cur));
      if (set.pipLook !== 'custom' && d.color && d.color.toLowerCase() === (HAIR_DEFAULT_COLOR[d.hair] || '').toLowerCase()) d.color = null;
      this._cl = { draft: d };
    }
    this.renderCloset();
  },

  renderCloset(note = '', keepScroll = false) {
    const set = Save.data.settings, d = this._cl.draft;
    const isMimi = d.face === 'mimi';
    const thumb = spec => Pip.url(spec, 'happy', 64, undefined, true);
    const lockMsg = p => p.unlock === 'mimi' ? 'Unlocks after the finale 💚'
      : `Get the World ${p.unlock.slice(3)} look in the Shop (${ECON.pipLookGems} 💎)`;
    const chip = (sec, p, on, img) => {
      const ok = closetOwned(p);
      return `<button type="button" class="cl-chip${on ? ' on' : ''}${ok ? '' : ' locked'}" data-cl="${sec}:${p.id}">` +
        (img ? `<img src="${img}" alt="">` : '') + `<small>${ok ? '' : '🔒 '}${esc(p.name)}</small></button>`;
    };
    const sec = (title, body) => `<div class="cl-sec">${title}</div><div class="cl-row">${body}</div>`;
    const seen = p => p.unlock !== 'mimi' || Wallet.owns('mimi');     // Mimi pieces stay a secret until the finale

    const faces = CLOSET.face.map(p => chip('face', p, d.face === p.id, thumb({ ...d, face: p.id }))).join('');
    const hairs = CLOSET.hair.filter(seen).map(p => chip('hair', p, d.hair === p.id, thumb({ ...d, hair: p.id, head: 'none' }))).join('');
    const colors = [{ name: 'Default', hex: null }].concat(CONFIG.hairColors || []).map(c => {
      const on = (d.color || null) === null ? c.hex === null : !!c.hex && c.hex.toLowerCase() === d.color.toLowerCase();
      const bg = c.hex || HAIR_DEFAULT_COLOR[d.hair] || '#3B2416';
      return `<button type="button" class="cl-swatch${on ? ' on' : ''}${c.hex ? '' : ' dflt'}" data-cl="color:${c.hex || ''}" ` +
        `style="background:${bg}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`;
    }).join('');
    const outfits = CLOSET.outfit.filter(seen).map(p => chip('outfit', p, d.outfit === p.id, thumb({ ...d, outfit: p.id }))).join('');
    const heads = CLOSET.head.filter(seen).map(p => chip('head', p, d.head === p.id, thumb({ ...d, head: p.id }))).join('');
    const jewels = CLOSET.jewels.filter(seen).filter(p => !p.face || p.face === d.face)
      .map(p => chip('jewel', p, (d.jewels || []).includes(p.id))).join('');
    const lips = isMimi ? CLOSET.lips.map(l => `<button type="button" class="cl-swatch${d.lips === l.id ? ' on' : ''}" data-cl="lips:${l.id}" ` +
      `style="background:${l.color[0]}" title="${esc(l.name)}" aria-label="${esc(l.name)}"></button>`).join('') +
      `<button type="button" class="cl-chip cl-text${d.liner ? ' on' : ''}" data-cl="liner:1"><small>Winged liner</small></button>` : '';

    const wearing = set.pipLook === 'custom';
    const actions = {
      wear: () => {
        const w = JSON.parse(JSON.stringify(d));
        w.jewels = (w.jewels || []).filter(j => { const p = CLOSET.jewels.find(x => x.id === j); return p && (!p.face || p.face === w.face); });
        if (w.face !== 'mimi') { delete w.lips; delete w.liner; }
        set.closet = w; set.pipLook = 'custom'; Save.write();
        Pip.refresh && Pip.refresh();
        const tp = $('titlePip'); if (tp) tp.src = Pip.url(World.current, 'happy');
        Sound.play('glam'); this._cl = null;
      },
      auto: () => {
        set.pipLook = 0; Save.write(); Pip.refresh && Pip.refresh();
        const tp = $('titlePip'); if (tp) tp.src = Pip.url(World.current, 'happy');
        this._cl = null;
      },
      shop: () => { this._cl = null; this.showShop(); },
      close: () => { this._cl = null; },
    };
    const scroll = $('panel') ? $('panel').scrollTop : 0;
    this.showModal(`
      <img class="pip pip-card pip-big" id="pipPreview" src="${Pip.url(d, 'cheer', 120, undefined, true)}" alt="Pip">
      <div class="panel-kicker">Pip's closet</div>
      <div class="panel-title">Style Pip</div>
      ${note ? `<div class="shop-note">${note}</div>` : ''}
      ${isMimi ? '' : this.toneRow()}
      ${Wallet.owns('mimi') ? sec('Who', faces) : ''}
      ${sec('Hair', hairs)}
      <div class="cl-sec">Hair color</div><div class="cl-row cl-swatches">${colors}</div>
      ${sec('Outfit', outfits)}
      ${sec('Head', heads)}
      ${jewels ? sec('Jewelry', jewels) : ''}
      ${isMimi ? `<div class="cl-sec">Lips</div><div class="cl-row cl-swatches">${lips}</div>` : ''}
      <div class="panel-btns cl-btns">
        <button class="btn btn-gold" data-act="wear">${wearing ? 'Wear changes' : 'Wear it'}</button>
        <button class="btn btn-ghost" data-act="auto">${set.pipLook ? 'Back to Auto' : 'Auto (each world)'}</button>
        <button class="btn btn-ghost" data-act="close">Done</button>
      </div>`, actions);
    if (keepScroll) { const p = $('panel'); if (p) p.scrollTop = scroll; } else this.$panelScrollTop();
  },

  // Tapping a piece in the closet (handled on the panel so the closet stays open).
  closetPick(key) {
    const d = this._cl.draft, i = key.indexOf(':'), sec = key.slice(0, i), id = key.slice(i + 1);
    const list = { face: CLOSET.face, hair: CLOSET.hair, outfit: CLOSET.outfit, head: CLOSET.head, jewel: CLOSET.jewels }[sec];
    const p = list && list.find(x => x.id === id);
    if (p && !closetOwned(p)) {
      const msg = p.unlock === 'mimi' ? `🔒 ${esc(p.name)} unlocks after the finale 💚`
        : `🔒 ${esc(p.name)} comes with the World ${p.unlock.slice(3)} look — <button type="button" class="link-btn" data-act="shop">Shop</button> (${ECON.pipLookGems} 💎)`;
      return this.renderCloset(msg);
    }
    if (sec === 'face') {
      d.face = id;
      if (id === 'mimi' && !d.lips) d.lips = 'plum';
    } else if (sec === 'hair') d.hair = id;
    else if (sec === 'color') d.color = id || null;
    else if (sec === 'outfit') d.outfit = id;
    else if (sec === 'head') d.head = id;
    else if (sec === 'jewel') {
      d.jewels = d.jewels || [];
      d.jewels = d.jewels.includes(id) ? d.jewels.filter(j => j !== id) : d.jewels.concat(id);
    } else if (sec === 'lips') d.lips = id;
    else if (sec === 'liner') d.liner = !d.liner;
    Sound.play('tap');
    this.renderCloset('', true);
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

  /* ----- Level 180 finale: trophy + end credits ----- */
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
    const credits = (CONFIG.credits || []).map(c => {
      const [title, role] = String(c).split('|').map(x => x.trim());
      return `<div class="cr-item">${esc(title)}${role ? `<small>${esc(role)}</small>` : ''}</div>`;
    }).join('');
    const el = document.createElement('div');
    el.className = 'finale';
    el.innerHTML = `
      <div class="fin-trophy">
        <img src="${this.trophyArt()}" alt="">
        <div class="fin-plate"><span>${esc(CONFIG.awardTitle)}</span>${esc(CONFIG.fullName)}
          <div class="fin-engrave">${esc(CONFIG.finaleMessage)}<b>${esc(CONFIG.finaleSignature)}</b></div></div>
      </div>
      <div class="fin-credits"><div class="cr-roll">
        <div class="cr-title">${esc(CONFIG.playerName)}'s<br>${esc(CONFIG.gameName)}</div>
        <div class="cr-role">Starring</div><div class="cr-name">${esc(CONFIG.fullName)}</div>
        <div class="cr-role">Hair Department Head</div><div class="cr-name">${esc(CONFIG.fullName)}</div>
        <div class="cr-role">Co-starring</div><div class="cr-name">Pip</div>
        <div class="cr-pips">${[1, 2, 3, 4, 5, 6].map(w => `<img src="${Pip.url(w, 'cheer', 80, undefined, true)}" alt="">`).join('')}</div>
        ${CONFIG.honors ? `<div class="cr-honor">★ ${esc(CONFIG.honors)} ★</div>` : ''}
        <div class="cr-role">Selected credits</div>${credits}
        <div class="cr-role">The journey</div>
        <div class="cr-item">${[1, 2, 3, 4, 5, 6].map(w => esc((WORLDS[w] || { name: WORLD_NAMES[w] }).name)).join(' · ')}</div>
        <div class="cr-item">180 levels · ★ ${stars}</div>
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
      if (el.classList.contains('ended')) return;
      el.classList.add('ended');                  // credits fade, trophy + engraved plaque return
      el.querySelector('[data-fin="done"]').hidden = false;
      el.querySelector('[data-fin="skip"]').hidden = true;
      // the hidden Oz scene: tap the trophy three times (like clicking her heels)
      const trophy = el.querySelector('.fin-trophy img');
      const hint = document.createElement('div');
      hint.className = 'oz-hint';
      hint.innerHTML = `<img src="${Pip.url(World.current, 'wink', 60)}" alt=""><span>${esc(CONFIG.ozHint || '')}</span>`;
      setTimeout(() => { if (el.isConnected) el.querySelector('.fin-trophy').insertBefore(hint, el.querySelector('.fin-plate')); }, 2600);
      let taps = [];
      trophy.addEventListener('click', e => {
        e.stopPropagation();
        const now = performance.now();
        taps = taps.filter(t => now - t < 1800); taps.push(now);
        Sound.play('clink');
        trophy.classList.remove('oz-tap'); void trophy.offsetWidth; trophy.classList.add('oz-tap');
        if (taps.length >= 3) { taps = []; hint.remove(); this.showOz(); }
      });
    };
    // trophy first, then the credits roll
    setTimeout(() => el.classList.add('rolling'), 4200);
    roll.addEventListener('animationend', showDone);
    setTimeout(showDone, 62000);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-fin]');
      if (!b) return;
      if (b.dataset.fin === 'skip') { showDone(); el.classList.add('rolling', 'skipped'); }
      else finish();
    });
  },

  /* ----- Hidden Oz finale: her road to the Emerald City ----- */
  showOz() {
    if (document.querySelector('.oz')) return;
    const worlds = [1, 2, 3, 4, 5, 6].map(w => (WORLDS[w] || { name: WORLD_NAMES[w] }).name);
    const credits = (CONFIG.credits || []).map(c => {
      let t = String(c).split('|')[0].replace(/\s*\(.*?\)\s*$/, '').replace(/,\s*Season.*$/i, '').trim();
      if (t.length > 22 && t.includes(':')) t = t.split(':')[0].trim();      // keep the lights short
      return t;
    });
    const look = w => 'mimi-' + MIMI_BY_WORLD[w];
    const sparks = Array.from({ length: 30 }, (_, i) =>
      `<i class="oz-spark" style="left:${(i * 37) % 100}%;top:${(i * 53) % 58 + 2}%;animation-delay:${(i % 7) * 0.35}s;transform:scale(${0.6 + (i % 4) * 0.3})"></i>`).join('');
    // sign spots along the road (left/right, nearest first)
    const spots = [[6, 80], [58, 71], [9, 62], [56, 54], [13, 47], [52, 41]];
    const signs = worlds.map((w, i) =>
      `<div class="oz-sign" style="left:${spots[i][0]}%;top:${spots[i][1]}%"><b>World ${i + 1}</b>${esc(w)}</div>`).join('');
    const el = document.createElement('div');
    el.className = 'oz';
    el.innerHTML = `
      <div class="oz-wash"></div><div class="oz-sky">${sparks}</div>
      <svg class="oz-city" viewBox="0 0 390 190" preserveAspectRatio="xMidYMax meet"><g>
        <rect x="95" y="80" width="28" height="110"/><polygon points="95,80 109,36 123,80"/>
        <rect x="130" y="50" width="34" height="140"/><polygon points="130,50 147,4 164,50"/>
        <rect x="172" y="30" width="46" height="160"/><polygon points="172,30 195,-20 218,30"/>
        <rect x="226" y="50" width="34" height="140"/><polygon points="226,50 243,4 260,50"/>
        <rect x="268" y="80" width="28" height="110"/><polygon points="268,80 282,36 296,80"/></g></svg>
      <div class="oz-lights">${credits.map(c => `<span>${esc(c)}</span>`).join('')}</div>
      ${CONFIG.honors ? `<div class="oz-honor">★ ${esc(CONFIG.honors)} ★</div>` : ''}
      <div class="oz-gate"><small>${esc(CONFIG.awardTitle)}</small>${esc(CONFIG.fullName)}</div>
      <div class="oz-road"></div>
      ${signs}
      <div class="oz-bubble"></div>
      <svg class="oz-balloon" viewBox="0 0 70 100"><path d="M35 4 C10 4 4 30 14 46 C20 56 28 60 30 66 L40 66 C42 60 50 56 56 46 C66 30 60 4 35 4Z" fill="#3AAFA9" stroke="#1D7470" stroke-width="2"/><path d="M35 4 C26 20 26 50 32 66 M35 4 C44 20 44 50 38 66" fill="none" stroke="#ffd36b" stroke-width="2"/><path d="M30 66 L28 80 M40 66 L42 80" stroke="#7a5a2a" stroke-width="1.5"/><rect x="26" y="80" width="18" height="12" rx="2" fill="#b07a3c"/></svg>
      <div class="oz-walker"><img class="oz-mimi" src="${Pip.url(look(1), 'cheer', 160, undefined, true)}" alt="">
        <svg class="oz-shoes" viewBox="0 0 120 50"><defs><linearGradient id="ozsv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#cfd8e6"/><stop offset="1" stop-color="#8a97ad"/></linearGradient></defs><g fill="url(#ozsv)" stroke="#6f7c93" stroke-width="1.5"><path d="M6 36 Q8 20 26 22 L44 28 Q52 30 52 38 L52 42 L10 42 Q6 42 6 36Z"/><rect x="8" y="40" width="6" height="8" rx="2"/><path d="M66 36 Q68 20 86 22 L104 28 Q112 30 112 38 L112 42 L70 42 Q66 42 66 36Z"/><rect x="68" y="40" width="6" height="8" rx="2"/></g><g fill="#fff"><circle cx="30" cy="30" r="2"/><circle cx="90" cy="30" r="2"/></g></svg></div>
      <div class="oz-card"><b>${esc(CONFIG.ozTitle || '')}</b><span>${esc(CONFIG.ozMessage || '')}</span><small>${esc(CONFIG.ozTagline || '')}</small>
        <div class="oz-unlock">New in the Shop → Pip's look: <b>Mimi</b> 💇🏾‍♀️</div>
        <button class="btn btn-gold" data-oz="back" type="button">Back to my trophy</button></div>
      <button class="oz-x" data-oz="back" type="button" aria-label="Close">✕</button>`;
    $('app').appendChild(el);

    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(() => { if (el.isConnected) fn(); }, ms));
    const walker = el.querySelector('.oz-walker'), mimi = el.querySelector('.oz-mimi');
    const close = () => { timers.forEach(clearTimeout); el.classList.add('out'); setTimeout(() => el.remove(), 500); };
    el.addEventListener('click', e => { if (e.target.closest('[data-oz="back"]')) close(); });

    Sound.play('heelClicks');
    at(150, () => el.classList.add('on'));                       // emerald wash + road unrolls
    at(700, () => Sound.play('ozTheme'));
    // walk up the road: one world sign at a time; her look changes as her career grows
    worlds.forEach((_, i) => at(1600 + i * 1700, () => {
      el.querySelectorAll('.oz-sign')[i].classList.add('lit');
      walker.style.setProperty('--step', i);
      const src = Pip.url(look(i + 1), 'cheer', 160, undefined, true);
      if (mimi.getAttribute('src') !== src) { mimi.classList.add('swap'); setTimeout(() => { mimi.src = src; mimi.classList.remove('swap'); }, 220); Sound.play('special'); }
      else Sound.play('twinkle');
    }));
    at(3200, () => el.classList.add('bubble-pop'));
    const cityAt = 1600 + 6 * 1700;
    at(cityAt, () => { el.classList.add('city'); Sound.play('fanfare', 0.2); });
    el.querySelectorAll('.oz-lights span').forEach((s, i) => at(cityAt + 500 + i * 230, () => { s.classList.add('on'); if (i % 3 === 0) Sound.play('twinkle'); }));
    const endAt = cityAt + 500 + credits.length * 230 + 600;
    at(endAt, () => { el.classList.add('honor'); Sound.play('glam'); Confetti.burst(160); });
    at(endAt + 1600, () => {
      el.classList.add('done');
      if (!Wallet.d.owned.mimi) { Wallet.d.owned.mimi = true; Save.write(); }
      Sound.play('gift');
    });
  },

  showWin(n, stars, score, rewards = [], pay = null) {
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
      ${pay && pay.coins ? `<div class="panel-coins">+${pay.coins.toLocaleString()} 🪙${pay.gems ? ` · +${pay.gems} 💎` : ''}</div>` : ''}
      ${msg ? `<div class="panel-msg">${esc(msg)}</div>` : ''}
      ${pay ? pay.cards.map(r => `<div class="panel-reward"><b>${r.label}</b>${r.text}</div>`).join('') : ''}
      ${rewards.map(r => `<div class="panel-reward"><b>${r.label}</b>${LevelRewards.describe(r.items)}</div>`).join('')}
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
    if (rewards.length) Sound.play('gift');
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
          : Wallet.coins() >= ECON.prices.moves
            ? `<button class="btn btn-big btn-gold" data-act="buymore">+5 moves <small>(${ECON.prices.moves} 🪙)</small></button>`
            : ''}
        <button class="btn btn-big" data-act="retry">${again}</button>
        <button class="btn btn-ghost" data-act="map">Level map</button>
      </div>`,
      { retry: () => Game.startLevel(lv.n), map: () => this.openMap(), more: () => Game.continueWithMoves(),
        buymore: () => { if (Wallet.spendCoins(ECON.prices.moves)) { Save.data.boosters.moves++; this.renderWallet(); Game.continueWithMoves(); } } });
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
