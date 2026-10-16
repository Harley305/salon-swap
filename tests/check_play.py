"""Auto-plays about 68 levels across all worlds and checks the board after every move, then forces errors mid-move to prove the freeze safety net repairs and unlocks the board.
Run from the salon-swap folder:  python3 tests/check_play.py
(needs: pip install playwright && python3 -m playwright install chromium)"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"; OUT.mkdir(exist_ok=True)
URL = (ROOT / "index.html").as_uri()
import asyncio, json, sys
from playwright.async_api import async_playwright


SETUP = """async () => {
  const g = window.__game;
  g.Save.data.help.howTo = true; g.Save.data.help.pip = true;
  g.Sound.play = () => {};
  g.Tweens.speed = 25;
  window.T = {
    async start(n) {
      g.UI.showScreen('game');
      await new Promise(r => setTimeout(r, 30));
      await g.Game.startLevel(n);
    },
    // Board must be: every non-box cell filled, tiles sitting in their cells,
    // no leftover matches, at least one move, and unlocked while playing.
    check() {
      const B = g.Board, G = g.Game, bad = [];
      for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
        const t = B.grid[r][c];
        if (B.cells[r][c].box) continue;
        if (!t) { bad.push('hole ' + r + ',' + c); continue; }
        if (t.r !== r || t.c !== c) bad.push('wrong cell ' + r + ',' + c);
        if (Math.abs(t.x - c) > 1e-6 || Math.abs(t.y - r) > 1e-6) bad.push('off-grid ' + r + ',' + c);
        if (t.alpha !== 1) bad.push('faded ' + r + ',' + c);
      }
      if (G.state === 'play') {
        if (G.locked) bad.push('LOCKED');
        if (B.findMatches().length) bad.push('leftover match');
        if (!B.findMoves().length) bad.push('no moves');
      }
      return bad;
    },
    async move() {
      const m = g.Board.findMoves();
      const pick = m[Math.floor(Math.random() * m.length)];
      await g.Game.trySwap(pick.a, pick.b);
    },
    // break one function exactly once
    breakOnce(obj, name, how) {
      const orig = obj[name];
      obj[name] = function (...args) {
        obj[name] = orig;
        if (how === 'hang') return new Promise(() => {});
        throw new Error('test fault in ' + name);
      };
    },
  };
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        page_errors = []
        pg.on("pageerror", lambda e: page_errors.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.evaluate(SETUP)

        # ---------- 1. auto-player across all six worlds ----------
        levels = list(range(1, 181, 3)) + [10, 30, 60, 90, 120, 150, 180, 185]
        r = await pg.evaluate("""async (levels) => {
          const g = window.__game, out = { levels: 0, moves: 0, wins: 0, losses: 0, failures: [] };
          for (const n of levels) {
            await T.start(n); out.levels++;
            let bad = T.check(); if (bad.length) out.failures.push({ n, at: 'start', bad });
            for (let i = 0; i < 25 && g.Game.state === 'play'; i++) {
              await T.move(); out.moves++;
              bad = T.check();
              if (bad.length) { out.failures.push({ n, move: i, bad }); break; }
            }
            if (g.Game.state === 'won') out.wins++;
            if (g.Game.state === 'lost') out.losses++;
          }
          out.recoveries = g.Game.recoveries || 0;
          return out;
        }""", levels)
        print("AUTO-PLAYER:", json.dumps(r))

        # ---------- 2. fault injection: throw mid-move ----------
        faults = [
          ("clearCells", "swap", "throw during a clear"),
          ("collapse", "swap", "throw during gravity"),
          ("planMatches", "swap", "throw while planning specials"),
          ("prepareCombo", "combo", "throw during a special+special combo"),
          ("resolveBoard", "hammer", "throw during a hammer smash"),
          ("shuffle", "booster", "throw during the Twister booster"),
        ]
        for name, how, label in faults:
            res = await pg.evaluate("""async ([name, how]) => {
              const g = window.__game, G = g.Game;
              await T.start(40);
              G.movesLeft = 50; G.level.goals.forEach(x => x.need = 9999);
              const before = G.recoveries || 0;
              T.breakOnce(G, name);
              if (how === 'swap') await T.move();
              else if (how === 'combo') {
                const m = g.Board.findMoves()[0];
                const ta = g.Board.grid[m.a.r][m.a.c], tb = g.Board.grid[m.b.r][m.b.c];
                ta.special = 'lineH'; tb.special = 'lineV';
                await G.trySwap(m.a, m.b);
              } else if (how === 'hammer') {
                g.Save.data.boosters.hammer = 3;
                let cell; g.Board.forEachTile((t, r, c) => { if (!cell && !t.lock && !t.drop) cell = { r, c }; });
                await G.hammerAt(cell);
              } else if (how === 'booster') {
                g.Save.data.boosters.shuffle = 3;
                await G.useBooster('shuffle');
              }
              const afterFault = T.check();
              await T.move();                      // she can keep playing
              return { recovered: (G.recoveries || 0) - before, afterFault, afterNextMove: T.check(), state: G.state };
            }""", [name, how])
            ok = res["recovered"] == 1 and not res["afterFault"] and not res["afterNextMove"]
            print(("PASS" if ok else "FAIL"), "fault:", label, json.dumps(res))

        # ---------- 3. fault during the win finale: stars must still save ----------
        res = await pg.evaluate("""async () => {
          const g = window.__game, G = g.Game;
          await T.start(12);
          const n = G.level.n;
          g.Save.data.progress.unlocked = Math.min(g.Save.data.progress.unlocked, n);
          G.movesLeft = 6;
          G.level.goals.forEach(x => { if (x.type === 'score') x.need = 0; else x.have = x.need; });
          T.breakOnce(G, 'resolveBoard');
          await G.win();
          return { state: G.state, unlocked: g.Save.data.progress.unlocked, n,
                   stars: g.Save.data.progress.stars[n] || 0, winScreen: !!document.querySelector('.show, .open, [data-open]') };
        }""")
        ok = res["state"] == "won" and res["unlocked"] >= res["n"] + 1
        print(("PASS" if ok else "FAIL"), "fault: throw during win finale", json.dumps(res))

        # ---------- 4. watchdog: a move that never finishes ----------
        res = await pg.evaluate("""async () => {
          const g = window.__game, G = g.Game;
          await T.start(75);
          G.movesLeft = 50; G.level.goals.forEach(x => x.need = 9999);
          const before = G.recoveries || 0;
          T.breakOnce(G, 'clearCells', 'hang');
          T.move();                                   // never resolves
          await new Promise(r => setTimeout(r, 300));
          const lockedDuringHang = G.locked;
          const t0 = performance.now();
          while (G.locked && performance.now() - t0 < 8000) await new Promise(r => setTimeout(r, 100));
          const unlockAfterMs = Math.round(performance.now() - t0 + 300);
          const afterWatchdog = T.check();
          await T.move();
          return { lockedDuringHang, unlockAfterMs, recovered: (G.recoveries || 0) - before,
                   afterWatchdog, afterNextMove: T.check() };
        }""")
        ok = res["lockedDuringHang"] and res["recovered"] == 1 and not res["afterWatchdog"] and not res["afterNextMove"]
        print(("PASS" if ok else "FAIL"), "watchdog: move that never finishes", json.dumps(res))

        # ---------- 5. watchdog must NOT fire during long legit animations ----------
        res = await pg.evaluate("""async () => {
          const g = window.__game, G = g.Game;
          g.Tweens.speed = 1;                          // real speed: longest cascades
          await T.start(150);
          G.movesLeft = 50; G.level.goals.forEach(x => x.need = 9999);
          const before = G.recoveries || 0;
          for (let i = 0; i < 12 && G.state === 'play'; i++) await T.move();
          g.Tweens.speed = 25;
          return { falseAlarms: (G.recoveries || 0) - before, bad: T.check() };
        }""")
        ok = res["falseAlarms"] == 0 and not res["bad"]
        print(("PASS" if ok else "FAIL"), "watchdog stays quiet on 12 real-speed moves", json.dumps(res))

        print("uncaught page errors:", page_errors)
        await b.close()

asyncio.run(main())
