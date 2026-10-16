"""Career Track: all 150 challenges, promotions, streak reset, win-screen card, finishing level 150.
Run from the salon-swap folder:  python3 tests/check_career.py
(needs: pip install playwright && python3 -m playwright install chromium)"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"; OUT.mkdir(exist_ok=True)
URL = (ROOT / "index.html").as_uri()
import asyncio, json
from playwright.async_api import async_playwright
SEEDSAVE="""()=>{const st={},best={};for(let n=1;n<=43;n++){st[n]=3;best[n]=50000}
 const d={v:1,createdAt:Date.now(),savedAt:0,settings:{muted:true,showDebug:false,pipTone:2},
  progress:{unlocked:44,stars:st,best,fails:{}},help:{howTo:true,seen:{gel:true,ice:true,chain:true,box:true,drop:true},carriedOver:true,world:2,pip:true},
  boosters:{hammer:1,shuffle:1,moves:1},daily:{lastClaim:'2099-01-01',streak:1},stats:{levelsWon:43},
  wallet:{coins:1500,gems:3,backpaid:true,worldPaid:{1:true},perfectPaid:{1:true},owned:{}}};
 localStorage.setItem('msalon.save',JSON.stringify(d));}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844},device_scale_factor=2)
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        await pg.add_init_script("if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');("+SEEDSAVE+")()}")
        await pg.goto(URL); await pg.wait_for_timeout(2000)
        r=await pg.evaluate("""()=>{const C=window.__game.Career;const out=[];let rep=0,prev='';const counts={};
          for(let L=1;L<=150;L++){const c=C.challenge(L);if(c.type.t===prev)rep++;prev=c.type.t;counts[c.type.t]=(counts[c.type.t]||0)+1;
            if([1,2,3,10,24,25,26,50,75,100,125,149,150].includes(L))out.push(L+': '+c.text+'  ['+c.reward.label+']')}
          return {sample:out,repeats:rep,counts,saveCareer:window.__game.Save.data.career}}""")
        print(json.dumps(r, ensure_ascii=False, indent=0))
        await pg.evaluate("()=>{window.__game.UI.hideModal();window.__game.UI.showMissions('track')}"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT)+"/c_track1.png")
        # real play: does progress move?
        r=await pg.evaluate("""async()=>{const g=window.__game,G=g.Game,C=g.Career;g.UI.hideModal();g.Tweens.speed=25;g.Sound.play=()=>{};
          const before={...C.d};
          for(const n of [44,45,46]){g.UI.showScreen('game');await G.startLevel(n);
            for(let i=0;i<40&&G.state==='play';i++){const m=g.Board.findMoves();const k=m[Math.floor(Math.random()*m.length)];await G.trySwap(k.a,k.b)}
            if(G.state==='play'){G.movesLeft=1;G.level.goals.forEach(x=>{if(x.type==='score')x.need=0;else x.have=x.need});const m=g.Board.findMoves()[0];await G.trySwap(m.a,m.b)}
            g.UI.hideModal();}
          return {before,after:{lvl:C.d.lvl,progress:C.d.progress,recent:C.d.recent}}}""")
        print("PLAY", json.dumps(r, ensure_ascii=False))
        # force-complete to level 25 and check promotion + rewards
        r=await pg.evaluate("""async()=>{const g=window.__game,C=g.Career,W=g.Wallet,inv=g.Save.data.boosters;g.UI.hideModal();
          const c0=W.coins(),g0=W.gems(),b0={...inv};
          while(C.d.lvl<=25){const c=C.challenge(C.d.lvl);C.event(c.type.ev,{amount:c.target,id:'x'})}
          return {lvl:C.d.lvl,pending:C.d.pendingRank,coins:W.coins()-c0,gems:W.gems()-g0,boosters:[b0,{...inv}],owned:g.Save.data.wallet.owned}}""")
        print("TO 25", json.dumps(r, ensure_ascii=False))
        await pg.evaluate("()=>{const g=window.__game;g.UI.hideModal();g.UI.showScreen('title')}"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(OUT)+"/c_promo.png")
        await pg.evaluate("()=>{window.__game.UI.hideModal();window.__game.UI.showMissions('track')}"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT)+"/c_track26.png")
        # streak reset
        r=await pg.evaluate("""()=>{const C=window.__game.Career;let L=C.d.lvl;while(!C.challenge(C.d.lvl).type.streak){const c=C.challenge(C.d.lvl);C.event(c.type.ev,{amount:c.target,id:'x'})}
          const c=C.challenge(C.d.lvl);C.event('win');const a=C.d.progress;C.event('lose');return [C.d.lvl,c.text,a,C.d.progress]}""")
        print("STREAK", r)
        # win card when a career level finishes during a win
        r=await pg.evaluate("""async()=>{const g=window.__game,G=g.Game,C=g.Career;g.UI.hideModal();
          while(C.challenge(C.d.lvl).type.ev!=='win'||C.challenge(C.d.lvl).type.streak){const c=C.challenge(C.d.lvl);C.event(c.type.ev,{amount:c.target,id:'x'})}
          C.d.progress=C.challenge(C.d.lvl).target-1;
          g.UI.showScreen('game');await G.startLevel(47);G.movesLeft=0;G.level.goals.forEach(x=>{if(x.type==='score')x.need=0;else x.have=x.need});await G.win();
          return [...document.querySelectorAll('.panel-reward')].map(e=>e.innerText.replace(/\\n/g,' | '))}""")
        print("WIN CARDS", r)
        await pg.screenshot(path=str(OUT)+"/c_win.png")
        # finish to 150
        r=await pg.evaluate("""()=>{const g=window.__game,C=g.Career;g.UI.hideModal();while(!C.complete()){const c=C.challenge(C.d.lvl);C.event(c.type.ev,{amount:c.target,id:'x'})}
          return {lvl:C.d.lvl,pending:C.d.pendingRank,light:g.Save.data.wallet.owned.lightTiles,owned:g.Save.data.wallet.owned,coins:g.Wallet.coins(),gems:g.Wallet.gems()}}""")
        print("TO 150", json.dumps(r))
        await pg.evaluate("()=>{const g=window.__game;g.UI.hideModal();g.UI.showMissions('track')}"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT)+"/c_done_modal.png")
        print("errors", errs); await b.close()
asyncio.run(main())
