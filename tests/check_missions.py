"""Call Sheet: sheet generation, real-play progress, claiming, That's a wrap!, bonus mission, 48-hour reset.
Run from the salon-swap folder:  python3 tests/check_missions.py
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
        await pg.evaluate("()=>window.__game.UI.hideModal()")
        await pg.screenshot(path=str(OUT)+"/m_title.png")
        r=await pg.evaluate("()=>{const M=window.__game.Missions;const d=M.ensure();return d.list.map(m=>[m.id,M.text(m),JSON.stringify(m.reward)])}")
        print("SHEET", json.dumps(r, ensure_ascii=False))
        await pg.evaluate("()=>window.__game.UI.showMissions()"); await pg.wait_for_timeout(300); await pg.screenshot(path=str(OUT)+"/m_sheet.png")
        # real gameplay: auto-play 3 levels quickly and see progress
        r=await pg.evaluate("""async()=>{const g=window.__game,G=g.Game,M=g.Missions;g.UI.hideModal();g.Tweens.speed=25;g.Sound.play=()=>{};
          for(const n of [44,45]){g.UI.showScreen('game');await G.startLevel(n);
            for(let i=0;i<40&&G.state==='play';i++){const m=g.Board.findMoves();const k=m[Math.floor(Math.random()*m.length)];await G.trySwap(k.a,k.b)}
            if(G.state==='play'){G.movesLeft=1;G.level.goals.forEach(x=>{if(x.type==='score')x.need=0;else x.have=x.need});const m=g.Board.findMoves()[0];await G.trySwap(m.a,m.b)}
            g.UI.hideModal();}
          return M.d.list.map(m=>[m.id,m.progress,m.target,m.done])}""")
        print("AFTER PLAY", r)
        # force all done, claim each, wrap, bonus
        r=await pg.evaluate("""async()=>{const g=window.__game,M=g.Missions,inv=g.Save.data.boosters;const b0={...inv},c0=g.Wallet.coins(),gm0=g.Wallet.gems();
          M.d.list.forEach(m=>{if(!m.done){m.progress=m.target-1;M.event(M.tpl(m.id).ev,{id:m.kindId,amount:m.target})}});
          const dot=document.getElementById('btnMissions').classList.contains('has-dot');
          g.UI.showMissions();
          for(let i=0;i<5;i++){const btn=document.querySelector(`#panel [data-act="claim${i}"]`);if(btn)btn.click()}
          const shot1=document.getElementById('panel').innerText.slice(0,60);
          document.querySelector('#panel [data-act="wrap"]').click();
          const bonus=M.d.bonus;M.event(M.tpl(bonus.id).ev,{amount:99,id:bonus.kindId});
          g.UI.showMissions();document.querySelector('#panel [data-act="claimb"]').click();
          return {dot,boostersBefore:b0,boostersAfter:{...inv},coins:g.Wallet.coins()-c0,gems:g.Wallet.gems()-gm0,bonus:[bonus.id,M.text(bonus)],claimable:M.claimable()}}""")
        print("CLAIM ALL", json.dumps(r, ensure_ascii=False))
        await pg.screenshot(path=str(OUT)+"/m_done.png")
        # 48h rollover
        r=await pg.evaluate("""()=>{const M=window.__game.Missions;const before=M.d.win;const real=Date.now;Date.now=()=>real()+48*3600*1000;M.ensure();const after=M.d.win;const list=M.d.list.map(m=>M.text(m));Date.now=real;return {before,after,list,wrap:M.d.wrapClaimed,bonus:M.d.bonus}}""")
        print("ROLLOVER", json.dumps(r, ensure_ascii=False))
        # streak resets on lose
        r=await pg.evaluate("""()=>{const M=window.__game.Missions;M.d.list=[M.make(M.tpl('h_streak'),Math.random,2)];M.event('win');M.event('win');const a=M.d.list[0].progress;M.event('lose');return [a,M.d.list[0].progress]}""")
        print("STREAK", r)
        await pg.evaluate("()=>{const g=window.__game;g.UI.hideModal();g.UI.openMap()}"); await pg.wait_for_timeout(700)
        await pg.evaluate("()=>window.__game.UI.hideModal()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT)+"/m_map.png")
        print("errors", errs); await b.close()
asyncio.run(main())
