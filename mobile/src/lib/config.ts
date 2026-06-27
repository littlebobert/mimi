import { Platform } from 'react-native';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ?? '';
const liveModel =
  process.env.EXPO_PUBLIC_GEMINI_LIVE_MODEL?.trim() ??
  'gemini-3.5-live-translate-preview';
const defaultApiBaseUrl = 'https://mimi-161955734014.asia-northeast1.run.app';
const apiBaseUrl =
  process.env.EXPO_PUBLIC_MIMI_API_BASE_URL?.trim().replace(/\/$/, '') ??
  (Platform.OS === 'web' ? '' : defaultApiBaseUrl);

let runtimeConfigPromise: Promise<{ apiKey: string; liveModel: string }> | null = null;

export const config = {
  apiKey,
  liveModel,
  apiBaseUrl,
  hasApiKey: apiKey.length > 0,
};

export async function getLiveConfig(): Promise<{ apiKey: string; liveModel: string }> {
  if (config.apiKey) {
    return config;
  }

  runtimeConfigPromise ??= fetchRuntimeConfig();
  return runtimeConfigPromise;
}

export async function requireApiKey(): Promise<string> {
  const liveConfig = await getLiveConfig();
  if (!liveConfig.apiKey) {
    throw new Error('Missing Gemini API key. Set GEMINI_API_KEY on Cloud Run or EXPO_PUBLIC_GEMINI_API_KEY locally.');
  }
  return liveConfig.apiKey;
}

export function apiUrl(path: string): string {
  if (config.apiBaseUrl) {
    if (!/^https?:\/\//.test(config.apiBaseUrl)) {
      throw new Error(`Invalid EXPO_PUBLIC_MIMI_API_BASE_URL: ${config.apiBaseUrl}`);
    }
    return `${config.apiBaseUrl}${path}`;
  }
  if (typeof window !== 'undefined') {
    return path;
  }
  throw new Error('Missing EXPO_PUBLIC_MIMI_API_BASE_URL. Set it to your Cloud Run URL for mobile analysis.');
}

async function fetchRuntimeConfig(): Promise<{ apiKey: string; liveModel: string }> {
  if (typeof window === 'undefined') {
    return config;
  }

  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return config;
    const data = await response.json();
    return {
      apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim() : '',
      liveModel: typeof data.liveModel === 'string' ? data.liveModel.trim() : config.liveModel,
    };
  } catch {
    return config;
  }
}
