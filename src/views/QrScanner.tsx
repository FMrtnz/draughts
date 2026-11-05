// QrScanner.jsx - Opens the camera and calls onResult(text) with the first QR code found.
// The camera is stopped automatically when the component disappears (effect cleanup).
import React, { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

interface Props { onResult: (text: string) => void; onError: (message: string) => void; }

export default function QrScanner({ onResult, onError }: Props) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let frame = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {                              // analyse one camera frame per animation frame
          if (stopped) return;
          if (v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height);
            if (found) return onResult(found.data);
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { onError((e as Error).message); }
    })();

    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // run once: start the camera when mounted

  return <video ref={video} className="cam" playsInline muted />;
}
