"""Coins and gems: back pay, payouts, caps, every shop purchase, coin packs, buying +5 on the lose screen.
Run from the salon-swap folder:  python3 tests/check_economy.py
(needs: pip install playwright && python3 -m playwright install chromium)"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"; OUT.mkdir(exist_ok=True)
URL = (ROOT / "index.html").as_uri()
import asyncio, json
from playwright.async_api import async_playwright
# A save like hers: levels 1-43 cleared, world 1 all 3-star except one, then reload
SEEDSAVE="""()=>{const st={},best={};for(let n=1;n<=43;n++){st[n]=n===7?2:3;best[n]=50000}
 const d={v:1,createdAt:Date.now(),savedAt:0,settings:{muted:true,showDebug:false,pipTone:2},
  progress:{unlocked:44,stars:st,best,fails:{}},help:{howTo:true,seen:{gel:true,ice:true,chain:true,box:true},carriedOver:true,world:2,pip:true},
  boosters:{hammer:1,shuffle:0,moves:0},daily:{lastClaim:new Date().toISOString().slice(0,10),streak:1},stats:{levelsWon:43}};
 localStorage.setItem('msalon.save',JSON.stringify(d));}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844},device_scale_factor=2)
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.add_init_script("if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');("+SEEDSAVE+")()}")
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        # daily key format may differ; dismiss whatever modal, look for backpay
        r=await pg.evaluate("()=>{const g=window.__game;return {wallet:{...g.Save.data.wallet},panel:document.getElementById('panel').innerText.slice(0,200),modal:!document.getElementById('modal').hidden}}")
        print("AFTER LOAD", json.dumps(r, ensure_ascii=False))
        await pg.screenshot(path=str(OUT)+"/e_title.png")
        # close modals until backpay shows
        for i in range(4):
            txt=await pg.evaluate("()=>document.getElementById('panel').innerText")
            if 'Back pay' in txt: break
            await pg.evaluate("()=>{const b=document.querySelector('#panel [data-act]');if(b)b.click()}"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(OUT)+"/e_backpay.png")
        await pg.evaluate("()=>window.__game.UI.showShop()"); await pg.wait_for_timeout(400); await pg.screenshot(path=str(OUT)+"/e_shop.png", full_page=True)
        await pg.evaluate("()=>document.querySelector('#panel').scrollTop=9999"); await pg.wait_for_timeout(200); await pg.screenshot(path=str(OUT)+"/e_shop2.png")
        # buy hammer, bundle (gems), pip look 4, light tiles
        res=await pg.evaluate("""async()=>{const g=window.__game,W=g.Wallet,click=a=>document.querySelector(`#panel [data-act="${a}"]`).click();
          const out=[];const snap=l=>out.push([l,W.coins(),W.gems(),{...g.Save.data.boosters}]);
          W.d.gems=12;snap('start');g.UI.showShop();click('buy_hammer');snap('buy hammer');click('gem_bundle');snap('bundle');
          click('look_4');snap('pip4');click('look_4');snap('pip4 again (owned)');click('gem_light');snap('light tiles');
          click('toggle_light');snap('toggle');click('toggle_light');snap('toggle back');
          return {out,owned:g.Save.data.wallet.owned,look:g.Save.data.settings.pipLook,light:g.Save.data.settings.lightTiles}}""")
        print("SHOP", json.dumps(res, ensure_ascii=False))
        await pg.screenshot(path=str(OUT)+"/e_shop_after.png")
        # refill
        r=await pg.evaluate("""()=>{const g=window.__game,W=g.Wallet;const c0=W.coins();g.UI.showRefill();document.querySelector('#panel [data-act="pack0"]').click();return [c0,W.coins()]}""")
        print("REFILL pack0", r)
        await pg.evaluate("()=>window.__game.UI.showRefill()"); await pg.wait_for_timeout(300); await pg.screenshot(path=str(OUT)+"/e_refill.png")
        # wins: first, repeat, world clear 60 (first), perfect gem on later 3-star
        r=await pg.evaluate("""async()=>{const g=window.__game,G=g.Game,W=g.Wallet;g.Tweens.speed=25;g.Sound.play=()=>{};const out=[];
          async function win(n,stars3){g.UI.hideModal();g.UI.showScreen('game');await G.startLevel(n);G.movesLeft=0;
            G.level.goals.forEach(x=>{if(x.type==='score')x.need=0;else x.have=x.need});
            if(stars3){G.score=1e9}
            const c0=W.coins(),g0=W.gems();await G.win();
            out.push({n,coins:W.coins()-c0,gems:W.gems()-g0,cards:[...document.querySelectorAll('.panel-reward,.panel-coins')].map(e=>e.innerText.replace(/\\n/g,' | '))});}
          await win(44); await win(44);
          for(let n=45;n<=59;n++){g.Save.data.progress.stars[n]=1}
          await win(60);
          // perfect world 1: level 7 had 2 stars -> replay with 3
          await win(7,true);
          await win(7,true);
          // caps
          W.d.coins=99990; W.addCoins(500); W.d.gems=998; W.addGems(5);
          out.push({caps:[W.coins(),W.gems()]});
          return out}""")
        for x in r: print("WIN", json.dumps(x, ensure_ascii=False))
        await pg.screenshot(path=str(OUT)+"/e_win.png")
        # map header
        await pg.evaluate("()=>{const g=window.__game;g.UI.hideModal();g.UI.openMap()}"); await pg.wait_for_timeout(800); await pg.screenshot(path=str(OUT)+"/e_map.png")
        # lose screen buy +5
        r=await pg.evaluate("""async()=>{const g=window.__game,G=g.Game,W=g.Wallet;g.UI.hideModal();W.d.coins=500;g.Save.data.boosters.moves=0;
          g.UI.showScreen('game');await G.startLevel(45);G.level.goals.forEach(x=>x.need=9999);G.movesLeft=0;await G.lose();
          const has=!!document.querySelector('#panel [data-act="buymore"]');document.querySelector('#panel [data-act="buymore"]').click();
          return {has,coins:W.coins(),state:G.state,moves:G.movesLeft}}""")
        print("LOSE BUY", r)
        # empty booster -> shop
        r=await pg.evaluate("""()=>{const g=window.__game;g.Save.data.boosters.shuffle=0;g.UI.updateBoosters();document.querySelector('[data-booster="shuffle"]').click();
          return document.getElementById('panel').innerText.includes('Shop')}""")
        print("EMPTY BOOSTER OPENS SHOP", r)
        await pg.evaluate("()=>window.__game.UI.hideModal()"); await pg.wait_for_timeout(600); await pg.screenshot(path=str(OUT)+"/e_lighttiles.png")
        print("errors", errs); await b.close()
asyncio.run(main())
