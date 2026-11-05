// game.js - Game STATE helpers. Pure functions: they take a state and return a NEW state
// (React needs new objects to re-render). The rules themselves live in rules.js.
import type { Board, Color, DrawState, Move } from './rules';
import { initialBoard, legalMoves, applyMove, newDrawState, nextDrawState, drawReason } from './rules';

// State shape:
//   board, turn ('w'|'b'), moves (legal moves for `turn`), sel (selected square or null),
//   me ('w'|'b' in a network game, null in local mode), over, msg (final message), draw (see rules.js)

export interface GameState {
  board: Board; turn: Color; moves: Move[]; sel: number | null;
  me: Color | null; over: boolean; msg: string; draw: DrawState;
}

export function newGame(me: Color | null): GameState {
  const board = initialBoard();
  return { board, turn: 'w', me, moves: legalMoves(board, 'w'), sel: null, over: false, msg: '', draw: newDrawState(board) };
}

/** Plays `move` and checks for the end of the game (no legal move = loss, or an automatic draw). */
export function withMove(g: GameState, move: Move): GameState {
  const board = applyMove(g.board, move);
  const turn = g.turn === 'w' ? 'b' : 'w';
  const moves = legalMoves(board, turn);
  const draw = nextDrawState(g.draw, g.board, move, board, turn);
  const next: GameState = { ...g, board, turn, moves, draw, sel: null };
  const reason = drawReason(draw, board, turn);
  if (!moves.length) next.over = true;
  else if (reason) { next.over = true; next.msg = `Draw: ${reason}.`; }
  return next;
}

/** Ends the game immediately with a final message (resignation, agreed draw, error...). */
export const ended = (g: GameState, msg: string): GameState => (g.over ? g : { ...g, over: true, msg }); // never overwrite a real result

/** Text shown above the board. */
export function statusText(g: GameState): string {
  const name = (c: Color) => (c === 'w' ? 'White' : 'Black');
  let text = g.msg;
  if (!text && g.over) text = `${name(g.turn === 'w' ? 'b' : 'w')} wins!`;
  else if (!text) {
    text = g.me ? (g.turn === g.me ? 'Your turn' : "Opponent's turn") : `${name(g.turn)} to play`;
    if (g.moves[0]?.captured.length) text += ' - capture is mandatory';
  }
  return text + (g.me ? ` (you are ${name(g.me)})` : '');
}
