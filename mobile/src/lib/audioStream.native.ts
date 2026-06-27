type AudioChunkHandler = (base64Pcm16: string) => void;

export class MicStream {
  private subscription: { remove: () => void } | null = null;

  async start(onChunk: AudioChunkHandler): Promise<void> {
    const { ExpoPlayAudioStream } = await import('@mykin-ai/expo-audio-stream');

    const { subscription } = await ExpoPlayAudioStream.startRecording({
      sampleRate: 16000,
      channels: 1,
      encoding: 'pcm_16bit',
      interval: 100,
      onAudioStream: async (event) => {
        if (typeof event.data === 'string' && event.data.length > 0) {
          onChunk(event.data);
        }
      },
    });

    this.subscription = subscription ?? null;
  }

  async stop(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;

    try {
      const { ExpoPlayAudioStream } = await import('@mykin-ai/expo-audio-stream');
      await ExpoPlayAudioStream.stopRecording();
    } catch {
      // already stopped
    }
  }
}
