# Draughts P2P

International draughts (10×10) as a **PWA**, playable between two phones with **no game server**.
Built with [React](https://react.dev) and [Vite](https://vite.dev) (TypeScript). Libraries: `qrcode.react` (show QR codes), `jsqr` (read them), `vite-plugin-pwa` (offline).

## Architecture (MVC adapted to React)

```
src/
├── model/          MODEL - game data and rules, no React, no network
│   ├── rules.ts        board, legal moves, captures, promotion, automatic draws
│   └── game.ts         game state: new game, play a move, end the game, status text
├── services/       SERVICES - talks to the outside world
│   └── net.ts          WebRTC peer-to-peer link (manual signaling with QR code / copy-paste)
├── controllers/    CONTROLLER - the glue
│   └── useGameController.ts   holds state, handles taps / network messages / resign / draw
├── views/          VIEWS - React components, display only
│   ├── MenuScreen.tsx, PairingScreen.tsx, GameScreen.tsx (board + buttons)
│   ├── QrScanner.tsx          camera + QR decoding
│   └── style.css
├── App.tsx         picks the view matching the controller's current screen
└── main.tsx        mounts React and registers the service worker
```

Dependency rule (arrows point to what a layer may import): **views → controller → model + services**.
The model never imports React or the network, so the rules can be unit-tested on their own.
Views never contain game logic: they show the state and call the controller's actions.

Other files: `index.html` (entry point), `public/icon.svg` (app icon), `vite.config.ts` (build + PWA manifest
and service worker), `tsconfig.json` (strict TypeScript).

**Why a ref in the controller?** Network callbacks run outside React's render cycle and would see stale state,
so `useGameController` also keeps the latest game in a ref (`gameRef`).

## How pairing works

1. **Host** taps *Start a game* → a QR code (the WebRTC "offer") is shown.
2. **Guest** taps *Scan a game* and scans it → the guest's phone shows an answer QR code.
3. **Host** taps *Scan opponent's code* and scans the answer → connected. Host plays white.

No camera? Use *Copy my code* and paste it through any messaging app.
After pairing, only the **move path** and a **board snapshot** are sent. Each device validates the
opponent's move with its own rules and detects any desynchronisation.

## Resignation and draws

- **Resign**: ends the game at once; the opponent is told and wins.
- **Offer draw**: sent to the opponent, who can accept or decline. In local mode both players confirm.
- **Automatic draws** (in `rules.ts`, computed identically on both devices, no message needed):
  - threefold repetition (same position, same side to move);
  - 25-move rule: 25 moves each with only king moves and no capture (50 plies);
  - 16-move endgame rule: a lone king against 3 pieces or fewer (32 plies).
  The counter is simplified: the endgame limit applies to the whole quiet streak, not from the moment the endgame starts.

## Setup

```bash
npm install
npm run dev       # dev server (HTTPS with a self-signed certificate, so the camera works on a phone)
npm run typecheck # type-check only (also runs before every build)
npm run build     # production build in dist/
npm run preview   # serve dist/ locally to test the offline PWA
```

- Deploy the `dist/` folder on any static host with **HTTPS** (GitHub Pages, Netlify...).
  `base: './'` in `vite.config.ts` makes it work from a sub-path.
- Open the site on both phones and use "Add to Home Screen". Once cached, it works offline.
- On the dev server, open the "Network" URL on your phone and accept the certificate warning.

## Playing without internet

Phone A enables its hotspot, phone B joins it, then pair as above. WebRTC finds the local route.
`ICE_SERVERS` in `net.ts` is empty on purpose. Add a public STUN server to try different networks.

## Known limits / ideas

- **Bluetooth is not possible** in a PWA (Web Bluetooth cannot accept connections, and Safari lacks it).
- Some Wi-Fi networks isolate clients; use a hotspot instead.
- A move is entered by tapping the piece and then the **final** square of a capture sequence.
  If two sequences end on the same square with different captures, the first is used (rare).
- Not implemented yet: computer opponent, reconnection after a lost link.
