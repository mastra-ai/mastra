/**
 * Speech-to-text for the web composer's voice input.
 *
 * The browser records a clip with `MediaRecorder` and posts it here; the server
 * transcribes it with the caller's own provider API key, so keys never reach
 * the browser. Providers and models come from the shared STT registry
 * (`@mastra/code-sdk/voice/stt-registry`), the same catalog the TUI `/voice`
 * command uses.
 *
 * Only `api_key` credentials qualify: OAuth subscriptions (e.g. ChatGPT via
 * `openai-codex`) do not authorize the transcription endpoints.
 */

import { Readable } from 'node:stream';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { resolveSTTModel, STT_MODELS, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import type { CredentialRecord, ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';
import { getAuthProviderId, resolveCredentialContext } from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

function loose(c: unknown): Context {
  return c as Context;
}

/** Raw audio cap. Roughly half an hour of browser-recorded Opus. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 8 * 1024 * 1024;

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
  mistral: 'MISTRAL_API_KEY',
};

const transcribeBodySchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().min(1),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

interface VoiceListener {
  listen(audioStream: NodeJS.ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
}

/** Map a browser recording MIME type to the file extension providers expect. */
export function audioFiletype(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  switch (base) {
    case 'audio/webm':
    case 'video/webm':
      return 'webm';
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/wave':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      return 'webm';
  }
}

/**
 * The Mistral and OpenAI constructors also build a speech (TTS) client and
 * throw without a key for it, so both get the caller's key instead of falling
 * back to the deployment's env vars.
 */
async function buildVoice(entry: STTModel, apiKey: string): Promise<VoiceListener> {
  if (entry.resolver === 'deepgram') {
    const { DeepgramVoice } = await import('@mastra/voice-deepgram');
    return new DeepgramVoice({ listeningModel: { name: entry.model as never, apiKey } });
  }
  if (entry.resolver === 'mistral') {
    const { MistralVoice } = await import('@mastra/voice-mistral');
    return new MistralVoice({ speechModel: { apiKey }, listeningModel: { name: entry.model, apiKey } });
  }
  const { OpenAIVoice } = await import('@mastra/voice-openai');
  return new OpenAIVoice({
    speechModel: { apiKey },
    listeningModel: {
      name: entry.model as never,
      apiKey,
      ...(entry.resolver === 'openai-compatible' && entry.baseURL ? { options: { baseURL: entry.baseURL } } : {}),
    },
  });
}

function normalizeTranscript(result: unknown): string {
  if (typeof result === 'string') return result.trim();
  if (result && typeof result === 'object' && 'transcript' in result) {
    const transcript = (result as { transcript?: unknown }).transcript;
    if (typeof transcript === 'string') return transcript.trim();
  }
  return '';
}

/** The caller's personal key wins over an organization-shared one. */
function tenantApiKey(records: CredentialRecord[], provider: string): string | undefined {
  const id = getAuthProviderId(provider);
  const record =
    records.find(r => r.scope === 'user' && r.provider === id && r.credential.type === 'api_key') ??
    records.find(r => r.scope === 'org' && r.provider === id && r.credential.type === 'api_key');
  return record?.credential.type === 'api_key' && record.credential.key ? record.credential.key : undefined;
}

function localApiKey(provider: string, authStorage: AuthStorage | undefined): string | undefined {
  const envVar = PROVIDER_ENV_VAR[provider];
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  return fromEnv || authStorage?.getStoredApiKey(provider);
}

export interface VoiceRoutesDeps extends RouteDependencies {
  /** File-backed credentials for local (no-auth) mode. */
  authStorage?: AuthStorage;
  /** Tenant credential domain; absent in local mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** The caller's chosen transcription model. Without it voice input stays on auto. */
  voiceSettings?: VoiceSettingsStorage;
}

const settingsBodySchema = z.object({
  provider: z.string().min(1).nullable(),
  model: z.string().min(1).optional(),
});

/** What the caller can transcribe with: their API keys and their saved model choice. */
interface VoiceCaller {
  keyFor(provider: string): string | undefined;
  settingsKey: { orgId: string; userId: string };
}

export class VoiceRoutes extends Route<VoiceRoutesDeps> {
  async #caller(c: Context): Promise<VoiceCaller | { response: Response }> {
    const ctx = await resolveCredentialContext({ c, auth: this.deps.auth, credentials: this.deps.modelCredentials });
    if ('response' in ctx) return ctx;
    if (ctx.mode === 'tenant') {
      const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
      return {
        keyFor: provider => tenantApiKey(records, provider),
        settingsKey: { orgId: ctx.orgId, userId: ctx.userId },
      };
    }
    return {
      keyFor: provider => localApiKey(provider, this.deps.authStorage),
      settingsKey: { orgId: 'local', userId: 'local' },
    };
  }

  async #savedModel(caller: VoiceCaller): Promise<STTModel | undefined> {
    const storage = this.deps.voiceSettings;
    if (!storage) return undefined;
    await storage.ensureReady();
    const saved = await storage.get(caller.settingsKey);
    return saved ? STT_MODELS.find(m => m.provider === saved.provider && m.model === saved.model) : undefined;
  }

  async #settings(caller: VoiceCaller) {
    const selected = await this.#savedModel(caller);
    return {
      selected: selected ? { provider: selected.provider, model: selected.model } : null,
      models: STT_MODELS.map(m => ({
        provider: m.provider,
        model: m.model,
        label: m.label,
        available: caller.keyFor(m.provider) !== undefined,
      })),
    };
  }

  routes() {
    // Base64 inflates the clip by a third; leave room for the JSON envelope.
    const limitBody = bodyLimit({
      maxSize: Math.ceil((MAX_TRANSCRIBE_AUDIO_BYTES * 4) / 3) + 4096,
      onError: c => c.json({ error: 'Recording is too long to transcribe.' }, 413),
    });
    return [
      registerApiRoute('/web/voice/settings', {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const caller = await this.#caller(c);
          if ('response' in caller) return caller.response;
          return c.json(await this.#settings(caller));
        },
      }),
      registerApiRoute('/web/voice/settings', {
        method: 'PUT',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const caller = await this.#caller(c);
          if ('response' in caller) return caller.response;
          const storage = this.deps.voiceSettings;
          if (!storage) return c.json({ error: 'Voice settings storage is unavailable.' }, 503);

          const parsed = settingsBodySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) return c.json({ error: 'Expected { provider, model }.' }, 400);
          await storage.ensureReady();
          const { provider, model } = parsed.data;
          if (provider === null) {
            await storage.clear(caller.settingsKey);
            return c.json(await this.#settings(caller));
          }
          const entry = model
            ? STT_MODELS.find(m => m.provider === provider && m.model === model)
            : STT_MODELS.find(m => m.provider === provider);
          if (!entry)
            return c.json({ error: `${provider}/${model ?? ''} is not a supported speech-to-text model.` }, 400);
          await storage.set({ ...caller.settingsKey, provider: entry.provider, model: entry.model });
          return c.json(await this.#settings(caller));
        },
      }),
      registerApiRoute('/web/voice/transcribe', {
        method: 'POST',
        requiresAuth: false,
        middleware: (context, next) => limitBody(loose(context), next),
        handler: async context => {
          const c = loose(context);
          const caller = await this.#caller(c);
          if ('response' in caller) return caller.response;

          const parsed = transcribeBodySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) return c.json({ error: 'Expected { audio, mimeType }.' }, 400);
          const audio = Buffer.from(parsed.data.audio, 'base64');
          if (audio.length === 0) return c.json({ error: 'Recording is empty.' }, 400);
          if (audio.length > MAX_TRANSCRIBE_AUDIO_BYTES) {
            return c.json({ error: 'Recording is too long to transcribe.' }, 413);
          }

          const requested = parsed.data.provider;
          if (requested && !sttProviders().includes(requested)) {
            return c.json({ error: `${requested} is not a supported speech-to-text provider.` }, 400);
          }
          // An explicit request wins, then the saved choice, then the first provider with a key.
          const saved = requested ? undefined : await this.#savedModel(caller);
          const chosen = requested ?? saved?.provider;
          const provider = chosen ?? sttProviders().find(p => caller.keyFor(p) !== undefined);
          const apiKey = provider ? caller.keyFor(provider) : undefined;
          if (!provider || !apiKey) {
            return c.json(
              {
                error: chosen
                  ? `Voice input needs a ${chosen} API key. Add one in Settings → Providers, or pick another model in Settings → Voice input.`
                  : 'Voice input needs a speech-to-text API key (for example OpenAI or Mistral). Add one in Settings → Providers.',
              },
              400,
            );
          }

          const entry = resolveSTTModel(provider, parsed.data.model ?? saved?.model);
          try {
            const voice = await buildVoice(entry, apiKey);
            const result = await voice.listen(Readable.from(audio), { filetype: audioFiletype(parsed.data.mimeType) });
            return c.json({ text: normalizeTranscript(result), provider: entry.provider, model: entry.model });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ error: `Transcription failed: ${message}` }, 502);
          }
        },
      }),
    ];
  }
}
