/**
 * Cloud speech-to-text for an STT registry entry, shared by the TUI `/voice`
 * command and the Factory. Every provider goes through its `MastraVoice`
 * (`@mastra/voice-*`), loaded on first use rather than with every session.
 *
 * OAuth (Codex) tokens cannot call the transcription endpoints, so callers
 * must pass a real provider API key.
 */

import { Readable } from 'node:stream';

import type { AuthStorage } from '../auth/storage.js';
import type { STTModel } from './stt-registry.js';

const STT_API_KEY_ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  alibaba: 'DASHSCOPE_API_KEY',
  'alibaba-cn': 'DASHSCOPE_API_KEY',
  scaleway: 'SCALEWAY_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  nearai: 'NEAR_AI_API_KEY',
  evroc: 'EVROC_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

export function sttApiKeyEnvVar(provider: string): string | undefined {
  return STT_API_KEY_ENV_VARS[provider];
}

/** The provider's env var wins, then the stored `/api-keys` credential. */
export function resolveSTTApiKey(provider: string, authStorage?: AuthStorage): string | undefined {
  const envVar = sttApiKeyEnvVar(provider);
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  return fromEnv || authStorage?.getStoredApiKey(provider);
}

/** Structural, because each `@mastra/voice-*` package extends its own bundled `MastraVoice`. */
interface VoiceListener {
  listen(audioStream: NodeJS.ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
}

async function buildVoice(entry: STTModel, apiKey: string): Promise<VoiceListener> {
  if (entry.resolver === 'deepgram') {
    const { DeepgramVoice } = await import('@mastra/voice-deepgram');
    // `name` is typed for Deepgram's own ids; the registry's model string is passed verbatim.
    return new DeepgramVoice({ listeningModel: { name: entry.model as never, apiKey } });
  }
  // The OpenAI and Mistral constructors also build a TTS client and throw without its key.
  const speechModel = { apiKey };
  if (entry.resolver === 'mistral') {
    const { MistralVoice } = await import('@mastra/voice-mistral');
    return new MistralVoice({ speechModel, listeningModel: { name: entry.model, apiKey } });
  }
  const { OpenAIVoice } = await import('@mastra/voice-openai');
  return new OpenAIVoice({
    speechModel,
    listeningModel: {
      // Typed for OpenAI's own ids; the client accepts any model string and baseURL.
      name: entry.model as never,
      apiKey,
      ...(entry.resolver === 'openai-compatible' && entry.baseURL ? { options: { baseURL: entry.baseURL } } : {}),
    },
  });
}

/** OpenAI-shaped providers return a string, Deepgram returns `{ transcript }`. */
function normalizeTranscript(result: unknown): string {
  if (typeof result === 'string') return result.trim();
  if (result && typeof result === 'object' && 'transcript' in result && typeof result.transcript === 'string') {
    return result.transcript.trim();
  }
  return '';
}

export interface STTTranscriber {
  /** `filetype` is the extension the provider reads the format from (`wav`, `webm`, `m4a`…). */
  transcribe(audio: Buffer, filetype: string): Promise<string>;
}

/** Builds the provider client once, so repeated calls reuse its warm connection. */
export async function createSTTTranscriber(entry: STTModel, apiKey: string): Promise<STTTranscriber> {
  const voice = await buildVoice(entry, apiKey);
  return {
    transcribe: async (audio, filetype) => normalizeTranscript(await voice.listen(Readable.from(audio), { filetype })),
  };
}
