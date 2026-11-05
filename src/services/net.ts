// net.js - Serverless peer-to-peer link using WebRTC with MANUAL signaling.
//
// Normally WebRTC needs a signaling server to exchange connection info. Here the two players
// exchange it themselves (QR code or copy/paste):
//   host:  createOffer()  -> shows code A
//   guest: acceptOffer(A) -> shows code B
//   host:  acceptAnswer(B) -> connected! Everything afterwards flows through a DataChannel.

// Empty = LAN / hotspot only, no internet needed.
// Add { urls: 'stun:stun.l.google.com:19302' } to try connecting across different networks.
const ICE_SERVERS: RTCIceServer[] = [];

// Session descriptions are JSON -> deflate -> base64, to keep the QR code small enough to scan.
async function pack(desc: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(desc)]).stream().pipeThrough(new CompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes));
}
async function unpack(text: string): Promise<RTCSessionDescriptionInit> {
  const bytes = Uint8Array.from(atob(text.trim()), (ch) => ch.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return JSON.parse(await new Response(stream).text());
}

/** Everything the two players send each other once connected. */
export type NetMessage =
  | { t: 'move'; path: number[]; check: string }   // `check` = board snapshot to detect desync
  | { t: 'resign' }
  | { t: 'draw-offer' }
  | { t: 'draw-accept' }
  | { t: 'draw-decline' };

export class Peer {
  private pc: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private onMessage: (m: NetMessage) => void;

  /** onMessage(obj): a message arrived. onState(str): 'connected' | 'disconnected' | 'failed'... */
  constructor(onMessage: (m: NetMessage) => void, onState: (s: RTCPeerConnectionState) => void) {
    this.onMessage = onMessage;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onconnectionstatechange = () => onState(this.pc.connectionState);
  }

  // Wait until all network candidates are in the description (no trickle ICE: one code is enough).
  #iceDone(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      this.pc.onicegatheringstatechange = () => this.pc.iceGatheringState === 'complete' && resolve();
      setTimeout(resolve, 2500); // safety net, e.g. when offline
    });
  }

  #setChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onmessage = (e) => this.onMessage(JSON.parse(e.data));
  }

  async createOffer(): Promise<string> {                       // HOST, step 1
    this.#setChannel(this.pc.createDataChannel('draughts'));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.#iceDone();
    return pack(this.pc.localDescription);
  }
  async acceptOffer(code: string): Promise<string> {                   // GUEST, step 2
    this.pc.ondatachannel = (e) => this.#setChannel(e.channel);
    await this.pc.setRemoteDescription(await unpack(code));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.#iceDone();
    return pack(this.pc.localDescription);
  }
  async acceptAnswer(code: string): Promise<void> {                  // HOST, step 3
    await this.pc.setRemoteDescription(await unpack(code));
  }
  send(obj: NetMessage) { this.channel?.send(JSON.stringify(obj)); }
  close() { this.pc.close(); }
}
