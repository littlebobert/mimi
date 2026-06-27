import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WordLookup } from '../lib/types';

interface Props {
  lookup: WordLookup | null;
  onClose: () => void;
  onSave: (word: string) => void;
  saveHint: string;
  saveLabel: string;
  savedLabel: string;
  isSaved: boolean;
}

export function WordPopup({
  lookup,
  onClose,
  onSave,
  saveHint,
  saveLabel,
  savedLabel,
  isSaved,
}: Props) {
  return (
    <Modal visible={lookup != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {lookup && (
            <>
              <Text style={styles.word}>{lookup.word}</Text>
              {lookup.reading ? (
                <Text style={styles.reading}>{lookup.reading}</Text>
              ) : null}
              {lookup.glosses.map((gloss) => (
                <Text key={gloss} style={styles.gloss}>
                  • {gloss}
                </Text>
              ))}
              <Text style={styles.saveHint}>{saveHint}</Text>
              <Pressable
                style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
                onPress={() => onSave(lookup.word)}
                accessibilityRole="button"
                accessibilityLabel={isSaved ? savedLabel : saveLabel}
              >
                <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextSaved]}>
                  {isSaved ? savedLabel : saveLabel}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  word: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f7f4ef',
  },
  reading: {
    fontSize: 18,
    color: '#aaa',
  },
  gloss: {
    fontSize: 16,
    color: '#eee7dc',
    lineHeight: 22,
  },
  saveHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#aaa',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#f7f4ef',
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
  },
  saveButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
  },
  saveButtonTextSaved: {
    color: '#f7f4ef',
  },
});
