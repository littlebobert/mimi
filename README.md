# Mimi (耳)

**Learn Japanese from real conversations — live.**

> Live translation helps you understand — but it doesn't help you **learn**. **Mimi** is a mobile app that turns real Japanese conversations into flashcards — a tutor call, friends at dinner, a live event. Tap any word to study it later.

*Prototype today: Chrome extension + web app on Cloud Run. Same pipeline, native mobile next.*

Gemini AI Hackathon · Tokyo · Jun 28, 2026 · [AI Builders × Google Japan](https://aibuilders.jp)

---

## The wedge (read this first)

**Live translation tools are great — but they're not learning tools.**

Google Translate, Meet captions — you hear the English, but nothing sticks. Import and subtitle tools work when you've **prepared** content. Real life doesn't wait.

**Real conversations happen on your phone** — a call with your tutor, friends at dinner, a live event. No transcript, no import step, nothing to study later.

**Mimi listens.** Gemini live speech-to-speech translation, bilingual subtitles, tap any word for an instant definition. Flashcards from your actual life — not a textbook.

**We're for the gaps:** live audio and real interactions where prepared study tools can't reach. Keep your usual apps for Netflix with subs — Mimi is for everything else.

That's the product. Today's prototype proves the pipeline works.

---

## Demo strategy: mobile vision, extension prototype today

| Surface | Role |
|---------|------|
| **Mobile app** *(vision)* | **The product** — mic for real conversations, tutor calls, live events on the device you're already holding |
| **Chrome extension** | **Primary demo today** — proves pipeline: live subs overlaid on video, tap-to-define |
| **Web app / PWA (Cloud Run)** | **Submission URL** + fallback demo + optional **phone mic mode** for "real convo" feel |

Judges need a **deployed Cloud Run URL**. Demo the **extension** (or phone PWA with mic) on stage. Pitch the **mobile app** as where it's going.

If we're choosing at 3 PM: working tap-to-define beats platform. Working extension beats broken mobile shell.

### Why not build native mobile today?

~5 hours, Cloud Run deploy requirement, and the shared pipeline (`/api/token` → Gemini Live → segments → kuromoji → JMdict) is identical across platforms — only the **audio capture layer** changes. Ship the pipeline on extension/web; native mobile is the same backend.

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

- Native iOS / Android app (same pipeline, new capture layer — roadmap)
- Auth, accounts, Anki export, LingQ connect, streaks
- Extension published to Chrome Web Store (load unpacked for demo)

### Demo fallback ladder

1. **Best:** Extension on browser call or livestream → overlay → tap word
2. **Good:** **Phone PWA** — open Cloud Run URL on mobile, mic mode, teammate speaks Japanese across the table *(strong "real convo" story)*
3. **OK:** Extension on local video file in Chrome
4. **OK:** Web app with tab share + side panel
5. **Last resort:** Web app + local audio clip

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

### Platform roadmap (same pipeline, different mic)

| Platform | Audio capture | Status |
|----------|---------------|--------|
| **Chrome extension** | `tabCapture` → offscreen doc | **Build today** |
| **Web / PWA** | `getDisplayMedia()` or **`getUserMedia()` mic** | **Build today** — mic mode = phone convo demo |
| **Native mobile** | Device mic (+ system audio later) | **Roadmap** — the product |

```
shared/ pipeline (token → Gemini Live → segments → kuromoji → JMdict)
       ↑              ↑                    ↑
   extension      web/PWA              mobile app (next)
```

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
| **Completeness** | Prototype: live capture → subs → tap word → definition. Mobile vision articulated. |
| **Deployed project** | Cloud Run URL submitted; demo extension or phone PWA live |
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
- [Deploy to Cloud Run from source](https://cloud.google.com/run/docs/deploying-source-code)
- Language-learning subtitle overlays — UX reference for overlay placement

---

## Cloud Run deployment

**Cloud Run = your hosted URL + small backend.** The hackathon requires a deployed link; judges click it to see the web app. This repo now serves the Expo web export from Cloud Run and exposes a tiny API for health/config.

**Audio never goes through Cloud Run.** Static web files and runtime config live there. The browser opens a WebSocket to Gemini directly.

### What runs where

```
Browser ──→ Cloud Run
           ├── GET /           Expo web app
           ├── GET /api/health backend smoke check
           └── GET /api/config runtime Gemini config

Browser ──→ WebSocket → Gemini Live API
           (mic audio stays in the browser)
```

| Component | Where |
|-----------|-------|
| Web app UI | Browser, served from Cloud Run |
| `GEMINI_API_KEY` | Cloud Run env var |
| Live audio → Gemini | Browser ↔ Gemini directly |

### What the server does

One dependency-free Node app in `server/server.js` on port `$PORT` (Cloud Run sets this, usually 8080):

- `GET /` serves `mobile/dist-web/index.html`.
- `GET /api/health` returns `{ ok: true, service: "mimi" }`.
- `GET /api/config` returns the runtime Gemini model and key for the current browser-based Gemini Live shortcut.

Production should replace `/api/config` with short-lived Gemini ephemeral tokens. For the hackathon demo, this keeps the Cloud Run path simple and gets judges a working URL quickly.

### Prerequisites (one-time)

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
# On macOS with Homebrew:
# brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable APIs (hackathon workshop may do this for you)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

Use region **`asia-northeast1`** (Tokyo) for lower latency.

### Deploy — first time (hour 1 goal)

From repo root:

```bash
export GEMINI_API_KEY=your-key-here
npm run deploy:cloud-run
```

Google builds the Dockerfile, deploys it, and prints a URL like `https://mimi-xxxxx.asia-northeast1.run.app`. **Save this URL** — it's your submission link.

First deploy takes ~5–10 minutes. Redeploys are faster.

### Local smoke test

```bash
npm run build:web
GEMINI_API_KEY=your-key-here npm run serve:web
open http://localhost:8080/api/health
```

### Hackathon deploy checklist

| When | Task |
|------|------|
| **Hour 1** | Deploy stub server — `GET /` returns "Mimi" and `POST /api/token` returns `{ ok: true }`. Submit URL immediately. |
| **Hour 2–4** | Wire real ephemeral token minting |
| **Hour 5** | Redeploy with `web/dist` static files + working `/api/token` |
| **Before demo** | Confirm URL loads over HTTPS; extension `TOKEN_URL` matches |

### Gotchas

- **Listen on `$PORT`** — not hardcoded 3000; Cloud Run injects the port
- **CORS on `/api/token`** — extension origin differs from Cloud Run; allow `POST` + preflight `OPTIONS`
- **Cold starts** — first request after idle may take 1–2 sec; fine for token mint, not for audio (which is why audio bypasses Cloud Run)
- **Extension ≠ submission** — judges get the Cloud Run URL; you demo the extension on your laptop
- **Secrets** — for a hackathon, `--set-env-vars GEMINI_API_KEY=...` is fine; don't commit the key to git

---

## Recruiting pitch (interactive, ~15 sec)

**Opener:** Quick question — have you ever made your own flashcards to learn a language?

**If YES:**
> Same thing — but from **real conversations** on your phone — a tutor call, friends at dinner, a live event. Tap a word, save it. Building the prototype at the Gemini hackathon today. Need a **designer** and a **native JP speaker** — interested?

**If NO:**
> People learn better when vocabulary comes from **their life** — conversations, not textbooks. We're building a **mobile app** for that; prototyping it today. Need a **designer** and someone who can **catch bad Japanese**. Team up?

---

## Slide deck (6 slides)

**Open in browser:** [`pitch/slides.html`](pitch/slides.html) — arrow keys or tap to advance, generative fxhash-*inspired* backgrounds.

**Slide 1 — Title**
- Mimi (耳) · Learn Japanese from real conversations
- Mobile app · live translation · tap any word

**Slide 1.5 — Thesis**
- The best vocabulary is personal
- Flashcards from *your* calls, conversations, and live moments
- Not a textbook — your life

**Slide 2 — Problem**
- Live translation ≠ learning — nothing sticks
- Import/subtitle tools need text you've prepared ahead of time
- Real convos on your phone? Hear it once, can't study it

**Slide 3 — Solution**
- Mimi listens → bilingual subtitles in real time
- Tap any word → instant definition → save for later
- For the gaps — live audio, real interactions, no import step

**Slide 4 — Demo**
- Browser call or **phone mic** with teammate speaking Japanese
- Subtitles in real time → tap a word → popup

**Slide 5 — Roadmap**
- **Today:** Expo app + Gemini Live pipeline
- **Next:** Anki export · optional LingQ level connect
- **Later:** Study agent builds a deck matched to your level

---

## Demo pitch script (~2 min)

**[Slide 1]**

Quick show of hands — has anyone made flashcards from stuff they actually watch or listen to?

*[pause]*

The idea is simple: you remember words tied to **your** life — a conversation you had, not a textbook list.

**[Slide 1.5]**

**[Slide 2 — Problem]**

Two problems.

First — live translation helps you **understand**, but nothing **sticks**.

Second — the tools that help you **learn** need text you've **prepared** — subtitles, an imported lesson. That works for study time.

But a **call with your tutor**, **friends at dinner**, a **live event** — that happens on your **phone**, with no transcript. Translation alone doesn't turn that into flashcards.

**[Slide 3 — Solution]**

**Mimi** — Japanese for *ear* — fills that gap.

It's a **mobile app** for real conversations. Gemini's live speech-to-speech API translates in real time. Japanese and English on screen. **Tap any word** — instant definition. Save it for later.

We're not replacing your study apps for prepared content. We're for **everything else**.

**[Slide 4 — Demo]**

We prototyped the core pipeline in a Chrome extension today — same backend on Cloud Run.

*[demo: browser call with teammate, OR phone PWA mic mode — backup tab ready]*

*[click → popup]* This is what translation alone can't do.

**[Slide 5 — Roadmap]**

Native mobile next. Anki export. Optional LingQ connect for your level. A study agent that turns your session into a personalized deck.

Live translation that actually helps you learn. Cloud Run link in the submission.

### Stage notes

- Lead with **mobile vision**, demo the **prototype** — don't apologize for extension, frame it
- **Phone PWA mic demo** is a strong backup and reinforces "real convo" story
- Have backup YouTube tab open on laptop if call hiccups
- End on **click → popup**

### Q&A one-liners

**"Why not just use import/subtitle tools?"**  
> "Keep them for prepared content. We're for live audio with no text track — especially on your phone."

**"Why demo an extension if it's a mobile app?"**  
> "Same pipeline — token, Gemini Live, tap-to-define. Five hours; native mobile is next."

**"Anime Japanese isn't daily Japanese."**  
> "Agreed — that's why we demo a conversation, not anime. You tap what *you* want."

**"Isn't live translate worse than Whisper?"**  
> "For a podcast you'd import tomorrow, maybe. We're on a conversation happening *right now* — and you tap the Japanese, not the English."

---

## Roadmap (beyond today)

1. **Native mobile app** — mic for in-person + calls; the real product surface
2. **Anki export** — cards go where learners already review
3. **LingQ connect** — optional API key → `knownWords` count → level-aware suggestions
4. **Study agent** — post-session: filter by level, group words, generate examples
5. **Chrome Web Store** — extension as desktop companion for video tabs

---

## FAQ

**Mobile app vs extension — what do we submit?**
Submit the **Cloud Run web app URL**. Pitch the **mobile app** as the product. Demo the **extension or phone PWA** as today's prototype.

**Why prototype on extension if it's a mobile app?**
Same pipeline everywhere — only audio capture differs. Extension is fastest to ship in ~5 hours; native mobile uses the same Cloud Run backend.

**What if overlay injection breaks on the demo site?**
Fall back to phone PWA mic mode, web app tab-share, or a different tested site. Have the fallback ladder rehearsed.

**Isn't this just live captions?**
No — captions help you understand. Mimi turns every word into something you can tap, define, and save for later.

**Why "Mimi" (耳)?**
Ear — 耳から覚える ("learn by ear"). Short, memorable. You're listening to real life.

---

## Contact

DM **[your handle]** or find us at team formation after the workshop.

**Mockup:** see `mockup/` *(TODO: add HTML mockup from recruiting post)*

---

*Last updated: Jun 26, 2026 — mobile-first vision, extension/PWA prototype for hackathon.*
