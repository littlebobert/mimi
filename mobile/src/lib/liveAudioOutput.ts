export class LiveAudioOutput {
  setMuted(_muted: boolean): void {}

  async playPcm16(_base64Pcm16: string, _sampleRate: number): Promise<void> {}

  async close(): Promise<void> {}
}
