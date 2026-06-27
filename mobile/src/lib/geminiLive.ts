import { getLiveConfig } from './config';
import type { CaptionSegment } from './types';

const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export type SegmentHandler = (segment: CaptionSegment) => void;
export type StatusHandler = (status: string) => void;
export type AudioHandler = (base64Pcm16: string, sampleRate: number) => void;

interface GeminiLiveSessionOptions {
  targetLanguageCode: 'en' | 'ja';
  labels: {
    connecting: string;
    connected: string;
  };
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private jpBuffer = '';
  private enBuffer = '';
  private segmentCounter = 0;
  private currentSegmentId: string | null = null;
  private closingIntentionally = false;
  private readyForAudio = false;

  constructor(
    private onSegment: SegmentHandler,
    private onStatus: StatusHandler,
    private onAudio: AudioHandler,
    private options: GeminiLiveSessionOptions,
  ) {}

  async connect(): Promise<void> {
    const liveConfig = await getLiveConfig();
    if (!liveConfig.apiKey) {
      throw new Error('Missing Gemini API key. Set GEMINI_API_KEY on Cloud Run or EXPO_PUBLIC_GEMINI_API_KEY locally.');
    }
    this.onStatus(this.options.labels.connecting);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?key=${liveConfig.apiKey}`);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      let setupComplete = false;
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled || setupComplete) return;
        settled = true;
        this.closingIntentionally = true;
        ws.close();
        reject(new Error('Gemini Live setup timed out. Check the API key, model access, and browser console.'));
      }, 12000);

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: `models/${liveConfig.liveModel}`,
              generationConfig: {
                responseModalities: ['AUDIO'],
                translationConfig: {
                  targetLanguageCode: this.options.targetLanguageCode,
                  echoTargetLanguage: true,
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          }),
        );
      };

      ws.onmessage = async (event) => {
        try {
          const message = await parseMessage(event.data);
          if (!message) return;
          if (message.error && typeof message.error === 'object') {
            const error = message.error as { message?: string };
            throw new Error(error.message ?? 'Gemini Live setup failed');
          }
          if (message.setupComplete) {
            setupComplete = true;
            this.readyForAudio = true;
            this.onStatus(this.options.labels.connected);
            resolveOnce();
            return;
          }
          this.handleServerMessage(message);
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error('Gemini Live message error'));
        }
      };

      ws.onerror = () => {
        rejectOnce(new Error('Gemini Live WebSocket error'));
      };

      ws.onclose = (event) => {
        if (this.closingIntentionally) {
          return;
        }
        const detail =
          event.reason || (event.code ? `code ${event.code}` : '');
        const status = detail ? `Disconnected (${detail})` : 'Disconnected';
        this.onStatus(status);
        if (!setupComplete) {
          rejectOnce(new Error(status));
        }
      };
    });
  }

  sendAudioPcm16(base64Pcm: string): void {
    if (!this.readyForAudio || this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Pcm,
          },
        },
      }),
    );
  }

  close(): void {
    this.closingIntentionally = true;
    this.readyForAudio = false;
    this.ws?.close();
    this.ws = null;
  }

  private handleServerMessage(message: Record<string, unknown>): void {
    const serverContent = message.serverContent as
      | Record<string, unknown>
      | undefined;
    if (!serverContent) return;
    this.handleModelAudio(serverContent);

    const input = serverContent.inputTranscription as
      | { text?: string; finished?: boolean }
      | undefined;
    const output = serverContent.outputTranscription as
      | { text?: string; finished?: boolean }
      | undefined;

    if (input?.text) {
      this.jpBuffer = mergeTranscript(this.jpBuffer, input.text);
      this.emitSegment(false);
    }
    if (output?.text) {
      this.enBuffer = mergeTranscript(this.enBuffer, output.text);
      this.emitSegment(false);
    }

    const inputFinal = Boolean(input?.finished);
    const outputFinal = Boolean(output?.finished);
    if (inputFinal || outputFinal) {
      this.emitSegment(true);
      this.jpBuffer = '';
      this.enBuffer = '';
    }
  }

  private handleModelAudio(serverContent: Record<string, unknown>): void {
    const modelTurn = serverContent.modelTurn as
      | { parts?: Array<Record<string, unknown>> }
      | undefined;
    const parts = modelTurn?.parts ?? [];

    for (const part of parts) {
      const inlineData = (part.inlineData ?? part.inline_data) as
        | { data?: string; mimeType?: string; mime_type?: string }
        | undefined;
      const data = inlineData?.data;
      const mimeType = inlineData?.mimeType ?? inlineData?.mime_type ?? '';
      if (!data || !mimeType.startsWith('audio/')) continue;
      this.onAudio(data, parseAudioSampleRate(mimeType));
    }
  }

  private emitSegment(isFinal: boolean): void {
    if (!this.jpBuffer && !this.enBuffer) return;
    this.currentSegmentId ??= `seg-${++this.segmentCounter}`;
    this.onSegment({
      id: this.currentSegmentId,
      jp: this.jpBuffer,
      en: this.enBuffer,
      isFinal,
    });
    if (isFinal) {
      this.currentSegmentId = null;
    }
  }
}

function parseAudioSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

async function parseMessage(raw: string | ArrayBuffer | Blob): Promise<Record<string, unknown> | null> {
  let text: string;
  if (typeof raw === 'string') {
    text = raw;
  } else if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    text = await raw.text();
  } else {
    text = new TextDecoder().decode(raw as ArrayBuffer);
  }
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeTranscript(previous: string, next: string): string {
  const incoming = next.trim();
  if (!incoming) return previous;

  const existing = previous.trim();
  if (!existing) return incoming;

  // Gemini may send either cumulative interim text or standalone chunks.
  // Keep cumulative updates in place, but append true chunks.
  if (incoming.startsWith(existing)) return incoming;
  if (existing.endsWith(incoming)) return existing;

  const separator = shouldUseSpace(existing, incoming) ? ' ' : '';
  return `${existing}${separator}${incoming}`;
}

function shouldUseSpace(previous: string, next: string): boolean {
  const last = previous.at(-1) ?? '';
  const first = next.at(0) ?? '';
  if (!last || !first) return false;
  if (/\s/.test(last) || /\s/.test(first)) return false;
  if (/[。、！？,.!?]$/.test(previous)) return true;
  // Japanese kana/kanji usually should not get inserted spaces.
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(last + first)) return false;
  return true;
}
