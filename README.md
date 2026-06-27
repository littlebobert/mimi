# Mimi (耳)

**Learn Japanese from live audio — no subtitles needed.**

> Live translation helps you understand — but it doesn't help you **learn**. Mimi is live translation that turns what you hear into flashcards from your own life — the Netflix show you're watching, a call with your tutor, a live event, anything. Tap any word to study it later.

Gemini AI Hackathon · Tokyo · Jun 28, 2026 · [AI Builders × Google Japan](https://aibuilders.jp)

---

## The wedge (read this first)

**Live translation tools are great — but they're not learning tools.**

Google Translate, Meet captions, live subtitle overlays — you hear the English, but nothing sticks. Vocabulary from *your* life (the show you're watching, a conversation you had) beats any textbook — but only if you can capture and study it.

**Mimi listens.** We stream tab audio into Gemini's live speech-to-speech translation API, show Japanese + English **painted on top of the video**, and let you tap any word for an instant definition. Flashcards from live audio — no subtitle file required.

That's the demo. That's the pitch.

---

## Demo strategy: extension first, web app as fallback

| Surface | Role |
|---------|------|
| **Chrome extension** | **Primary demo** — live clickable subtitles overlaid on any video page (YouTube livestream, etc.) |
| **Web app (Cloud Run)** | **Submission requirement** + **fallback demo** if extension injection or MV3 plumbing fails on stage |

Judges need a **deployed URL** (Cloud Run). They don't need the extension to be your submission — but the extension is what makes the room go "oh." Plan both; demo the extension; submit the web app link.

If we're choosing at 3 PM: a working extension overlay beats a prettier web panel. A working web app beats a broken extension with nothing to submit.

---

## What we're building today (~5 hours)

Hacking runs **11:30 AM → 4:30 PM** (lunch ~12:30). Plan for **~4–5 hours of real build time**.

### Must ship (demo core)

| # | Feature | Primary (extension) | Fallback (web app) |
|---|---------|---------------------|---------------------|
| 1 | **Tab audio capture** | `chrome.tabCapture` → offscreen document | `getDisplayMedia()` — pick tab + share audio |
| 2 | **Gemini Live pipeline** | Same: resample 16 kHz PCM16 → WebSocket → dual transcript | Same shared module |
| 3 | **Dual subtitles** | Content script injects overlay **on the video page** | Subtitle panel beside the shared tab |
| 4 | **Clickable Japanese** | `kuromoji.js` on **finalized** lines → tappable spans | Same |
| 5 | **Definition popup** | Local JMdict lookup on click | Same |
| 6 | **Cloud Run deploy** | Token endpoint + thin web app shell | **Required for prizes** — deploy by noon |

### Stretch goals (only if core is solid by ~3 PM)

- **Explain in context** — one Gemini call on "Why here?" (not an agent; just a smart popup)
- **In-memory mined words** — sidebar list, no persistence
- **Post-session study agent** — only claim "agent" if we actually build it

### Explicitly NOT today

- macOS / system-audio capture (Zoom, FaceTime)
- Auth, accounts, Anki export, streaks
- Extension published to Chrome Web Store (load unpacked for demo)
- Site-specific integrations beyond generic video overlay injection

### Demo fallback ladder

1. **Best:** Extension on a live Japanese stream → overlay → tap word
2. **Good:** Extension on a **downloaded local video file** opened in Chrome (no WiFi dependency for the page)
3. **OK:** Web app with tab share + side panel (same pipeline, less magic)
4. **Last resort:** Web app + **local audio clip** piped through the pipeline

Download a no-subtitles Japanese clip **before** hacking starts. Test every rung of this ladder before demos.

---

## Architecture

### Shared core (build once, use twice)

```
                    ┌──────────────────────────┐
                    │  shared/                 │
                    │  · gemini-live client    │
                    │  · audio resample 16kHz  │
                    │  · onSegment contract    │
                    │  · kuromoji + JMdict     │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  Chrome extension (PRIMARY) │     │  Web app (FALLBACK + SUBMIT)│
│                             │     │                             │
│  tabCapture → offscreen doc │     │  getDisplayMedia → panel    │
│       ↓                     │     │       ↓                     │
│  Gemini Live WebSocket      │     │  Gemini Live WebSocket      │
│       ↓                     │     │       ↓                     │
│  content script overlay     │     │  React/Vite subtitle UI     │
│  on top of <video>          │     │  next to shared tab         │
└─────────────────────────────┘     └─────────────────────────────┘
              │                                     │
              └──────────────────┬──────────────────┘
                                 ▼ HTTPS
                    ┌──────────────────────────┐
                    │  Cloud Run               │
                    │  POST /api/token         │
                    │  + static web app        │
                    └──────────────────────────┘
```

### Chrome extension (MV3) — three moving parts

| Piece | Job |
|-------|-----|
| **Service worker** | Toolbar click → start/stop; `chrome.tabCapture.getMediaStreamId()`; spin up offscreen doc; message segments to content script |
| **Offscreen document** | AudioContext on captured stream → resample → Gemini Live WebSocket. Service workers can't touch audio — this is mandatory. |
| **Content script** | Inject subtitle overlay DOM on the page; render segments; kuromoji tokenize when `isFinal`; handle word clicks + JMdict popup |

**Permissions (manifest):** `tabCapture`, `offscreen`, `activeTab`, host permissions for demo sites (or `<all_urls>` for hackathon — tighten later).

**kuromoji in the extension:** pure JS, no WASM. Bundle dict as `web_accessible_resources`:

```javascript
kuromoji.builder({ dicPath: chrome.runtime.getURL('dict/') }).build(...)
```

List the `dict/` folder in the manifest or dictionary fetch silently fails.

### Web app fallback

Same `shared/` pipeline. UI is a floating panel instead of injected overlay. User clicks "Share tab" and picks the livestream. Less magical, same wedge, satisfies deploy requirement. **Scaffold this first** — it's our insurance policy and submission URL.

### Auth: ephemeral tokens, not an audio proxy

Cloud Run mints short-lived Gemini tokens (`client.auth_tokens.create()`). Audio streams **client → Gemini directly**. Real API key never in the extension or web bundle.

- Endpoint: `v1alpha` (ephemeral tokens + Live API)
- Model: `gemini-3.5-live-translate-preview` *(confirm at workshop — ask a mentor first thing)*
- Input: 16 kHz PCM16 mono · Output: 24 kHz + transcriptions

### Japanese word segmentation

**Use `kuromoji.js`** in both extension content script and web app:

- Returns surface form, **base form**, reading, part of speech
- "外れた" → base "外れる" → JMdict hit ✓

**Do not tokenize mid-stream.** Show plain streaming text until `isFinal: true`, then swap in clickable tokens.

**Definitions:** local `jmdict-simplified` JSON — instant, offline. Gemini for contextual explanation only (stretch).

---

## Team contract (hour 1)

Agree this interface before splitting work:

```typescript
interface CaptionSegment {
  id: string;
  jp: string;       // inputAudioTranscription (Japanese)
  en: string;       // outputAudioTranscription (English)
  isFinal: boolean; // ONLY true when Gemini marks segment complete
}

type OnSegment = (segment: CaptionSegment) => void;
```

### Suggested split (2 devs)

**Person A — Pipeline + extension plumbing**

- Cloud Run token endpoint + deploy web app shell early
- `shared/gemini-live` + audio resample
- Extension: service worker, offscreen doc, `tabCapture`
- Done when: tab audio → `{ jp, en, isFinal }` logged in offscreen doc **and** web app fallback works

**Person B — Overlay + learning layer**

- Content script: subtitle overlay injected above/below video (position: fixed, high z-index, pointer-events on words only)
- `kuromoji.js` + JMdict popup component
- Build against **mock segment emitter** until A is ready
- Mirror the same UI in web app panel (copy component, different mount point)
- Done when: mock segments → clickable overlay on a YouTube page → definition popup

**Integration:** A posts segments via `chrome.runtime.sendMessage` → content script. Web app uses the same `OnSegment` callback in-process.

**Non-dev teammates:** pitch, demo script, overlay styling, Japanese QA, screen recording.

### Hour 1 together (non-negotiable)

1. Monorepo scaffold: `shared/`, `extension/`, `web/`, `server/`
2. Agree `CaptionSegment` contract + mock emitter
3. Deploy hello-world + `/api/token` to Cloud Run
4. Load unpacked extension in Chrome; confirm content script injects on YouTube

Then split.

---

## Hour-by-hour plan

| Time | Everyone |
|------|----------|
| **9:30–11:30** | Workshop. **First question:** is live speech-to-speech translation in today's stack? |
| **11:30–12:15** | Team formation, scaffold monorepo, contract, Cloud Run deploy, extension loads + injects empty overlay |
| **12:15–12:30** | Split: A → tabCapture/offscreen; B → overlay + mock segments |
| **12:30–13:00** | Lunch |
| **13:00–14:30** | A: Gemini Live end-to-end. B: clickable words + JMdict on mock data |
| **14:30–15:30** | Wire extension messages; web app fallback using same `shared/` |
| **15:30–16:00** | Integration, test fallback ladder, fix demo-breaking bugs only |
| **16:00–16:30** | Demo prep — extension on stage, submit Cloud Run URL |

Protect the last 30–60 minutes for pitch rehearsal, not new features.

---

## Judging checklist

| Criterion | Our answer |
|-----------|------------|
| **Google Cloud integration** | Gemini Live API + Cloud Run token service + deployed web app |
| **Innovation / multimodal** | Live speech-to-speech on raw audio — overlay on video, no subtitle track |
| **Completeness** | Extension: live capture → overlay subs → tap word → definition. Web app ready as backup. |
| **Deployed project** | Cloud Run URL submitted (web app); demo the extension live |
| **Managed Agents bonus** | Post-session study agent only if we ship it; don't fake it |

---

## Roles we're looking for

- **Full-stack / extension dev** — MV3, offscreen doc, `tabCapture` (Person A)
- **Frontend dev** — content script overlay, kuromoji, popup UI (Person B)
- **Designer** — overlay on video (readable on any background, dual-language subtitle feel)
- **Native Japanese speaker** — translation QA, tokenization edge cases, demo content

---

## Getting started (dev setup)

### Prerequisites

- Node.js 20+ (or Bun)
- Google Cloud / Gemini API access (hackathon credits)
- Chrome on macOS

### Repo layout (planned)

```
mimi/
├── shared/          # gemini-live, resample, tokenizer, jmdict, types
├── extension/       # MV3: manifest, service worker, offscreen, content script
├── web/             # Vite app — fallback UI + submission deploy target
├── server/          # Cloud Run: POST /api/token, serves web/ static
└── mockup/          # HTML mockup for design reference
```

### First clone (TODO — scaffold Saturday morning)

```bash
git clone <repo-url>
cd mimi
npm install

# Terminal 1 — local token server + web app
cp .env.example .env
npm run dev

# Terminal 2 — load extension
# chrome://extensions → Developer mode → Load unpacked → extension/dist
```

### Load unpacked extension

1. `npm run build:extension`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `extension/dist`
3. Open a YouTube livestream → click Mimi icon → overlay should appear

### Env vars

```
GEMINI_API_KEY=          # server-side only (Cloud Run / local server)
TOKEN_ENDPOINT=https://… # extension + web app fetch ephemeral tokens from here
```

### Key dependencies (planned)

| Package | Purpose |
|---------|---------|
| Raw WebSocket or `@google/generative-ai` | Gemini Live |
| `kuromoji` | Japanese morphological analysis |
| `jmdict-simplified` or bundled JSON | Dictionary lookups |
| `vite` + `@crxjs/vite-plugin` or `plasmo` | Extension bundling *(pick one at scaffold time)* |

### Useful references

- [Gemini Live API — ephemeral tokens](https://ai.google.dev/gemini-api/docs/live)
- [chrome.tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Offscreen documents (MV3)](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- Language-learning subtitle overlays — UX reference for overlay placement

---

## Recruiting pitch (interactive, ~15 sec)

**Opener:** Quick question — have you ever made your own flashcards to learn a language?

**If YES:**
> Same thing — but from **any live audio** — the Netflix show you're watching, a call with your tutor, a live event, anything. Tap a word, get the definition, save it. Gemini hackathon today. Need a **designer** and a **native JP speaker** — interested?

**If NO:**
> The idea's simple: people learn better when vocabulary comes from **their own life** — the Netflix show you're watching, a call with your tutor, a live event, anything. We're building flashcards from live audio. Chrome extension, hackathon today. Need a **designer** and someone who can **catch bad Japanese**. Team up?

---

## Slide deck (6 slides)

**Slide 1 — Title**
- Mimi (耳) — Learn Japanese from live audio
- Chrome extension: live translation + clickable subtitles
- Tap any word → instant definition

**Slide 1.5 — Thesis**
- The best vocabulary is personal
- Save words from shows, streams, and conversations you care about
- Learn faster when every card comes from something you watched or lived

**Slide 2 — Problem**
- Live translation tools aren't learning tools
- You understand in the moment — but nothing sticks
- Netflix show you're watching, a call with your tutor, a live event — no way to capture and study what you hear

**Slide 3 — Solution**
- Mimi listens to live audio → bilingual subtitles on the video
- Tap any word for an instant definition
- Flashcards from your own life, not a textbook

**Slide 4 — Demo**
- Browser call with teammate *(backup: YouTube livestream)*
- Subtitles appear in real time
- Click a word → definition popup

**Slide 5 — Roadmap**
- **Today:** Chrome extension + web app on Cloud Run
- **Next:** macOS / mobile app for any audio around you
- **Later:** Study agent auto-builds a deck matched to your level

## Demo pitch script (~2 min)

Quick show of hands — has anyone made flashcards from stuff they actually watch or listen to?

*[pause]*

It's simple: you learn faster when vocabulary comes from your life — the show you're watching, not a textbook.

The problem: live translation tools help you understand, but they're not **learning** tools. The Netflix show you're watching, a call with your tutor, a live event — you hear it once and forget it. Nothing to study later.

This app, called Mimi — Japanese for ear — listens to live audio instead. It's a Chrome extension. Open any tab with Japanese audio, click Mimi, and Gemini translates in real time. Japanese and English subtitles appear right on the video.

*[demo: rehearsed browser call with teammate; backup rehearsed YouTube video if that fails]*

And this is what translation alone can't do — **tap any word**. Instant definition. *[click, popup]* Save it for your deck.

Live translation that actually helps you learn. Web app on Cloud Run too — link in the submission.

### Stage notes

- Have the **backup YouTube tab already open** — switch without apologizing if the call hiccups
- Rehearse the browser call twice before demos; teammate pre-positioned and scripted
- End on the **click → popup** moment; that's the screenshot

---

## Roadmap (beyond today)

1. **macOS app** — ScreenCaptureKit for system audio (city hall Zoom, landlord calls)
2. **Study agent** — post-session: group words, generate examples, build review deck
3. **Anki export** — one-click deck sync
4. **Chrome Web Store** publish + site whitelist tuning

---

## FAQ

**Extension vs web app — which do we submit?**
Submit the **Cloud Run web app URL**. Demo the **extension** on stage. They're the same backend and shared pipeline.

**What if overlay injection breaks on the demo site?**
Fall back to web app tab-share, or a different site we tested (YouTube is the default target). Have the fallback ladder rehearsed.

**Isn't this just live captions?**
No — captions and translation help you understand. Mimi turns every word into something you can tap, define, and save for later.

**Why "Mimi" (耳)?**
Ear — 耳から覚える ("learn by ear"). Short, memorable.

---

## Contact

DM **[your handle]** or find us at team formation after the workshop.

**Mockup:** see `mockup/` *(TODO: add HTML mockup from recruiting post)*

---

*Last updated: Jun 26, 2026 — extension-primary, web-app-fallback strategy. No third-party product comparisons.*
