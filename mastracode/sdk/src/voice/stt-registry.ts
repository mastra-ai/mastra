/**
 * Speech-to-text (STT) model registry for push-to-talk voice input.
 *
 * This is the single source of truth shared by the `/voice` settings picker,
 * settings validation, and the cloud transcription resolver. Entries are
 * derived from models.dev (https://models.dev/api.json): a model is treated as
 * STT when its modalities are audio-in / text-out with no text input.
 *
 * Most cloud providers here speak the OpenAI `/audio/transcriptions` shape, so
 * the cloud engine resolves them through Mastra's `OpenAIVoice` (`MastraVoice`)
 * built on the OpenAI client — `openai` uses the default endpoint, every other
 * OpenAI-compatible host supplies its `baseURL`. Deepgram is the exception: it
 * is not OpenAI-compatible, so it resolves through `@mastra/voice-deepgram`
 * (`DeepgramVoice`). Deepgram is not in the models.dev STT snapshot but is a
 * first-class hosted STT provider, so it is added deliberately.
 *
 * The accompanying snapshot test (`__tests__/stt-registry.test.ts`) re-derives
 * the models.dev-backed entries from a checked-in snapshot so this list stays
 * honest and can be refreshed deliberately rather than drifting by hand.
 */

/**
 * How a provider's transcription model is constructed.
 * - `openai`: `OpenAIVoice` with the default OpenAI endpoint.
 * - `openai-compatible`: `OpenAIVoice` pointed at the host's `baseURL`
 *   (its `/audio/transcriptions` endpoint follows the OpenAI shape).
 * - `deepgram`: `DeepgramVoice` from `@mastra/voice-deepgram` (not
 *   OpenAI-compatible; uses the Deepgram SDK).
 */
export type STTResolver = 'openai' | 'openai-compatible' | 'deepgram';

export interface STTModel {
  /** models.dev provider id (also the AuthStorage key for the API key). */
  provider: string;
  /** Bare model id passed to the provider's transcription factory. */
  model: string;
  /** Human-friendly label for the picker. */
  label: string;
  /** How to build the transcription model. */
  resolver: STTResolver;
  /** Base URL for `openai-compatible` providers (from models.dev `api`). */
  baseURL?: string;
}

/**
 * The curated STT catalog. Order matters: the first entry for a provider is its
 * default model, and the first overall entry (`openai`/`whisper-1`) is the
 * global default.
 */
export const STT_MODELS: readonly STTModel[] = [
  // OpenAI — default provider.
  { provider: 'openai', model: 'whisper-1', label: 'OpenAI Whisper', resolver: 'openai' },
  { provider: 'openai', model: 'gpt-4o-transcribe', label: 'OpenAI GPT-4o Transcribe', resolver: 'openai' },
  {
    provider: 'openai',
    model: 'gpt-4o-mini-transcribe',
    label: 'OpenAI GPT-4o mini Transcribe',
    resolver: 'openai',
  },
  // Groq — fast, cheap whisper hosting via its OpenAI-compatible endpoint.
  {
    provider: 'groq',
    model: 'whisper-large-v3-turbo',
    label: 'Groq Whisper Large v3 Turbo',
    resolver: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
  },
  {
    provider: 'groq',
    model: 'whisper-large-v3',
    label: 'Groq Whisper Large v3',
    resolver: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
  },
  // Deepgram — dedicated STT provider (not OpenAI-compatible); via @mastra/voice-deepgram.
  { provider: 'deepgram', model: 'nova-3', label: 'Deepgram Nova-3', resolver: 'deepgram' },
  // Alibaba Qwen ASR (OpenAI-compatible endpoints).
  {
    provider: 'alibaba',
    model: 'qwen3-asr-flash',
    label: 'Alibaba Qwen3 ASR Flash',
    resolver: 'openai-compatible',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  },
  {
    provider: 'alibaba-cn',
    model: 'qwen3-asr-flash',
    label: 'Alibaba Qwen3 ASR Flash (China)',
    resolver: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  // Whisper hosts (OpenAI-compatible endpoints).
  {
    provider: 'scaleway',
    model: 'whisper-large-v3',
    label: 'Scaleway Whisper Large v3',
    resolver: 'openai-compatible',
    baseURL: 'https://api.scaleway.ai/v1',
  },
  {
    provider: 'nvidia',
    model: 'openai/whisper-large-v3',
    label: 'Nvidia Whisper Large v3',
    resolver: 'openai-compatible',
    baseURL: 'https://integrate.api.nvidia.com/v1',
  },
  {
    provider: 'nearai',
    model: 'openai/whisper-large-v3',
    label: 'NEAR AI Whisper Large v3',
    resolver: 'openai-compatible',
    baseURL: 'https://cloud-api.near.ai/v1',
  },
  {
    provider: 'evroc',
    model: 'openai/whisper-large-v3-turbo',
    label: 'evroc Whisper Large v3 Turbo',
    resolver: 'openai-compatible',
    baseURL: 'https://models.think.evroc.com/v1',
  },
  {
    provider: 'evroc',
    model: 'openai/whisper-large-v3',
    label: 'evroc Whisper Large v3',
    resolver: 'openai-compatible',
    baseURL: 'https://models.think.evroc.com/v1',
  },
  {
    provider: 'evroc',
    model: 'KBLab/kb-whisper-large',
    label: 'evroc KB-Whisper Large',
    resolver: 'openai-compatible',
    baseURL: 'https://models.think.evroc.com/v1',
  },
] as const;

/** The global default STT model (first registry entry). */
export const DEFAULT_STT_MODEL: STTModel = STT_MODELS[0]!;

/** The default STT provider when none is configured. */
export const DEFAULT_STT_PROVIDER = DEFAULT_STT_MODEL.provider;

/** Unique provider ids in registry order. */
export function sttProviders(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of STT_MODELS) {
    if (!seen.has(m.provider)) {
      seen.add(m.provider);
      out.push(m.provider);
    }
  }
  return out;
}

/** All models offered for a provider, in registry order. */
export function sttModelsForProvider(provider: string): STTModel[] {
  return STT_MODELS.filter(m => m.provider === provider);
}

/** The default (first) model for a provider, or undefined if unknown. */
export function defaultModelForProvider(provider: string): STTModel | undefined {
  return STT_MODELS.find(m => m.provider === provider);
}

/**
 * Resolve a provider/model pair to a concrete registry entry.
 * Falls back to the provider default (then the global default) so callers
 * always get a usable entry even if settings name an unknown model.
 */
export function resolveSTTModel(provider?: string, model?: string): STTModel {
  if (provider) {
    if (model) {
      const exact = STT_MODELS.find(m => m.provider === provider && m.model === model);
      if (exact) return exact;
    }
    const providerDefault = defaultModelForProvider(provider);
    if (providerDefault) return providerDefault;
  }
  return DEFAULT_STT_MODEL;
}
