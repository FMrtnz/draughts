// MenuScreen.jsx - Main menu: start a network game, scan one, or play on this device.
import React from 'react';

interface Props { onHost: () => void; onJoin: () => void; onLocal: () => void; }

export default function MenuScreen({ onHost, onJoin, onLocal }: Props) {
  return (
    <section className="screen">
      <h1>Draughts</h1>
      <p>International rules (10×10)</p>
      <button onClick={onHost}>Start a game</button>
      <button onClick={onJoin}>Scan a game</button>
      <button className="secondary" onClick={onLocal}>Play on this device</button>
    </section>
  );
}
