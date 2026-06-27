const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const WEB_ROOT = path.resolve(__dirname, '../mobile/dist-web');
const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ||
  process.env.EXPO_PUBLIC_GEMINI_LIVE_MODEL ||
  'gemini-3.5-live-translate-preview';
const ANALYSIS_MODEL =
  process.env.GEMINI_ANALYSIS_MODEL ||
  'gemini-3.5-flash';
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'mimi',
      model: LIVE_MODEL,
      analysisModel: ANALYSIS_MODEL,
    });
    return;
  }

  if (url.pathname === '/api/config') {
    // Hackathon shortcut: the web client connects directly to Gemini Live.
    // Production should replace this with short-lived ephemeral tokens.
    sendJson(
      res,
      200,
      {
        apiKey: process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
        liveModel: LIVE_MODEL,
      },
      { 'Cache-Control': 'no-store' },
    );
    return;
  }

  if (url.pathname === '/api/analyze-session') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    readJsonBody(req)
      .then((body) => analyzeSession(body))
      .then((analysis) => sendJson(res, 200, analysis, { 'Cache-Control': 'no-store' }))
      .catch((error) => {
        console.error('analyze-session failed', error);
        sendJson(
          res,
          error.statusCode || 500,
          { error: error.message || 'Analysis failed' },
          { 'Cache-Control': 'no-store' },
        );
      });
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mimi server listening on ${PORT}`);
  console.log(`Serving ${WEB_ROOT}`);
});

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        const error = new Error('Session audio is too large to analyze in this demo.');
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        const error = new Error('Invalid JSON body.');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function analyzeSession(body) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY on Cloud Run.');
    error.statusCode = 500;
    throw error;
  }

  const audioChunks = Array.isArray(body.audioChunks) ? body.audioChunks : [];
  if (audioChunks.length === 0) {
    const error = new Error('No original audio chunks were provided.');
    error.statusCode = 400;
    throw error;
  }

  const audio = Buffer.concat(
    audioChunks
      .filter((chunk) => typeof chunk === 'string' && chunk.length > 0)
      .map((chunk) => Buffer.from(chunk, 'base64')),
  );
  if (audio.length === 0) {
    const error = new Error('Original audio was empty.');
    error.statusCode = 400;
    throw error;
  }

  const wavBase64 = pcm16MonoToWav(audio, 16000).toString('base64');
  const prompt = buildAnalysisPrompt(body);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    ANALYSIS_MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'audio/wav',
                data: wavBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message || `Gemini analysis failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  return {
    model: ANALYSIS_MODEL,
    ...parseAnalysisJson(text),
  };
}

function buildAnalysisPrompt(body) {
  const segments = Array.isArray(body.segments) ? body.segments : [];
  const targetLanguageCode = body.targetLanguageCode === 'ja' ? 'ja' : 'en';
  const responseLanguage =
    targetLanguageCode === 'ja'
      ? 'Japanese'
      : 'English';
  const transcript = segments
    .map((segment) => {
      const source = typeof segment.jp === 'string' ? segment.jp : '';
      const target = typeof segment.en === 'string' ? segment.en : '';
      return `Source: ${source}\nTranslation: ${target}`;
    })
    .join('\n\n');
  const capturedWords = Array.isArray(body.capturedWords)
    ? body.capturedWords.filter((word) => typeof word === 'string').join(', ')
    : '';

  return `You are Mimi, a post-conversation language learning coach.

Analyze the original audio and transcript from a short language-learning conversation.
Focus on practical study value. Infer likely hesitation, repeated attempts, pronunciation or phrasing trouble, and actual learner mistakes when the audio supports it.
The app guidance language for this session is ${responseLanguage}. Write all JSON string values in ${responseLanguage}. Keep the JSON property names exactly as specified.

Return only valid JSON with this exact shape:
{
  "summary": "one sentence",
  "struggles": ["2-4 concrete observations"],
  "corrections": [{"original": "...", "better": "...", "explanation": "..."}],
  "flashcards": [{"front": "...", "back": "...", "why": "..."}],
  "nextPractice": "one short practice prompt"
}

Known captured words: ${capturedWords || '(none)'}

Live transcript:
${transcript || '(no transcript captured)'}`;
}

function parseAnalysisJson(text) {
  if (!text) {
    return fallbackAnalysis('Gemini returned an empty analysis.');
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through to wrapped text.
      }
    }
    return fallbackAnalysis(text);
  }
}

function fallbackAnalysis(message) {
  return {
    summary: 'Mimi analyzed the session audio.',
    struggles: [message],
    corrections: [],
    flashcards: [],
    nextPractice: 'Repeat one sentence from the conversation more slowly, then try it naturally.',
  };
}

function pcm16MonoToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  const byteRate = sampleRate * 2;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

function serveStatic(requestPath, res) {
  const normalizedPath = decodeURIComponent(requestPath.split('?')[0]);
  const relativePath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const filePath = path.resolve(WEB_ROOT, `.${relativePath}`);

  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (!statError && stat.isFile()) {
      streamFile(filePath, res);
      return;
    }

    // SPA fallback for client-side routes.
    streamFile(path.join(WEB_ROOT, 'index.html'), res);
  });
}

function streamFile(filePath, res) {
  const extension = path.extname(filePath);
  const stream = fs.createReadStream(filePath);

  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control':
        extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
  });
  stream.on('error', () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  stream.pipe(res);
}
