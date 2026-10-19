'use strict';
/* =========================================================
   Myesha's Salon Swap — js/config.js
   Your personal touches: her name, your messages, the finale credits and plaque,
   coin pack names, game speed and sound levels. Edit freely — nothing else lives here.
   ========================================================= */

/* ---------- 1. CONFIG ---------- */
const CONFIG = {
  playerName: 'Myesha',
  gameName: 'Salon Swap',
  cols: 8,
  rows: 8,
  kinds: 6,           // number of tile types in play (levels can lower this later)
  swapMs: 170,        // how long a swap slide takes
  popMs: 230,         // how long a cleared tile takes to pop away
  pointsPerTile: 60,  // base score per cleared tile (× cascade level)
  maxCascadeMultiplier: 5,
  specialBonus: 150,  // extra points each time a special tile goes off
  chainStepMs: 90,    // delay between links in a chain reaction
  // Stars (levels without a score goal): moves × points-per-move × factor.
  // Fewer tile types = bigger cascades, so they need more points per move.
  scorePerMove: { 4: 1100, 5: 800, 6: 600 },
  star2Factor: 0.85,
  star3Factor: 1.4,
  finaleMaxTiles: 8,  // leftover moves that become Line tiles when she wins
  leftoverBonus: 250, // points per leftover move
  masterVolume: 1.6, // overall loudness (phone speakers are small)
  musicVolume: 0.55,  // 0–1
  sfxVolume: 0.85,    // 0–1
  idleHintMs: 7000,   // show a quiet hint after this long without a move
  unstickMs: 4000,    // safety net: unlock the board if it sits locked this long with nothing moving

  // ===== Coin refill packs (pretend store — no real money anywhere) =====
  // Tapping one gives the coins right away. Change the names and "prices" to anything you like.
  coinPacks: [
    { coins: 500,  name: 'Tip jar',    price: '1 hug' },
    { coins: 1500, name: 'Big tip',    price: '1 kiss' },
    { coins: 5000, name: 'Wrap bonus', price: '1 date night' },
  ],

  // Special links (add to the end of the game's address):
  //   ?beat=30   → marks levels 1–30 complete (1★ each) so she continues at 31.
  //                Only ever moves progress forward, never back.
  //   ?reset=1   → wipes this device's progress and starts over at level 1.
  showDebug: false,   // test info line under the board; tap the big title to toggle

  // ===== Chris's messages =====
  // {name} becomes her name (playerName above).

  // Bubble after a swap that doesn't match.
  oopsMessages: [
    'IKYFL!',
    "I'm gonna tell ur momma.",
    '{name}, really?',
  ],

  // After this many bad moves in a row she gets a "stuck" line, then a hint.
  stuckAfter: 3,
  stuckMessages: [
    "Do you know what you're doing?",
    'Need help?',
    'Hmm...',
  ],
  hintMessages: [
    'Here you go',
    'I gotcha',
    'Hint',
  ],

  // Win screen when she passes a level.
  winMessages: [
    'You always wanna be right',
    'Tell me you love me.',
    'Ready for another level?',
  ],

  // Extra win lines per world (mixed in with yours above).
  worldWinMessages: {
    2: ["That's a wrap on that one!", 'Check the gate — we got it!', 'Perfect take!', 'Moving on — next setup!'],
    5: ['Turn it up!', 'The dance floor is yours!', 'DJ, play her song!', 'Encore! Encore!'],
    4: ['That’s a print!', 'Golden hour, golden take!', 'Location scouts are jealous!', 'Moving to the next setup!'],
    3: ['Order up!', 'The crew says thank you!', 'Seconds, anyone?', 'Chef’s kiss!'],
    6: ['And the award goes to… {name}!', "{name}, you've earned this one.", 'Standing ovation!', 'Speech! Speech!'],
  },

  // ===== Level 180 finale: end credits =====
  fullName: 'Myesha Starks',
  awardTitle: 'Best Hair Department',
  // Her real credits (from her resume): 'Title (type) | Role'. Add or remove lines anytime.
  credits: [
    'Bad Monkey (TV Series) | Key Hairstylist',
    'Aces (Limited Series) | Personal Hairstylist',
    'Forever (Netflix Series) | Hairstylist',
    'Merry Gentlemen (Netflix Film) | Hairstylist',
    '9-1-1 (TV Series) | Key Hairstylist',
    '9-1-1: Lone Star (TV Series) | Additional Hairstylist',
    'Sweetwater (Feature Film) | Department Head Hairstylist',
    'Good Trouble (TV Series) | Hairstylist',
    'Winning Time: The Rise of the Lakers Dynasty (HBO) | Hairstylist',
    'The Orville, Season 3 (TV Series) | Hairstylist',
    'Love, Victor (Hulu Series) | Hairstylist',
    'American Horror Story (FX Series) | Day Player Hairstylist',
    'Saturday Morning All Stars (Netflix) | Key Hairstylist',
    'Generation (HBO Series) | Department Head Hairstylist',
    'The Guest House (Feature Film) | Department Head Hairstylist',
    'Blindfire (Feature Film) | Department Head Hairstylist',
    'This Is Us (NBC Series) | Hairstylist',
    'Legendary (HBO Series) | Hairstylist',
    'Warped (Nickelodeon Series) | Personal Hairstylist',
    'Hungry (TV Series) | Key Hairstylist',
    'Michael (Feature Film) | Hairstylist',
    'Lucky Strike (Feature Film) | Hairstylist',
  ],
  honors: 'Emmy-Nominated Hairstylist',
  // Chris: replace this with your own message to her.
  finaleMessage: "From the first chair to the red carpet — I've watched you earn every bit of it. I'm so proud of you.",
  finaleSignature: '— Chris',

  // ===== Hidden Oz finale =====
  // On the final trophy plaque, tapping the trophy three times opens a secret scene:
  // she walks the yellow-brick road past her six worlds into the Emerald City,
  // where her credits light up. These are the words on the last card.
  ozHint: 'psst… tap the trophy three times',
  ozTitle: 'Every step was yours, Mimi.',
  ozMessage: 'From the first chair to the Emerald City — every set, every take, every credit.',
  ozTagline: 'No place like the chair 💚💗',
};
