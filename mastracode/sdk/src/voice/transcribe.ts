// OAuth (Codex) tokens cannot call the transcription endpoints, so callers pass a real provider API key.

import { Readable } from 'node:stream';

import type { DeepgramModel } from '@mastra/voice-deepgram';
import type { OpenAIConfig } from '@mastra/voice-openai';

import { providerApiKeyEnvVar } from '../agents/mastracode-gateway.js';
import type { AuthStorage } from '../auth/storage.js';
import type { STTModel } from './stt-registry.js';

const STT_ONLY_API_KEY_ENV_VARS: Record<string, string> = { deepgram: 'DEEPGRAM_API_KEY' };

const STT_TIMEOUT_MS = 60_000;

const STT_MAX_RETRIES = 1;

export function sttApiKeyEnvVar(provider: string): string | undefined {
  return STT_ONLY_API_KEY_ENV_VARS[provider] ?? providerApiKeyEnvVar(provider);
}

export function resolveSTTApiKey(provider: string, authStorage?: AuthStorage): string | undefined {
  const envVar = sttApiKeyEnvVar(provider);
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  return fromEnv || authStorage?.getStoredApiKey(provider);
}

/** Structural, because each `@mastra/voice-*` package extends its own bundled `MastraVoice`. */
interface VoiceListener {
  listen(
    audioStream: NodeJS.ReadableStream,
    options?: Record<string, unknown>,
  ): Promise<string | { transcript?: string }>;
}

type Listen = (audio: Buffer, filetype: string) => Promise<string | { transcript?: string }>;

function listenWithFiletype(voice: VoiceListener): Listen {
  return (audio, filetype) => voice.listen(Readable.from(audio), { filetype });
}

// The OpenAI SDK reads OPENAI_ORG_ID and OPENAI_PROJECT_ID, which belong to the OPENAI_API_KEY account only.
function openAIClientOptions(entry: STTModel, apiKey: string): OpenAIConfig['options'] {
  return {
    timeout: STT_TIMEOUT_MS,
    maxRetries: STT_MAX_RETRIES,
    ...(apiKey === process.env.OPENAI_API_KEY?.trim() ? {} : { organization: null, project: null }),
    ...(entry.resolver === 'openai-compatible' && entry.baseURL ? { baseURL: entry.baseURL } : {}),
  };
}

// Each voice SDK loads on first dictation, not with every session.
async function buildListen(entry: STTModel, apiKey: string): Promise<Listen> {
  if (entry.resolver === 'deepgram') {
    const { DeepgramVoice } = await import('@mastra/voice-deepgram');
    // `name` is typed for Deepgram's own ids; the registry's model string is passed verbatim.
    const voice = new DeepgramVoice({ listeningModel: { name: entry.model as DeepgramModel, apiKey } });
    return audio => voice.listen(Readable.from(audio));
  }
  // The OpenAI and Mistral constructors also build a TTS client and throw without its key.
  const speechModel = { apiKey };
  if (entry.resolver === 'mistral') {
    const { MistralVoice } = await import('@mastra/voice-mistral');
    return listenWithFiletype(new MistralVoice({ speechModel, listeningModel: { name: entry.model, apiKey } }));
  }
  const { OpenAIVoice } = await import('@mastra/voice-openai');
  return listenWithFiletype(
    new OpenAIVoice({
      speechModel,
      listeningModel: {
        // Typed for OpenAI's own ids; the client accepts any model string and baseURL.
        name: entry.model as OpenAIConfig['name'],
        apiKey,
        options: openAIClientOptions(entry, apiKey),
      },
    }),
  );
}

function normalizeTranscript(result: string | { transcript?: string }): string {
  return (typeof result === 'string' ? result : (result.transcript ?? '')).trim();
}

export interface STTTranscriber {
  /** `filetype` is the extension the provider reads the format from (`wav`, `webm`, `m4a`…). */
  transcribe(audio: Buffer, filetype: string): Promise<string>;
}

export async function createSTTTranscriber(entry: STTModel, apiKey: string): Promise<STTTranscriber> {
  const listen = await buildListen(entry, apiKey);
  return {
    async transcribe(audio, filetype) {
      let timer: NodeJS.Timeout | undefined;
      // Only the OpenAI client takes a timeout; Mistral and Deepgram calls, and an OpenAI retry after a slow attempt, are abandoned here, not cancelled.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Speech-to-text timed out after 1 minute.')), STT_TIMEOUT_MS);
      });
      try {
        return normalizeTranscript(await Promise.race([listen(audio, filetype), timeout]));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
