export interface CaptionSegment {
  id: string;
  jp: string;
  en: string;
  isFinal: boolean;
}

export interface WordLookup {
  word: string;
  reading?: string;
  glosses: string[];
}

export interface SessionAnalysis {
  model?: string;
  summary: string;
  struggles: string[];
  corrections: Array<{
    original: string;
    better: string;
    explanation: string;
  }>;
  flashcards: Array<{
    front: string;
    back: string;
    why: string;
  }>;
  nextPractice: string;
}
