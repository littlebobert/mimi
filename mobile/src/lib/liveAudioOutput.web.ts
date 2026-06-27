export class LiveAudioOutput {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  async playPcm16(base64Pcm16: string, sampleRate: number): Promise<void> {
    if (this.muted || !base64Pcm16) return;

    this.context ??= new AudioContext({ sampleRate });
    await this.context.resume();

    const samples = base64ToInt16(base64Pcm16);
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      channel[i] = Math.max(-1, Math.min(1, samples[i] / 0x8000));
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const now = this.context.currentTime;
    this.nextStartTime = Math.max(this.nextStartTime, now + 0.04);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.nextStartTime = 0;
  }
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}
