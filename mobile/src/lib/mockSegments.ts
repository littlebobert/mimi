import type { CaptionSegment } from './types';

const MOCK_LINES: Array<{ jp: string; en: string }> = [
  {
    jp: '惜しい！あと少しでゴールでした。',
    en: 'So close! That was almost a goal.',
  },
  {
    jp: '守備が固いですね。',
    en: 'The defense is really solid.',
  },
  {
    jp: 'セットピースに注意してください。',
    en: 'Watch out for set pieces.',
  },
];

export function createMockSegment(index: number): CaptionSegment {
  const line = MOCK_LINES[index % MOCK_LINES.length];
  return {
    id: `mock-${index}-${Date.now()}`,
    jp: line.jp,
    en: line.en,
    isFinal: true,
  };
}
