// App.tsx - Root component: asks the controller for the current state and shows the matching view.
import React from 'react';
import { useGameController } from './controllers/useGameController';
import MenuScreen from './views/MenuScreen';
import PairingScreen from './views/PairingScreen';
import GameScreen from './views/GameScreen';

export default function App() {
  const c = useGameController();

  if (c.screen === 'pairing') return <PairingScreen {...c.pairing} onCode={c.onCodeReceived} onBack={c.goMenu} />;
  if (c.screen === 'game' && c.game) {
    return <GameScreen game={c.game} onTap={c.onCellTap} onResign={c.resign} onDraw={c.offerDraw} onMenu={c.goMenu} />;
  }
  return <MenuScreen onHost={c.startHost} onJoin={c.startGuest} onLocal={c.startLocal} />;
}
