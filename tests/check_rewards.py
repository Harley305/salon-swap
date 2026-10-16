"""Boss-board and world-clear booster rewards (first win only).
Run from the salon-swap folder:  python3 tests/check_rewards.py
(needs: pip install playwright && python3 -m playwright install chromium)"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"; OUT.mkdir(exist_ok=True)
URL = (ROOT / "index.html").as_uri()
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width":390,"height":844})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        r = await pg.evaluate("""async () => {
          const g = window.__game, G = g.Game, S = g.Save;
          S.data.help.howTo = true; S.data.help.pip = true; g.Tweens.speed = 25; g.Sound.play = () => {};
          const inv = () => ({ ...S.data.boosters });
          async function winLevel(n) {
            g.UI.showScreen('game'); await G.startLevel(n);
            G.movesLeft = 0; G.level.goals.forEach(x => { if (x.type === 'score') x.need = 0; else x.have = x.need; });
            const before = inv(); await G.win();
            const card = [...document.querySelectorAll('.panel-reward')].map(e => e.innerText.replace(/\\n/g, ' | '));
            const after = inv(), gained = {};
            for (const k in after) gained[k] = after[k] - before[k];
            return { n, gained, card };
          }
          return [await winLevel(9), await winLevel(10), await winLevel(10), await winLevel(30), await winLevel(60)];
        }""")
        for x in r: print(json.dumps(x, ensure_ascii=False))
        await pg.wait_for_timeout(3500); await pg.screenshot(path=str(OUT / "win60.png"))
        print("errors:", errs); await b.close()
asyncio.run(main())
