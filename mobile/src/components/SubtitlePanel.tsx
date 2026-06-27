import { StyleSheet, Text, View } from 'react-native';
import type { CaptionSegment } from '../lib/types';
import { segmentJapanese } from '../lib/segmentWords';

interface Props {
  segments: CaptionSegment[];
  onWordPress: (word: string) => void;
  highlightedWords: string[];
  tapHint: string;
}

export function SubtitlePanel({
  segments,
  onWordPress,
  highlightedWords,
  tapHint,
}: Props) {
  const highlighted = new Set(highlightedWords);
  const chunks = segments.flatMap(splitSegmentIntoChunks);

  if (chunks.length === 0) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.tapHint}>{tapHint}</Text>
      {chunks.map((segment) => (
        <View key={segment.id} style={styles.block}>
          {renderTapLine({
            id: `${segment.id}-source`,
            text: segment.jp,
            textStyle: segment.isFinal ? styles.jpWord : styles.jpStreaming,
            highlighted,
            onWordPress,
          })}
          {renderPlainLine({
            id: `${segment.id}-target`,
            text: segment.en,
            textStyle: styles.en,
          })}
        </View>
      ))}
    </View>
  );
}

function renderPlainLine({
  id,
  text,
  textStyle,
}: {
  id: string;
  text: string;
  textStyle: object;
}) {
  if (!text) return null;

  return (
    <Text key={id} style={textStyle}>
      {text}
    </Text>
  );
}

function renderTapLine({
  id,
  text,
  textStyle,
  highlighted,
  onWordPress,
}: {
  id: string;
  text: string;
  textStyle: object;
  highlighted: Set<string>;
  onWordPress: (word: string) => void;
}) {
  if (!text) return null;

  return (
    <View style={styles.wordRow}>
      {segmentTapTokens(text).map((token, index) => {
        const cleaned = cleanWord(token);
        if (!isTouchableToken(token) || !cleaned) {
          return (
            <Text key={`${id}-${index}`} style={textStyle}>
              {token}
            </Text>
          );
        }

        return (
          <Text
            key={`${id}-${index}`}
            onPress={() => onWordPress(cleaned)}
            style={[
              textStyle,
              styles.word,
              highlighted.has(cleaned) && styles.wordCaptured,
            ]}
          >
            {token}
          </Text>
        );
      })}
    </View>
  );
}

function splitSegmentIntoChunks(segment: CaptionSegment): CaptionSegment[] {
  const jpChunks = splitTextIntoChunks(segment.jp);
  const enChunks = splitTextIntoChunks(segment.en);
  const count = Math.max(jpChunks.length, enChunks.length, 1);

  return Array.from({ length: count }, (_, index) => ({
    id: `${segment.id}-chunk-${index}`,
    jp: jpChunks[index] ?? '',
    en: enChunks[index] ?? '',
    isFinal: segment.isFinal,
  })).filter((chunk) => chunk.jp || chunk.en);
}

function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentenceChunks = trimmed.match(/[^。！？.!?]+[。！？.!?]+|\S[\s\S]*$/g) ?? [trimmed];
  return sentenceChunks.flatMap((chunk) => splitRunOn(chunk.trim(), 480));
}

function splitRunOn(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('、'));
    const index = breakAt > maxLength * 0.6 ? breakAt : maxLength;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function cleanWord(word: string): string {
  return word.replace(/[、。！？,.!?'"“”]/g, '').trim();
}

function segmentTapTokens(text: string): string[] {
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) {
    return segmentJapanese(text);
  }
  return text.match(/[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g) ?? [text];
}

function isTouchableToken(token: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fffA-Za-z]/.test(token);
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
  },
  tapHint: {
    color: '#8f8a82',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  block: {
    gap: 6,
  },
  wordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  word: {
    borderRadius: 6,
    paddingHorizontal: 1,
  },
  wordCaptured: {
    backgroundColor: 'rgba(245, 242, 235, 0.12)',
  },
  jpWord: {
    fontSize: 22,
    lineHeight: 30,
    color: '#f7f4ef',
    fontWeight: '600',
  },
  jpStreaming: {
    fontSize: 22,
    lineHeight: 30,
    color: '#ddd6cc',
  },
  en: {
    fontSize: 22,
    lineHeight: 30,
    color: '#f0ebe2',
  },
});
