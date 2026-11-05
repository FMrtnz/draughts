// GameScreen.jsx - Status line, the 10x10 board and the Draw / Resign / Menu buttons.
import React from 'react';
import { SIZE, colorOf } from '../model/rules';
import { statusText, type GameState } from '../model/game';

function Board({ game, onTap }: { game: GameState; onTap: (i: number) => void }) {
  const flip = game.me === 'b';                          // black sees the board from its own side
  const targets = game.moves.filter((m) => m.path[0] === game.sel).map((m) => m.path.at(-1));
  const cells: React.ReactElement[] = [];
  for (let k = 0; k < SIZE * SIZE; k++) {
    const i = flip ? 99 - k : k;                         // board index shown at screen position k
    const piece = game.board[i];
    const classes = ['cell', ((i / SIZE | 0) + (i % SIZE)) % 2 ? 'dark' : 'light'];
    if (i === game.sel) classes.push('sel');
    if (targets.includes(i)) classes.push('target');
    cells.push(
      <div key={i} className={classes.join(' ')} onClick={() => onTap(i)}>
        {piece && <div className={'piece ' + colorOf(piece)}>{piece === 'W' || piece === 'B' ? '♛' : ''}</div>}
      </div>
    );
  }
  return <div className="board">{cells}</div>;
}

interface Props {
  game: GameState;
  onTap: (i: number) => void;
  onResign: () => void;
  onDraw: () => void;
  onMenu: () => void;
}

export default function GameScreen({ game, onTap, onResign, onDraw, onMenu }: Props) {
  return (
    <section className="screen">
      <div>{statusText(game)}</div>
      <Board game={game} onTap={onTap} />
      <div className="row">
        <button className="secondary" disabled={game.over} onClick={onDraw}>Offer draw</button>
        <button className="secondary" disabled={game.over} onClick={onResign}>Resign</button>
      </div>
      <button className="secondary" onClick={onMenu}>Menu</button>
    </section>
  );
}
