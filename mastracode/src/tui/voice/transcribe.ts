/**
 * Speech-to-text transcription for push-to-talk voice input (cloud path).
 *
 * Provider-agnostic: most supported cloud providers speak the OpenAI
 * `/audio/transcriptions` shape (see `stt-registry.ts`), so we drive them
 * through Mastra's own voice abstraction — `OpenAIVoice` (a `MastraVoice`) from
 * `@mastra/voice-openai`. The `openai` provider uses the default endpoint; every
 * other OpenAI-compatible host is reached by pointing the underlying client at
 * its `baseURL`. Deepgram is not OpenAI-compatible, so it is driven through
 * `DeepgramVoice` from `@mastra/voice-deepgram` instead.
 *
 * Using `MastraVoice.listen()` keeps this aligned with the framework's voice
 * ecosystem and normalizes provider responses to a transcript string. The voice
 * package constructs its own SDK client internally, so this avoids coupling to a
 * specific `@ai-sdk/*` model-spec version.
 *
 * Note: OpenAI OAuth (Codex) tokens cannot be used for the audio transcription
 * REST endpoint, so a real provider API key is required.
 */

import { Readable } from 'node:stream';
import { DeepgramVoice } from '@mastra/voice-deepgram';
import { OpenAIVoice } from '@mastra/voice-openai';
import type { AuthStorage } from '../../auth/storage.js';
import { DEFAULT_STT_MODEL, resolveSTTModel } from './stt-registry.js';
import type { STTModel } from './stt-registry.js';

/**
 * The minimal surface of a `MastraVoice` we use here. Declared structurally to
 * avoid coupling to a specific cross-package `MastraVoice` class identity
 * (`@mastra/voice-*` packages extend their own bundled copy).
 */
interface VoiceListener {
  listen(audioStream: NodeJS.ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Per-provider environment variable that holds an API key, checked before the
 * stored credential. Mirrors the key names used elsewhere in MastraCode.
 */
const PROVIDER_ENV_VAR: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  alibaba: 'DASHSCOPE_API_KEY',
  'alibaba-cn': 'DASHSCOPE_API_KEY',
  scaleway: 'SCALEWAY_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  nearai: 'NEAR_AI_API_KEY',
  evroc: 'EVROC_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
};

export class VoiceCredentialError extends Error {
  constructor(provider: string) {
    super(
      `Voice input needs a ${provider} API key. Set ${
        PROVIDER_ENV_VAR[provider] ?? `${provider.toUpperCase()}_API_KEY`
      } or add one with /api-keys (OAuth tokens are not supported for transcription).`,
    );
    this.name = 'VoiceCredentialError';
  }
}

/**
 * Resolve an API key for a cloud STT provider.
 * Honors the env-overrides-stored-key contract: the provider's env var wins,
 * then the stored credential is used as a fallback.
 */
export function resolveProviderApiKey(provider: string, authStorage?: AuthStorage): string | undefined {
  const envVar = PROVIDER_ENV_VAR[provider];
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  if (fromEnv) return fromEnv;
  return authStorage?.getStoredApiKey(provider);
}

/**
 * Build a `MastraVoice` for an STT registry entry.
 * - `deepgram`: `DeepgramVoice` (Deepgram SDK; not OpenAI-compatible).
 * - everything else: `OpenAIVoice`, where `listeningModel.name` is the model id
 *   and `options.baseURL` redirects OpenAI-compatible hosts at their endpoint.
 */
function buildVoice(entry: STTModel, apiKey: string): VoiceListener {
  if (entry.resolver === 'deepgram') {
    return new DeepgramVoice({
      // `name` is typed for Deepgram's own ids; the model string is passed verbatim.
      listeningModel: { name: entry.model as never, apiKey },
    });
  }
  return new OpenAIVoice({
    // `name`/`options` are typed for OpenAI's own ids, but the underlying client
    // accepts any model string + baseURL — both are passed through verbatim.
    listeningModel: {
      name: entry.model as never,
      apiKey,
      ...(entry.resolver === 'openai-compatible' && entry.baseURL ? { options: { baseURL: entry.baseURL } } : {}),
    },
  });
}

export interface TranscribeOptions {
  /** STT provider id (see `stt-registry.ts`). Defaults to the registry default. */
  provider?: string;
  /** Model id within the provider. Defaults to the provider's default model. */
  model?: string;
  authStorage?: AuthStorage;
}

/**
 * Transcribe recorded WAV audio to text via the configured cloud provider.
 * Throws VoiceCredentialError if no API key is available for the provider.
 */
export async function transcribeAudio(audio: Buffer, options: TranscribeOptions = {}): Promise<string> {
  const entry = resolveSTTModel(options.provider, options.model) ?? DEFAULT_STT_MODEL;
  const apiKey = resolveProviderApiKey(entry.provider, options.authStorage);
  if (!apiKey) {
    throw new VoiceCredentialError(entry.provider);
  }

  const voice = buildVoice(entry, apiKey);
  const result = await voice.listen(Readable.from(audio), { filetype: 'wav' });
  return normalizeTranscript(result);
}

/**
 * A reusable transcriber bound to one provider/model. Building the underlying
 * `MastraVoice` client once and reusing it across calls lets the HTTP client
 * keep its connection to the provider warm (keep-alive), which removes the
 * DNS + TLS handshake cost from every live-partial tick — the main reason the
 * first dictation streams in slowly while later ones feel instant.
 */
export interface ReusableTranscriber {
  transcribe(audio: Buffer): Promise<string>;
}

/**
 * Create a transcriber that reuses a single provider client across calls.
 * Resolves the provider/model and API key once up front (throwing
 * `VoiceCredentialError` if no key is available), so a session can build it on
 * start and call `transcribe()` per tick without re-resolving or reconnecting.
 */
export function createTranscriber(options: TranscribeOptions = {}): ReusableTranscriber {
  const entry = resolveSTTModel(options.provider, options.model) ?? DEFAULT_STT_MODEL;
  const apiKey = resolveProviderApiKey(entry.provider, options.authStorage);
  if (!apiKey) {
    throw new VoiceCredentialError(entry.provider);
  }
  const voice = buildVoice(entry, apiKey);
  return {
    async transcribe(audio: Buffer): Promise<string> {
      const result = await voice.listen(Readable.from(audio), { filetype: 'wav' });
      return normalizeTranscript(result);
    },
  };
}

/**
 * Check whether a cloud STT provider has a usable API key, without recording.
 */
export function hasProviderCredential(provider: string, authStorage?: AuthStorage): boolean {
  return resolveProviderApiKey(provider, authStorage) !== undefined;
}

/**
 * `MastraVoice.listen()` returns a string for OpenAI-shaped transcription, but
 * other provider subclasses may return `{ transcript }` — normalize both.
 */
function normalizeTranscript(result: unknown): string {
  if (typeof result === 'string') return result.trim();
  if (result && typeof result === 'object' && 'transcript' in result) {
    const transcript = (result as { transcript?: unknown }).transcript;
    if (typeof transcript === 'string') return transcript.trim();
  }
  return '';
}
