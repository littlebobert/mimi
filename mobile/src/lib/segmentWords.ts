/** Lightweight word spans for demo — swap for kuromoji when ready. */
export function segmentJapanese(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .filter((part) => part.isWordLike)
      .map((part) => part.segment);
  }
  return text.split(/(\s+|[、。！？]+)/).filter((part) => part.trim().length > 0);
}
