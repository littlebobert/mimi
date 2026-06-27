export declare class MicStream {
  start(onChunk: (base64Pcm16: string) => void): Promise<void>;
  stop(): Promise<void>;
}
