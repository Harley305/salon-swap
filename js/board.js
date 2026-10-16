'use strict';
/* =========================================================
   Myesha's Salon Swap — js/board.js
   The board itself: grid, swapping, finding matches and moves.
   ========================================================= */

/* ---------- 5. BOARD MODEL ----------
   grid[r][c]  → the tile in that cell (or null)
   cells[r][c] → what's under/around it: { gel, box, shake }
   tile.lock   → { type: 'ice' | 'chain', layers } — locked tiles can't
                 be swapped and don't fall, but still match by color. */
let nextTileId = 1;

function makeTile(kind, r, c) {
  return {
    id: nextTileId++,
    kind,
    r, c,          // logical cell
    x: c, y: r,    // drawn position in cell units (animated)
    scale: 1,
    alpha: 1,
    shake: 0,      // wobble when a lock cracks
    special: null, // 'lineH' | 'lineV' | 'bomb' | 'blast'
    lock: null,    // { type: 'ice' | 'chain', layers }
  };
}

function blankSpec(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ gel: 0, box: 0, lock: null, drop: false })));
}

const Board = {
  rows: CONFIG.rows,
  cols: CONFIG.cols,
  grid: [],
  cells: [],
  kinds: CONFIG.kinds,

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; },
  kindAt(r, c) { const t = this.inBounds(r, c) && this.grid[r] && this.grid[r][c]; return t ? t.kind : -1; },
  movable(r, c) { const t = this.inBounds(r, c) && this.grid[r][c]; return !!t && !t.lock; },
  dropsOnBoard() { let n = 0; this.forEachTile(t => { if (t.drop) n++; }); return n; },
  makeDrop(r, c) { const t = makeTile(DROP, r, c); t.drop = true; return t; },
  randomKind() { return Math.floor(Math.random() * this.kinds); },

  // Build the board for a level: blockers from the layout, tiles everywhere else.
  setup(spec, kinds) {
    this.kinds = kinds;
    spec = spec || blankSpec(this.rows, this.cols);
    this.cells = spec.map(row => row.map(s => ({ gel: s.gel, box: s.box, shake: 0 })));
    const isDrop = (r, c) => spec[r] && spec[r][c] && spec[r][c].drop;
    this.grid = spec.map(row => row.map(() => null));

    // No starting matches, and at least one move.
    for (let attempt = 0; attempt < 300; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.cells[r][c].box) { this.grid[r][c] = null; continue; }
          if (isDrop(r, c)) { this.grid[r][c] = this.makeDrop(r, c); continue; }
          let k, guard = 0;
          do {
            k = this.randomKind();
            guard++;
          } while (guard < 60 && (
            (this.kindAt(r, c - 1) === k && this.kindAt(r, c - 2) === k) ||
            (this.kindAt(r - 1, c) === k && this.kindAt(r - 2, c) === k)
          ));
          const t = makeTile(k, r, c);
          if (spec[r][c].lock) t.lock = { type: spec[r][c].lock.type, layers: spec[r][c].lock.layers };
          this.grid[r][c] = t;
        }
      }
      if (!this.hasAnyMatch() && this.findMoves().length) return;
    }
  },

  // Plain board with no blockers (used by tests / free play).
  generate(kinds = CONFIG.kinds) { this.setup(null, kinds); },

  // Length of the run of same-kind tiles through (r,c) in one direction pair.
  runLength(kinds, r, c, dr, dc) {
    const k = kinds[r][c];
    if (k < 0) return 0;
    let n = 1;
    for (let i = 1; this.inBounds(r + dr * i, c + dc * i) && kinds[r + dr * i][c + dc * i] === k; i++) n++;
    for (let i = 1; this.inBounds(r - dr * i, c - dc * i) && kinds[r - dr * i][c - dc * i] === k; i++) n++;
    return n;
  },

  matchesAt(kinds, r, c) {
    return this.runLength(kinds, r, c, 0, 1) >= 3 || this.runLength(kinds, r, c, 1, 0) >= 3;
  },

  kindsMatrix() {
    return this.grid.map(row => row.map(t => (t ? t.kind : -1)));
  },

  hasAnyMatch() {
    const k = this.kindsMatrix();
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.matchesAt(k, r, c)) return true;
    return false;
  },

  // Every swap that would do something. Used for hints + dead-board detection.
  findMoves() {
    const k = this.kindsMatrix();
    const moves = [];
    const trySwap = (r1, c1, r2, c2) => {
      if (!this.inBounds(r2, c2)) return;
      if (!this.movable(r1, c1) || !this.movable(r2, c2)) return;
      const t1 = this.grid[r1][c1], t2 = this.grid[r2][c2];
      if (!t1.drop && !t2.drop && (t1.special === 'bomb' || t2.special === 'bomb' || (t1.special && t2.special))) {
        moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });   // special combos always work
        return;
      }
      const a = k[r1][c1], b = k[r2][c2];
      if (r2 === r1 + 1 && t1.drop && !t2.drop) { moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } }); return; }
      if ((a < 0 && b < 0) || a === b) return;          // a drop can swap if the other tile makes a match
      k[r1][c1] = b; k[r2][c2] = a;
      if (this.matchesAt(k, r1, c1) || this.matchesAt(k, r2, c2)) {
        moves.push({ a: { r: r1, c: c1 }, b: { r: r2, c: c2 } });
      }
      k[r1][c1] = a; k[r2][c2] = b;
    };
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        trySwap(r, c, r, c + 1);
        trySwap(r, c, r + 1, c);
      }
    return moves;
  },

  // All runs of 3+ in a row or column (with length + direction for specials).
  findMatches() {
    const k = this.kindsMatrix();
    const runs = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const kind = k[r][c];
        let e = c + 1;
        while (kind >= 0 && e < this.cols && k[r][e] === kind) e++;
        if (kind >= 0 && e - c >= 3) {
          const cells = [];
          for (let i = c; i < e; i++) cells.push({ r, c: i });
          runs.push({ dir: 'h', kind, len: e - c, cells });
        }
        c = e;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const kind = k[r][c];
        let e = r + 1;
        while (kind >= 0 && e < this.rows && k[e][c] === kind) e++;
        if (kind >= 0 && e - r >= 3) {
          const cells = [];
          for (let i = r; i < e; i++) cells.push({ r: i, c });
          runs.push({ dir: 'v', kind, len: e - r, cells });
        }
        r = e;
      }
    }
    return runs;
  },

  swap(a, b) {
    const t1 = this.grid[a.r][a.c], t2 = this.grid[b.r][b.c];
    this.grid[a.r][a.c] = t2; this.grid[b.r][b.c] = t1;
    t1.r = b.r; t1.c = b.c;
    t2.r = a.r; t2.c = a.c;
  },

  forEachTile(fn) {
    for (let r = 0; r < this.grid.length; r++)
      for (let c = 0; c < this.grid[r].length; c++)
        if (this.grid[r][c]) fn(this.grid[r][c], r, c);
  },
};
