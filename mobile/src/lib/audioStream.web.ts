type AudioChunkHandler = (base64Pcm16: string) => void;

function downsampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = inputRate / 16000;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[idx]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class MicStream {
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;

  async start(onChunk: AudioChunkHandler): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is not available in this browser.');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.context = new AudioContext();
    await this.context.resume();

    this.source = this.context.createMediaStreamSource(this.mediaStream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      const pcm = downsampleTo16k(channel, this.context!.sampleRate);
      onChunk(int16ToBase64(pcm));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async stop(): Promise<void> {
    this.processor?.disconnect();
    this.processor = null;
    this.source?.disconnect();
    this.source = null;
    this.context?.close();
    this.context = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }
}
