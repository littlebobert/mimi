import { useCallback, useRef, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GeminiLiveSession } from '../lib/geminiLive';
import { createMockSegment } from '../lib/mockSegments';
import type { CaptionSegment, SessionAnalysis, WordLookup } from '../lib/types';
import { MicStream } from '../lib/audioStream';
import { segmentJapanese } from '../lib/segmentWords';
import { apiUrl } from '../lib/config';
import { LiveAudioOutput } from '../lib/liveAudioOutput';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface MimiSessionCopy {
  ready: string;
  missingKey: string;
  expoGo: string;
  mock: string;
  micPermission: string;
  connecting: string;
  connected: string;
  listening: string;
  stopped: string;
  analyzing: string;
  analysisReady: string;
  analysisFailed: string;
  lookupJapaneseFallback: string;
  lookupEnglishFallback: string;
}

interface MimiSessionOptions {
  targetLanguageCode: 'en' | 'ja';
  copy: MimiSessionCopy;
}

const MOCK_LOOKUP: Record<string, WordLookup> = {
  惜しい: { word: '惜しい', reading: 'もったいない', glosses: ['wasteful', 'a pity', 'so close (almost)'] },
  ゴール: { word: 'ゴール', reading: 'ゴール', glosses: ['goal'] },
  守備: { word: '守備', reading: 'しゅび', glosses: ['defense'] },
  固い: { word: '固い', reading: 'かたい', glosses: ['hard', 'solid', 'strict'] },
  注意: { word: '注意', reading: 'ちゅうい', glosses: ['attention', 'caution'] },
  automatically: { word: 'automatically', glosses: ['happens by itself, without manual work'] },
  conversation: { word: 'conversation', glosses: ['a spoken exchange between people'] },
  flashcard: { word: 'flashcard', glosses: ['a study card used for review'] },
  flashcards: { word: 'flashcards', glosses: ['study cards used for review'] },
  guidance: { word: 'guidance', glosses: ['help, direction, or explanation'] },
  intelligence: { word: 'intelligence', glosses: ['the ability to understand and apply knowledge'] },
  translation: { word: 'translation', glosses: ['text or speech converted into another language'] },
};

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'to',
  'of',
  'in',
  'it',
  'this',
  'that',
  'you',
  'i',
  'me',
  'my',
  'we',
  'our',
  'your',
  'he',
  'she',
  'they',
  'them',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'will',
  'just',
  'hello',
  'hi',
  'hear',
  'working',
  'work',
  'test',
  'testing',
  'ます',
  'です',
  'した',
  'これ',
  'それ',
  'あれ',
]);

export function useMimiSession({ targetLanguageCode, copy }: MimiSessionOptions) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState(copy.ready);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [selectedWord, setSelectedWord] = useState<WordLookup | null>(null);
  const [capturedWords, setCapturedWords] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [canAnalyze, setCanAnalyze] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const micRef = useRef<MicStream | null>(null);
  const audioOutputRef = useRef<LiveAudioOutput | null>(null);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockIndexRef = useRef(0);
  const audioChunksRef = useRef<string[]>([]);

  const saveWord = useCallback((word: string) => {
    const cleaned = cleanCapturedWord(word);
    if (!cleaned) return;

    setCapturedWords((prev) =>
      prev.includes(cleaned) ? prev : [cleaned, ...prev].slice(0, 8),
    );
  }, []);

  const pushSegment = useCallback((segment: CaptionSegment) => {
    if (segment.isFinal) {
      const captured = pickStudyWord(segment.jp);
      if (captured) {
        saveWord(captured);
      }
    }

    setSegments((prev) => {
      const existing = prev.findIndex((s) => s.id === segment.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = segment;
        return next;
      }
      return [...prev.slice(-4), segment];
    });
  }, [saveWord]);

  const startMock = useCallback(() => {
    setStatus(copy.mock);
    mockTimerRef.current = setInterval(() => {
      pushSegment(createMockSegment(mockIndexRef.current++));
    }, 3500);
    pushSegment(createMockSegment(mockIndexRef.current++));
  }, [copy.mock, pushSegment]);

  const start = useCallback(async () => {
    if (isExpoGo) {
      setStatus(copy.expoGo);
      startMock();
      setListening(true);
      return;
    }

    setListening(true);
    setSegments([]);
    setSelectedWord(null);
    setCapturedWords([]);
    setAnalysis(null);
    setAnalysisStatus('');
    setCanAnalyze(false);
    audioChunksRef.current = [];

    try {
      const mic = new MicStream();
      micRef.current = mic;
      const audioOutput = new LiveAudioOutput();
      audioOutput.setMuted(voiceMuted);
      audioOutputRef.current = audioOutput;
      setStatus(copy.micPermission);

      const session = new GeminiLiveSession(
        pushSegment,
        setStatus,
        (chunk, sampleRate) => {
          void audioOutputRef.current?.playPcm16(chunk, sampleRate);
        },
        {
          targetLanguageCode,
          labels: {
            connecting: copy.connecting,
            connected: copy.connected,
          },
        },
      );
      sessionRef.current = session;

      await mic.start((chunk) => {
        if (audioChunksRef.current.length < 600) {
          audioChunksRef.current.push(chunk);
        }
        session.sendAudioPcm16(chunk);
      });
      await session.connect();
      setStatus(copy.listening);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to start');
      setListening(false);
      sessionRef.current?.close();
      sessionRef.current = null;
      await micRef.current?.stop();
      micRef.current = null;
      await audioOutputRef.current?.close();
      audioOutputRef.current = null;
    }
  }, [copy, pushSegment, startMock, targetLanguageCode, voiceMuted]);

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted((current) => {
      const next = !current;
      audioOutputRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const analyzeSession = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    setAnalyzing(true);
    setAnalysisStatus(copy.analyzing);
    try {
      const response = await fetch(apiUrl('/api/analyze-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioChunks: audioChunksRef.current,
          segments,
          capturedWords,
          targetLanguageCode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || copy.analysisFailed);
      }
      setAnalysis(normalizeAnalysis(data));
      setAnalysisStatus(copy.analysisReady);
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : copy.analysisFailed);
    } finally {
      setAnalyzing(false);
    }
  }, [
    capturedWords,
    copy.analysisFailed,
    copy.analysisReady,
    copy.analyzing,
    segments,
    targetLanguageCode,
  ]);

  const stop = useCallback(async () => {
    mockTimerRef.current && clearInterval(mockTimerRef.current);
    mockTimerRef.current = null;
    await micRef.current?.stop();
    micRef.current = null;
    await audioOutputRef.current?.close();
    audioOutputRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setListening(false);
    setStatus(copy.stopped);
    setCanAnalyze(audioChunksRef.current.length > 0);
    if (audioChunksRef.current.length > 0) {
      void analyzeSession();
    }
  }, [analyzeSession, copy.stopped]);

  const lookupWord = useCallback((word: string) => {
    const cleaned = cleanCapturedWord(word);
    const hit = MOCK_LOOKUP[cleaned] ?? MOCK_LOOKUP[cleaned.toLowerCase()];
    setSelectedWord(
      hit ?? {
        word: cleaned || word,
        glosses: [
          isJapaneseWord(cleaned) ? copy.lookupJapaneseFallback : copy.lookupEnglishFallback,
        ],
      },
    );
  }, [copy.lookupEnglishFallback, copy.lookupJapaneseFallback]);

  return {
    listening,
    status,
    segments,
    capturedWords,
    analysis,
    analysisStatus,
    analyzing,
    canAnalyze,
    voiceMuted,
    selectedWord,
    start,
    stop,
    toggleVoiceMuted,
    analyzeSession,
    lookupWord,
    saveWord,
    clearSelectedWord: () => setSelectedWord(null),
    isExpoGo,
  };
}

function normalizeAnalysis(data: Partial<SessionAnalysis>): SessionAnalysis {
  return {
    model: typeof data.model === 'string' ? data.model : undefined,
    summary: typeof data.summary === 'string' ? data.summary : 'Session analyzed.',
    struggles: Array.isArray(data.struggles) ? data.struggles.filter(isString) : [],
    corrections: Array.isArray(data.corrections)
      ? data.corrections
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const correction = item as Partial<SessionAnalysis['corrections'][number]>;
            return {
              original: correction.original ?? '',
              better: correction.better ?? '',
              explanation: correction.explanation ?? '',
            };
          })
      : [],
    flashcards: Array.isArray(data.flashcards)
      ? data.flashcards
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const card = item as Partial<SessionAnalysis['flashcards'][number]>;
            return {
              front: card.front ?? '',
              back: card.back ?? '',
              why: card.why ?? '',
            };
          })
      : [],
    nextPractice:
      typeof data.nextPractice === 'string'
        ? data.nextPractice
        : 'Repeat one useful sentence from the conversation.',
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function pickStudyWord(text: string): string | null {
  const candidates = tokenizeStudyWords(text)
    .map(cleanCapturedWord)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word.toLowerCase()));

  return candidates
    .map((word) => ({ word, score: scoreStudyWord(word) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.word ?? null;
}

function tokenizeStudyWords(text: string): string[] {
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) {
    return segmentJapanese(text);
  }
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
}

function cleanCapturedWord(word: string): string {
  return word.replace(/[、。！？,.!?'"“”]/g, '').trim();
}

function isJapaneseWord(word: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(word);
}

function scoreStudyWord(word: string): number {
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(word)) {
    return word.length >= 2 ? word.length : 0;
  }

  const lower = word.toLowerCase();
  if (lower.length < 5) return 0;

  let score = lower.length;
  if (lower.length >= 8) score += 3;
  if (/(tion|sion|ment|ness|ity|ive|ous|able|ible|ally|ship)$/.test(lower)) {
    score += 4;
  }
  if (/[-']/.test(lower)) score += 1;

  // De-prioritize very common conversational fillers even if they are long.
  if (/(really|maybe|probably|actually|basically|something|anything|everything)/.test(lower)) {
    score -= 5;
  }

  return score;
}
