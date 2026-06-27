import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SubtitlePanel } from './src/components/SubtitlePanel';
import { WordPopup } from './src/components/WordPopup';
import { config } from './src/lib/config';
import { useMimiSession } from './src/hooks/useMimiSession';

type UiMode = 'en' | 'ja';
type Screen = 'listen' | 'flashcards';

const CONTOUR_RINGS = [
  { top: 92, right: -190, width: 420, height: 180, rotate: '-18deg', opacity: 0.08 },
  { top: 132, right: -150, width: 360, height: 150, rotate: '-18deg', opacity: 0.07 },
  { top: 178, right: -126, width: 300, height: 118, rotate: '-16deg', opacity: 0.06 },
  { top: 282, right: -220, width: 500, height: 210, rotate: '16deg', opacity: 0.065 },
  { top: 338, right: -178, width: 410, height: 170, rotate: '16deg', opacity: 0.055 },
  { top: 420, right: -118, width: 290, height: 116, rotate: '14deg', opacity: 0.05 },
  { top: 560, right: -210, width: 460, height: 190, rotate: '-22deg', opacity: 0.05 },
] as const;

const CONTOUR_STREAKS = [
  { top: 210, right: 32, width: 230, rotate: '-38deg', opacity: 0.05 },
  { top: 236, right: 74, width: 190, rotate: '-38deg', opacity: 0.045 },
  { top: 502, right: 18, width: 260, rotate: '28deg', opacity: 0.045 },
  { top: 532, right: 68, width: 205, rotate: '28deg', opacity: 0.04 },
] as const;

const UI = {
  en: {
    switchLabel: 'EN',
    targetLanguageCode: 'en' as const,
    tagline: 'Hear Japanese. Get English guidance.',
    empty: 'Subtitles will appear here…',
    tapHint: 'Tap any word to define or save it',
    start: 'Start listening',
    stop: 'Stop',
    voiceOn: 'Voice on',
    voiceOff: 'Voice muted',
    saveHint: 'Save this word manually or let Mimi capture words automatically.',
    saveLabel: 'Save flashcard',
    savedLabel: 'Saved',
    capturedLabel: 'words captured',
    capturingHint: 'Flashcards are captured automatically',
    openShort: 'Open',
    openCards: 'Open flashcards',
    flashcardsTitle: 'Flashcards',
    flashcardsSubtitle: 'Captured automatically or saved manually from live audio',
    flashcardsEmpty: 'Captured words will appear here.',
    agentTitle: 'Study coach agent',
    strugglesTitle: 'What you struggled with',
    correctionsTitle: 'Corrections',
    cleanedDeckTitle: 'Cleaned-up deck',
    nextPracticeTitle: 'Next practice',
    analyzeSession: 'Analyze session',
    backToListening: 'Back to listening',
    reviewLater: 'Review later',
    levelHint: 'Matched to your level',
    bannerKey: 'Add your key: copy mobile/.env.example → mobile/.env',
    bannerExpo: 'Expo Go = mock UI only. For live mic: npm run ios:device',
    session: {
      ready: 'Ready',
      missingKey: 'Add EXPO_PUBLIC_GEMINI_API_KEY to mobile/.env',
      expoGo: 'Expo Go cannot capture live mic — run: npm run ios:device',
      mock: 'Mock mode — tap words to demo UI',
      micPermission: 'Requesting microphone access…',
      connecting: 'Connecting to Gemini Live…',
      connected: 'Connected — listening',
      listening: 'Listening — speak Japanese',
      stopped: 'Stopped',
      analyzing: 'Study coach is analyzing the original audio…',
      analysisReady: 'Study coach analysis ready',
      analysisFailed: 'Study coach analysis failed',
      lookupJapaneseFallback: 'Japanese word detected. Save it now to review later.',
      lookupEnglishFallback: 'English word detected. Save it now to review later.',
    },
  },
  ja: {
    switchLabel: '日本語',
    targetLanguageCode: 'ja' as const,
    tagline: '英語を聞いて、日本語で案内します',
    empty: '字幕がここに表示されます…',
    tapHint: '単語をタップして保存できます',
    start: '聞き取り開始',
    stop: '停止',
    voiceOn: '音声オン',
    voiceOff: '音声ミュート',
    saveHint: 'この単語を手動で保存できます。Mimi の自動保存も使えます。',
    saveLabel: '単語カードに保存',
    savedLabel: '保存済み',
    capturedLabel: '語を保存',
    capturingHint: '単語カードを自動で作成します',
    openShort: '開く',
    openCards: '単語カードを見る',
    flashcardsTitle: '単語カード',
    flashcardsSubtitle: 'ライブ音声から自動・手動で保存',
    flashcardsEmpty: '保存された単語がここに表示されます。',
    agentTitle: '学習コーチエージェント',
    strugglesTitle: 'つまずいたところ',
    correctionsTitle: '修正案',
    cleanedDeckTitle: '整理された単語カード',
    nextPracticeTitle: '次の練習',
    analyzeSession: 'セッションを分析',
    backToListening: '聞き取りに戻る',
    reviewLater: 'あとで復習',
    levelHint: 'あなたのレベルに合わせて選択',
    bannerKey: 'APIキーを mobile/.env に追加してください',
    bannerExpo: 'Expo Go はデモ表示のみです。実機マイクは npm run ios:device',
    session: {
      ready: '準備完了',
      missingKey: 'EXPO_PUBLIC_GEMINI_API_KEY を mobile/.env に追加してください',
      expoGo: 'Expo Go では実機マイクを使えません — npm run ios:device',
      mock: 'デモモード — 単語をタップできます',
      micPermission: 'マイクの許可を確認中…',
      connecting: 'Gemini Live に接続中…',
      connected: '接続しました — 聞き取り中',
      listening: '聞き取り中 — 英語で話してください',
      stopped: '停止しました',
      analyzing: '元の音声を学習コーチが分析中…',
      analysisReady: '学習コーチの分析が完了しました',
      analysisFailed: '学習コーチの分析に失敗しました',
      lookupJapaneseFallback: '日本語の単語です。保存してあとで復習できます。',
      lookupEnglishFallback: '英語の単語です。保存してあとで復習できます。',
    },
  },
};

export default function App() {
  const [uiMode, setUiMode] = useState<UiMode>('en');
  const [screen, setScreen] = useState<Screen>('listen');
  const screenSlide = useRef(new Animated.Value(0)).current;
  const copy = UI[uiMode];

  const {
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
    clearSelectedWord,
    isExpoGo,
  } = useMimiSession({
    targetLanguageCode: copy.targetLanguageCode,
    copy: copy.session,
  });

  const toggleMode = () => {
    if (listening) return;
    setUiMode((current) => (current === 'en' ? 'ja' : 'en'));
  };
  const shouldShowMissingKeyBanner =
    !config.hasApiKey && typeof document === 'undefined';
  const selectedWordSaved =
    selectedWord != null && capturedWords.includes(cleanSavedWord(selectedWord.word));
  const screenOpacity = screenSlide.interpolate({
    inputRange: [-36, 0, 36],
    outputRange: [0.92, 1, 0.92],
  });

  const navigateToScreen = (nextScreen: Screen) => {
    if (screen === nextScreen) return;

    screenSlide.stopAnimation();
    screenSlide.setValue(nextScreen === 'flashcards' ? 36 : -36);
    setScreen(nextScreen);
    Animated.spring(screenSlide, {
      toValue: 0,
      useNativeDriver: true,
      friction: 10,
      tension: 80,
    }).start();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.webFrame}>
        <StatusBar style="light" />
        <View pointerEvents="none" style={styles.backgroundArt}>
          {CONTOUR_RINGS.map((line, index) => (
            <View
              key={`ring-${index}`}
              style={[
                styles.contourRing,
                {
                  top: line.top,
                  right: line.right,
                  width: line.width,
                  height: line.height,
                  opacity: line.opacity,
                  transform: [{ rotate: line.rotate }],
                },
              ]}
            />
          ))}
          {CONTOUR_STREAKS.map((line, index) => (
            <View
              key={`streak-${index}`}
              style={[
                styles.contourStreak,
                {
                  top: line.top,
                  right: line.right,
                  width: line.width,
                  opacity: line.opacity,
                  transform: [{ rotate: line.rotate }],
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.brand}>Mimi 耳</Text>
              <Text style={styles.tagline}>{copy.tagline}</Text>
            </View>
            <Pressable
              style={[styles.modeSwitch, listening && styles.modeSwitchDisabled]}
              onPress={toggleMode}
            >
              <Text style={styles.modeSwitchText}>{copy.switchLabel}</Text>
            </Pressable>
          </View>
        </View>

        {shouldShowMissingKeyBanner ? (
          <View style={styles.bannerWarn}>
            <Text style={styles.bannerText}>{copy.bannerKey}</Text>
          </View>
        ) : null}

        {isExpoGo ? (
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerText}>{copy.bannerExpo}</Text>
          </View>
        ) : null}

      <Animated.View
        style={[
          styles.screenTransition,
          {
            opacity: screenOpacity,
            transform: [{ translateX: screenSlide }],
          },
        ]}
      >
        {screen === 'listen' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.statusCard}>
              <View style={[styles.dot, listening && styles.dotLive]} />
              <Text style={styles.status}>{status}</Text>
            </View>

            <SubtitlePanel
              segments={segments}
              onWordPress={lookupWord}
              highlightedWords={capturedWords}
              tapHint={copy.tapHint}
            />
            {canAnalyze && !listening && !analyzing && !analysis ? (
              <Pressable
                style={[styles.analysisButton, analyzing && styles.buttonDisabled]}
                onPress={analyzeSession}
                disabled={analyzing}
              >
                <Text style={styles.analysisButtonText}>
                  {analyzing ? copy.session.analyzing : copy.analyzeSession}
                </Text>
              </Pressable>
            ) : null}
            {analysisStatus ? (
              <Text style={styles.analysisStatus}>{analysisStatus}</Text>
            ) : null}
            {analysis ? (
              <View style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>{copy.agentTitle}</Text>
                <Text style={styles.analysisSummary}>{analysis.summary}</Text>
                {analysis.struggles.length > 0 ? (
                  <>
                    <Text style={styles.analysisSection}>{copy.strugglesTitle}</Text>
                    {analysis.struggles.slice(0, 3).map((item) => (
                      <Text key={item} style={styles.analysisBullet}>• {item}</Text>
                    ))}
                  </>
                ) : null}
                {analysis.corrections.length > 0 ? (
                  <>
                    <Text style={styles.analysisSection}>{copy.correctionsTitle}</Text>
                    {analysis.corrections.slice(0, 2).map((item) => (
                      <Text key={`${item.original}-${item.better}`} style={styles.analysisBullet}>
                        {item.original} → {item.better}: {item.explanation}
                      </Text>
                    ))}
                  </>
                ) : null}
                {analysis.flashcards.length > 0 ? (
                  <>
                    <Text style={styles.analysisSection}>{copy.cleanedDeckTitle}</Text>
                    {analysis.flashcards.slice(0, 3).map((card) => (
                      <Text key={`${card.front}-${card.back}`} style={styles.analysisBullet}>
                        {card.front}: {card.back}
                      </Text>
                    ))}
                  </>
                ) : null}
                <Text style={styles.analysisSection}>{copy.nextPracticeTitle}</Text>
                <Text style={styles.analysisBullet}>{analysis.nextPractice}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>{copy.flashcardsTitle}</Text>
            <Text style={styles.screenSubtitle}>{copy.flashcardsSubtitle}</Text>

            {capturedWords.length === 0 ? (
              <View style={styles.emptyDeck}>
                <Text style={styles.emptyDeckText}>{copy.flashcardsEmpty}</Text>
              </View>
            ) : (
              <View style={styles.deckList}>
                {capturedWords.map((word, index) => (
                  <View key={word} style={styles.flashcard}>
                    <View>
                      <Text style={styles.flashcardWord}>{word}</Text>
                      <Text style={styles.flashcardHint}>{copy.levelHint}</Text>
                    </View>
                    <View style={styles.reviewPill}>
                      <Text style={styles.reviewPillText}>
                        {index === 0 ? copy.reviewLater : `#${capturedWords.length - index}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      <View style={styles.footer}>
        {screen === 'listen' ? (
          <>
            <Pressable
              style={styles.captureBar}
              onPress={() => navigateToScreen('flashcards')}
              accessibilityRole="button"
              accessibilityLabel={copy.openCards}
            >
              <View style={styles.captureText}>
                <Text style={styles.captureCount}>
                  {capturedWords.length} {copy.capturedLabel}
                </Text>
                <Text style={styles.captureHint}>{copy.capturingHint}</Text>
              </View>
              <View style={styles.captureAction}>
                <Text style={styles.captureActionText}>{copy.openShort}</Text>
                <Text style={styles.captureChevron}>›</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.voiceToggle, voiceMuted && styles.voiceToggleMuted]}
              onPress={toggleVoiceMuted}
              accessibilityRole="button"
            >
              <Text style={[styles.voiceToggleText, voiceMuted && styles.voiceToggleTextMuted]}>
                {voiceMuted ? copy.voiceOff : copy.voiceOn}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                listening ? styles.buttonStop : styles.buttonStart,
                analyzing && styles.buttonDisabled,
              ]}
              onPress={listening ? stop : start}
              disabled={analyzing}
            >
              <Text style={[styles.buttonLabel, !listening && styles.buttonLabelStart]}>
                {analyzing ? copy.session.analyzing : listening ? copy.stop : copy.start}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.button, styles.buttonStart]}
            onPress={() => navigateToScreen('listen')}
          >
            <Text style={[styles.buttonLabel, styles.buttonLabelStart]}>
              {copy.backToListening}
            </Text>
          </Pressable>
        )}
      </View>

        <WordPopup
          lookup={selectedWord}
          onClose={clearSelectedWord}
          onSave={saveWord}
          saveHint={copy.saveHint}
          saveLabel={copy.saveLabel}
          savedLabel={copy.savedLabel}
          isSaved={selectedWordSaved}
        />
      </View>
    </SafeAreaView>
  );
}

function cleanSavedWord(word: string): string {
  return word.replace(/[、。！？,.!?'"“”]/g, '').trim();
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#090909',
    alignItems: 'center',
  },
  webFrame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 720 : undefined,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#090909',
  },
  backgroundArt: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  contourRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#f5f2eb',
    borderRadius: 999,
  },
  contourStreak: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#f5f2eb',
    borderRadius: 999,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#242424',
    backgroundColor: '#111',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f7f4ef',
  },
  tagline: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  modeSwitch: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    backgroundColor: '#1d1d1d',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeSwitchDisabled: {
    opacity: 0.45,
  },
  modeSwitchText: {
    color: '#f7f4ef',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerWarn: {
    backgroundColor: '#3a2e12',
    padding: 12,
  },
  bannerInfo: {
    backgroundColor: '#142434',
    padding: 12,
  },
  bannerText: {
    fontSize: 13,
    color: '#f0ebe2',
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  screenTransition: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 32,
    flexGrow: 1,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#151515',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
    marginTop: 4,
  },
  dotLive: {
    backgroundColor: '#e53935',
  },
  status: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#d8d2c8',
  },
  analysisStatus: {
    marginTop: 18,
    color: '#aaa',
    fontSize: 13,
    fontWeight: '700',
  },
  analysisButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
    backgroundColor: '#f7f4ef',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  analysisButtonText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
  },
  analysisCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    backgroundColor: '#151515',
    gap: 8,
  },
  analysisTitle: {
    color: '#f7f4ef',
    fontSize: 18,
    fontWeight: '800',
  },
  analysisSummary: {
    color: '#eee7dc',
    fontSize: 15,
    lineHeight: 21,
  },
  analysisSection: {
    marginTop: 8,
    color: '#f7f4ef',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  analysisBullet: {
    color: '#d8d2c8',
    fontSize: 14,
    lineHeight: 20,
  },
  screenTitle: {
    color: '#f7f4ef',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    marginTop: 4,
    marginBottom: 18,
    color: '#aaa',
    fontSize: 14,
  },
  emptyDeck: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 24,
  },
  emptyDeckText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  deckList: {
    gap: 12,
  },
  flashcard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    backgroundColor: '#151515',
    padding: 16,
  },
  flashcardWord: {
    color: '#f7f4ef',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  flashcardHint: {
    marginTop: 4,
    color: '#aaa',
    fontSize: 13,
  },
  reviewPill: {
    borderRadius: 999,
    backgroundColor: '#222',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewPillText: {
    color: '#f7f4ef',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#242424',
    backgroundColor: '#090909',
  },
  captureBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    backgroundColor: '#151515',
  },
  captureCount: {
    color: '#f7f4ef',
    fontSize: 14,
    fontWeight: '800',
  },
  captureText: {
    flex: 1,
    paddingRight: 10,
  },
  captureHint: {
    marginTop: 2,
    color: '#aaa',
    fontSize: 12,
  },
  captureAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#f7f4ef',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
  },
  captureActionText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '800',
  },
  captureChevron: {
    color: '#111',
    fontSize: 18,
    fontWeight: '800',
  },
  voiceToggle: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
    backgroundColor: '#1d1d1d',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceToggleMuted: {
    backgroundColor: '#2a2016',
    borderColor: '#4a3420',
  },
  voiceToggleText: {
    color: '#f7f4ef',
    fontSize: 12,
    fontWeight: '800',
  },
  voiceToggleTextMuted: {
    color: '#f2c18a',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#f7f4ef',
  },
  buttonStop: {
    backgroundColor: '#b00020',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonLabelStart: {
    color: '#111',
  },
});
