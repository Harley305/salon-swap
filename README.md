# Myesha's Salon Swap

A match-3 puzzle game made by Chris for his wife, Myesha. It follows her journey through motion-picture hairstyling, from her first day in the city to her big night on the red carpet.

**Play:** https://harley305.github.io/salon-swap/

Plays in the browser on iPhone, iPad and Mac. Touch, mouse and Apple Pencil all work. There's nothing to install.

---

## How to play

- Swipe (or tap two tiles) to swap neighbors and line up 3 or more of the same tile.
- Each level has **goals** at the top. Tap them to see what they mean in plain words.
- Matching 4 or 5 in a row makes special tiles. Swap two specials together for a combo.
- Stuck? After a few bad moves Pip gives a hint.
- Win with moves to spare for more stars (up to ★★★). Any level can be replayed from the map, and the best result is kept.
- Gel: tiles sitting on gel look light. Match them to clear it — a ×2 badge means it needs two matches.
- Boosters: 🔨 Hammer (smash one tile), 🌪️ Twister (shuffle), +5 moves. There's a daily gift too.
- Beating a 👑 boss board gives a free booster, and clearing a world gives 2 of each (first win only).
- Fail a level 3 times and the game quietly adds 2 extra moves to help.

## The six worlds (180 levels)

Each world has three 10-level acts: **Introduction**, **Obstacles** and **Master Board**. Every 10th level is a 👑 boss board.

| World | Levels | Theme | Item to deliver | Music |
|---|---|---|---|---|
| 1 · City Streets | 1–30 | Salon tiles, a yellow brick road into town | Coffee | "The Road to the Salon" / "Emerald Evening" |
| 2 · The Studio Set | 31–60 | Film-set tiles, theater stage | Script pages | "Backstage Swing" |
| 3 · The Crafty Table | 61–90 | Crew food, catering tent | Cake slice | "Snack Break" |
| 4 · On Location | 91–120 | Desert & beach shoot at golden hour | Water bottle | "Golden Hour" |
| 5 · The Wrap Party | 121–150 | Neon lights, disco ball, dance floor | Mixtape | "Dance Floor" |
| 6 · Cinematic Credits | 151–180 | Red carpet and awards | — | "Her Big Night" |

After level 180 the trophy and end credits play. New levels keep coming after that with no fixed end.

**Pip** is her guide: a little wig head whose hairstyle changes in every world. Tap Pip on the title screen to choose a skin tone.

All art, music and characters are original. The Wizard of Oz / Wicked touches are small easter eggs only.

## Saving

- Progress saves automatically on each device, with a backup copy.
- **💾 Save & Load** (title screen) moves progress to another device with a save file or a copy-and-paste code.
- **↺ Start over from level 1** is at the bottom of Save & Load.

## Coins & gems

- **Coins:** 30 for clearing a level the first time, 10 for replaying one, and 200 extra for clearing a world.
- **Gems:** 3 for clearing a world, plus 1 more when every level in that world has ★★★.
- **🛍️ Shop** (title screen, or tap the coin counter): coins buy boosters (Hammer 75, Twister 60, +5 Moves 90). Gems buy a booster bundle, the light tile style, and Pip's looks from any world.
- **Get coins:** pretend coin packs (no real money) or replay cleared levels. Edit the pack names and "prices" in `CONFIG → coinPacks` at the top of `script.js`.
- Free boosters still come from the Daily Gift, boss boards and world clears.
- Players who already had progress get a one-time "Back pay" for the levels and worlds they'd already cleared.

## 📋 Missions

- **Call Sheet:** 5 missions (2 easy, 2 medium, 1 hard) that change every 2 days at midnight. A countdown shows when the next one arrives.
- Missions count during normal play (wins, first tries, ★★★, specials, gel, ice, boxes, score…). Pip calls it out when one finishes.
- Tap **Claim** for each mission's boosters. Finish all 5 for **That's a wrap!** (1 of each booster + 100 🪙), which unlocks a **bonus mission** worth 1 💎.
- A pink dot on 📋 means something is ready to claim. Open it from the title screen or the 📋 button on the map.
- **Career Track:** a permanent 150-level climb — one challenge at a time (win levels, first tries, ★★★, specials, gel, bosses, streaks…), counted during normal play and never reset.
  - Every level pays coins or a booster; every 10th pays 100 🪙 + 1 of each booster.
  - Every 25 levels is a promotion: Day Player → Hair Assistant → Key Hairstylist → Department Head → Award Nominee → Hall of Fame (2 💎, 1 of each booster and a free Pip look).
  - Level 150 unlocks the light tile style and 5 💎.

## If the board ever freezes

The game repairs itself. If a move hits an error, it puts the tiles back in place, fills any gaps, and unlocks the board right away. If a move ever stalls with nothing moving, a safety net unlocks it after about 4 seconds. Progress and stars are never lost.

To change that wait, edit `unstickMs` in CONFIG at the top of `script.js` (4000 = 4 seconds).

## Test links

Add these to the end of the game address:

| Link | What it does |
|---|---|
| `?beat=89` | Unlocks everything through level 90 (any number up to 500). It only moves progress forward, never back. |
| `?reset=1` | Wipes that device's progress and starts over at level 1. |

Tip: use a **private window** to preview levels without touching a real save.

## Changing the messages

Everything personal is at the top of `script.js` in the `CONFIG` section:

| Setting | What it is |
|---|---|
| `playerName` | Her name on the title and in the messages |
| `oopsMessages` | Bubble after a swap that doesn't match |
| `stuckMessages` | After 3 bad moves in a row |
| `hintMessages` | When Pip shows the hint |
| `winMessages` | Win screen lines |
| `worldWinMessages` | Extra win lines for each world |
| `fullName`, `awardTitle`, `credits` | Her name, award and real credits in the finale |
| `finaleMessage`, `finaleSignature` | The thank-you note at the end of the credits |
| `masterVolume`, `musicVolume`, `sfxVolume` | Loudness |

`{name}` in any message becomes her name.

## Updating the live game

The game files live in `~/Desktop/salon-swap` on the MacBook. After changing them, open Terminal and run:

```
cd ~/Desktop/salon-swap && git add -A && git commit -m "describe the change" && git push
```

GitHub Pages updates the live link in about a minute. When the code changes, bump the `?v=` number on the two file links in `index.html` so phones load the new version instead of an old saved copy.

## Files

| File | What's in it |
|---|---|
| `index.html` | The page layout |
| `style.css` | Colors, backgrounds and layout for every world |
| `script.js` | The whole game: settings, art, levels, sound, music and saving |
| `README.md` | This guide |

Made with love by Chris. ❤️
