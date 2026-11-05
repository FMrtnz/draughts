// rules.js - International draughts (10x10) rules engine. Pure logic, no DOM, no network.
//
// Board: flat array of 100 cells, index = row * 10 + col. Row 0 is the top of the board.
// Only "dark" squares are used: (row + col) % 2 === 1.
// Cell values: null (empty), 'w' white man, 'W' white king, 'b' black man, 'B' black king.
// White starts at the bottom (rows 6-9) and moves UP; black starts at the top and moves DOWN.
//
// Rules implemented:
//  - Men move 1 square diagonally forward; kings ("flying kings") move any distance diagonally.
//  - Men capture forward AND backward; kings capture at any distance, landing on any free square beyond.
//  - Capturing is mandatory, and you must play the sequence capturing the MOST pieces (majority rule).
//  - Captured pieces are removed only after the whole sequence (they still block, and cannot be jumped twice).
//  - A man only promotes if it ENDS its move on the last row (passing through during a capture does not count).
//  - A player with no legal move loses. Automatic draws are at the end of this file.

export const SIZE = 10;

// ---------- Types ----------
export type Color = 'w' | 'b';
export type Piece = 'w' | 'W' | 'b' | 'B';      // lowercase = man, uppercase = king
export type Cell = Piece | null;
export type Board = Cell[];                     // 100 cells, see the layout above
/** A move: the squares visited (first = start, last = landing) and the captured squares. */
export interface Move { path: number[]; captured: number[]; }
/** Counters used for automatic draws (see the end of this file). */
export interface DrawState { quiet: number; seen: Record<string, number>; }
const DIRS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export const colorOf = (p: Cell): Color | null => (p ? (p.toLowerCase() as Color) : null);
const isKing = (p: Cell) => p === 'W' || p === 'B';
const inBoard = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** Returns the starting position. */
export function initialBoard(): Board {
  const b: Board = Array(100).fill(null);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if ((r + c) % 2 === 1) {
        if (r < 4) b[r * SIZE + c] = 'b';
        if (r > 5) b[r * SIZE + c] = 'w';
      }
  return b;
}

/** Compact string of a board, used to detect desynchronisation between players. */
export const boardToString = (b: Board): string => b.map((p) => p || '.').join('');

/**
 * Depth-first search of every capture sequence from (r, c).
 * `caps` = indices already captured in this sequence, `path` = squares visited so far.
 * A finished sequence is pushed to `out` as { path, captured }.
 */
function searchCaptures(b: Board, r: number, c: number, king: boolean, color: Color,
                        caps: number[], path: number[], out: Move[]): void {
  let extended = false;
  for (const [dr, dc] of DIRS) {
    let y = r + dr, x = c + dc;
    if (king) while (inBoard(y, x) && !b[y * SIZE + x]) { y += dr; x += dc; } // slide to first piece
    if (!inBoard(y, x)) continue;
    const target = b[y * SIZE + x];
    // Must be an enemy piece that was not already captured in this sequence
    if (!target || colorOf(target) === color || caps.includes(y * SIZE + x)) continue;
    // Landing squares: directly behind the victim (a man stops there, a king may slide further)
    let ly = y + dr, lx = x + dc;
    while (inBoard(ly, lx) && !b[ly * SIZE + lx]) {
      extended = true;
      searchCaptures(b, ly, lx, king, color, [...caps, y * SIZE + x], [...path, ly * SIZE + lx], out);
      if (!king) break;
      ly += dr; lx += dc;
    }
  }
  if (!extended && caps.length) out.push({ path, captured: caps });
}

/** All legal moves for `color`, as { path: [from, ..., to], captured: [indices] }. */
export function legalMoves(board: Board, color: Color): Move[] {
  const captures: Move[] = [];
  const simple: Move[] = [];
  for (let i = 0; i < 100; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== color) continue;
    const r = Math.floor(i / SIZE), c = i % SIZE, king = isKing(p);

    // Captures: lift the piece off the board so it does not block its own path
    const copy = board.slice(); copy[i] = null;
    searchCaptures(copy, r, c, king, color, [], [i], captures);

    // Simple moves (only used if no capture exists anywhere)
    for (const [dr, dc] of DIRS) {
      const forward = color === 'w' ? dr < 0 : dr > 0;
      if (!king && !forward) continue;
      let y = r + dr, x = c + dc;
      while (inBoard(y, x) && !board[y * SIZE + x]) {
        simple.push({ path: [i, y * SIZE + x], captured: [] });
        if (!king) break;
        y += dr; x += dc;
      }
    }
  }
  if (captures.length) {                       // capture is mandatory...
    const most = Math.max(...captures.map((m) => m.captured.length));
    return captures.filter((m) => m.captured.length === most); // ...and must take the most pieces
  }
  return simple;
}

/** Returns a NEW board with the move applied (captures removed, promotion handled). */
export function applyMove(board: Board, move: Move): Board {
  const b = board.slice();
  const from = move.path[0], to = move.path[move.path.length - 1];
  let piece = b[from];
  b[from] = null;
  for (const i of move.captured) b[i] = null;
  const row = Math.floor(to / SIZE);
  if (piece === 'w' && row === 0) piece = 'W';          // white promotes on the top row
  if (piece === 'b' && row === SIZE - 1) piece = 'B';   // black promotes on the bottom row
  b[to] = piece;
  return b;
}

// ---------- Draw detection (automatic draws) ----------
// A DrawState is { quiet, seen }:
//   quiet = number of consecutive "quiet" plies (a king moved, nothing was captured)
//   seen  = how many times each position (board + side to move) occurred since the last irreversible move
const posKey = (board: Board, turn: Color) => boardToString(board) + turn;

export function newDrawState(board: Board): DrawState { return { quiet: 0, seen: { [posKey(board, 'w')]: 1 } }; }

/** Returns the updated DrawState after `move` (played from `before`, resulting in `after`, `turn` to play). */
export function nextDrawState(ds: DrawState, before: Board, move: Move, after: Board, turn: Color): DrawState {
  const quietMove = isKing(before[move.path[0]]) && !move.captured.length;
  // Any capture or man move is irreversible: positions can never repeat, so the history is reset.
  const seen: Record<string, number> = quietMove ? { ...ds.seen } : {};
  const key = posKey(after, turn);
  seen[key] = (seen[key] || 0) + 1;
  return { quiet: quietMove ? ds.quiet + 1 : 0, seen };
}

/** Returns a text reason if the game is drawn, otherwise null. */
export function drawReason(ds: DrawState, board: Board, turn: Color): string | null {
  if (ds.seen[posKey(board, turn)] >= 3) return 'threefold repetition';
  const n = { w: 0, b: 0 };
  for (const p of board) if (p) n[colorOf(p)!]++;
  // Endgame: one side has a lone king against 3 pieces or fewer -> 16 moves each (32 plies)
  const endgame = Math.min(n.w, n.b) === 1 && Math.max(n.w, n.b) <= 3;
  if (ds.quiet >= (endgame ? 32 : 50)) return endgame ? '16-move endgame rule' : '25-move rule (kings only, no capture)';
  return null;
}
