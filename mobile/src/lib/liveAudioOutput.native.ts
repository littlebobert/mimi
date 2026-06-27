export class LiveAudioOutput {
  private muted = false;
  private queue = Promise.resolve();
  private players: Array<{ remove: () => void }> = [];

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  async playPcm16(base64Pcm16: string, sampleRate: number): Promise<void> {
    if (this.muted || !base64Pcm16) return;

    this.queue = this.queue.then(() => this.playChunk(base64Pcm16, sampleRate));
    await this.queue;
  }

  async close(): Promise<void> {
    this.players.forEach((player) => player.remove());
    this.players = [];
    this.queue = Promise.resolve();
  }

  private async playChunk(base64Pcm16: string, sampleRate: number): Promise<void> {
    if (this.muted) return;

    const { createAudioPlayer } = await import('expo-audio');
    const pcm = base64ToBytes(base64Pcm16);
    const wav = pcm16MonoToWav(pcm, sampleRate);
    const player = createAudioPlayer(
      { uri: `data:audio/wav;base64,${bytesToBase64(wav)}` },
      { keepAudioSessionActive: true },
    );
    this.players.push(player);
    player.play();

    const durationMs = Math.max(40, (pcm.length / 2 / sampleRate) * 1000);
    await wait(durationMs);
    player.remove();
    this.players = this.players.filter((current) => current !== player);
  }
}

function pcm16MonoToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  writeAscii(header, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(header, 8, 'WAVE');
  writeAscii(header, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(header, 36, 'data');
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(header.length + pcm.length);
  wav.set(header);
  wav.set(pcm, header.length);
  return wav;
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    bytes[offset + i] = text.charCodeAt(i);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i] ?? 'A');
    const b = alphabet.indexOf(clean[i + 1] ?? 'A');
    const c = alphabet.indexOf(clean[i + 2] ?? 'A');
    const d = alphabet.indexOf(clean[i + 3] ?? 'A');
    const triplet = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    bytes.push((triplet >> 16) & 255);
    if (i + 2 < clean.length) bytes.push((triplet >> 8) & 255);
    if (i + 3 < clean.length) bytes.push(triplet & 255);
  }

  return new Uint8Array(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : '=';
  }

  return output;
}
