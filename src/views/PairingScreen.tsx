// PairingScreen.jsx - Shows OUR code as a QR code and accepts the opponent's code (scan or paste).
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QrScanner from './QrScanner';

interface Props {
  role: 'host' | 'guest' | null;
  code: string;                       // our own code (empty until generated)
  onCode: (code: string) => void;     // called with the opponent's code
  onBack: () => void;
}

export default function PairingScreen({ role, code, onCode, onBack }: Props) {
  const [scanning, setScanning] = useState(false);
  const [pasted, setPasted] = useState('');

  return (
    <section className="screen">
      <h2>{role === 'host' ? 'Start a game' : 'Scan a game'}</h2>
      <p>
        {role === 'host'
          ? '1) Let your opponent scan this code. 2) Then scan the answer code they show you.'
          : "Scan (or paste) the host's code. Then show YOUR answer code back to the host."}
      </p>

      {/* Our code: a QR code, plus plain text as a fallback (e.g. send it by message) */}
      {code && <div className="qr"><QRCodeSVG value={code} size={300} level="L" marginSize={2} /></div>}
      {!code && role === 'host' && <p>Generating...</p>}
      <textarea readOnly value={code} placeholder="Your code appears here" />
      <button className="secondary" onClick={() => navigator.clipboard?.writeText(code)}>Copy my code</button>

      {/* The opponent's code: camera scan or paste */}
      {scanning && (
        <QrScanner
          onResult={(text) => { setScanning(false); onCode(text); }}
          onError={(msg) => { setScanning(false); alert(msg); }}
        />
      )}
      <button onClick={() => setScanning(!scanning)}>{scanning ? 'Stop scanning' : "Scan opponent's code"}</button>
      <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="...or paste opponent's code here" />
      <button className="secondary" onClick={() => pasted && onCode(pasted)}>Use pasted code</button>
      <button className="secondary" onClick={onBack}>Back</button>
    </section>
  );
}
