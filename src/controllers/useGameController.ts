// App.jsx - Root component. Owns the game state and the network link, and picks the screen to show.
import { useRef, useState } from 'react';
import { Peer, type NetMessage } from '../services/net';
import { colorOf, boardToString, type Color } from '../model/rules';
import { newGame, withMove, ended, type GameState } from '../model/game';

export function useGameController() {
  const [screen, setScreen] = useState<'menu' | 'pairing' | 'game'>('menu');
  const [game, setGame] = useState<GameState | null>(null); // game state used for rendering
  const [pairing, setPairing] = useState<{ role: 'host' | 'guest' | null; code: string }>({ role: null, code: '' });

  // Network callbacks fire outside React's render cycle and would see stale state,
  // so the latest values are also kept in refs (always current).
  const gameRef = useRef<GameState | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const roleRef = useRef<'host' | 'guest' | null>(null);

  const update = (g: GameState) => { gameRef.current = g; setGame(g); };

  // ----- Game flow -----
  function startGame(me: Color | null) { update(newGame(me)); setScreen('game'); }

  /** Handles a message from the opponent. Types: move, resign, draw-offer, draw-accept, draw-decline. */
  function onNetMessage(m: NetMessage) {
    const g = gameRef.current;
    if (!g || g.over) return;
    switch (m.t) {
      case 'move': {                                     // validate against OUR OWN rules before applying
        const move = g.moves.find((x) => x.path.join() === m.path.join());
        if (!move || g.turn === g.me) return update(ended(g, 'Illegal move received.'));
        const next = withMove(g, move);
        update(boardToString(next.board) === m.check ? next : ended(next, 'Boards are out of sync.'));
        break;
      }
      case 'resign': update(ended(g, 'Opponent resigned - you win!')); break;
      case 'draw-offer':
        if (confirm('Your opponent offers a draw. Accept?')) { peerRef.current?.send({ t: 'draw-accept' }); update(ended(g, 'Draw by agreement.')); }
        else peerRef.current?.send({ t: 'draw-decline' });
        break;
      case 'draw-accept': update(ended(g, 'Draw by agreement.')); break;
      case 'draw-decline': alert('Your draw offer was declined.'); break;
    }
  }

  function onCellTap(i: number) {
    const g = gameRef.current!;
    if (g.over || (g.me && g.me !== g.turn)) return;     // not your turn
    if (g.board[i] && colorOf(g.board[i]) === g.turn) return update({ ...g, sel: i }); // select a piece
    const move = g.moves.find((x) => x.path[0] === g.sel && x.path.at(-1) === i);       // or tap a destination
    if (!move) return;
    const next = withMove(g, move);
    // Tell the opponent: the move path plus a board snapshot used to detect desync
    if (g.me) peerRef.current?.send({ t: 'move', path: move.path, check: boardToString(next.board) });
    update(next);
  }

  /** Resign. In local mode the player whose turn it is resigns. */
  function resign() {
    const g = gameRef.current!;
    if (g.over || !confirm('Resign this game?')) return;
    if (g.me) { peerRef.current?.send({ t: 'resign' }); update(ended(g, 'You resigned.')); }
    else update(ended(g, `${g.turn === 'w' ? 'White' : 'Black'} resigned.`));
  }

  /** Offer a draw (network) or confirm it (both players on one device). */
  function offerDraw() {
    const g = gameRef.current!;
    if (g.over) return;
    if (g.me) { peerRef.current?.send({ t: 'draw-offer' }); alert('Draw offer sent.'); }
    else if (confirm('Both players agree to a draw?')) update(ended(g, 'Draw by agreement.'));
  }

  // ----- Pairing (QR code / copy-paste) -----
  function newPeer(role: 'host' | 'guest') {
    peerRef.current?.close();
    roleRef.current = role;
    peerRef.current = new Peer(onNetMessage, (state) => {
      if (state === 'connected') startGame(role === 'host' ? 'w' : 'b'); // host plays white and starts
      else if ((state === 'failed' || state === 'disconnected') && gameRef.current) update(ended(gameRef.current, 'Connection lost.'));
    });
  }

  /** Host: creates the offer (shown as a QR code) and later waits for the guest's answer. */
  async function startHost() {
    newPeer('host'); setPairing({ role: 'host', code: '' }); setScreen('pairing');
    setPairing({ role: 'host', code: await peerRef.current!.createOffer() });
  }
  /** Guest: nothing to show yet; first scan the host's code. */
  function startGuest() { newPeer('guest'); setPairing({ role: 'guest', code: '' }); setScreen('pairing'); }

  /** Called with the code received from the opponent (scanned or pasted). */
  async function onCodeReceived(code: string) {
    try {
      if (roleRef.current === 'host') await peerRef.current!.acceptAnswer(code);   // connection then starts by itself
      else setPairing({ role: 'guest', code: await peerRef.current!.acceptOffer(code) }); // guest shows the answer
    } catch (e) { alert('Invalid code: ' + (e as Error).message); }
  }

  function goMenu() { peerRef.current?.close(); peerRef.current = null; gameRef.current = null; setScreen('menu'); }

  // What the views need: current state + actions
  return {
    screen, game, pairing,
    startHost, startGuest, startLocal: () => startGame(null),
    onCodeReceived, onCellTap, resign, offerDraw, goMenu,
  };
}
