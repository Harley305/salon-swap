'use strict';
/* =========================================================
   Myesha's Salon Swap — js/boot.js
   Starts the game once everything above has loaded.
   ========================================================= */

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
setInterval(() => Game.watchdog(), 500);

window.__game = { Career, Missions, LevelRewards, Wallet, ECON, Board, Game, Save, Render, Loop, FX, UI, Tweens, BOMB, makeTile, buildLevel, LEVELS, Pip, World,
                  Sound, Music, Particles, Shake, Confetti, Daily };
