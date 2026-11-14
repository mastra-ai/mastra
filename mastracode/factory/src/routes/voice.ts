import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { findSTTModel, STT_MODELS, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { sttApiKeyEnvVar } from '@mastra/code-sdk/voice/transcribe';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { VoiceSettingsRecord, VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';
import { voiceRateLimiter } from '../voice/rate-limit.js';
import { keyCannotTranscribe, mintRealtimeSession } from '../voice/realtime.js';
import type { RealtimeSession } from '../voice/realtime.js';
import {
  chooseSTTModel,
  localVoiceCaller,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  savedSTTModel,
  tenantVoiceCaller,
  transcribeAudio,
  transcriptionFailureReason,
  voicePolicy,
} from '../voice/transcription.js';
import type { STTSelection, VoiceCaller, VoiceFactory, VoicePolicy } from '../voice/transcription.js';
import { resolveCredentialContext } from './provider-credentials.js';
import { loose, Route } from './route.js';
import type { RouteDependencies } from './route.js';

const factoryIdSchema = z.string().min(1).optional();
const GATEWAY_STT_PROVIDER = 'mastra-gateway';

const settingsBodySchema = z.union([
  z
    .object({ factoryId: factoryIdSchema, provider: z.null() })
    .transform(({ factoryId }) => ({ factoryId, entry: null })),
  z
    .object({
      factoryId: factoryIdSchema,
      provider: z.literal(GATEWAY_STT_PROVIDER),
      model: z.string().min(1).max(256),
    })
    .transform(({ factoryId, provider, model }) => ({ factoryId, entry: { provider, model } })),
  z
    .object({ factoryId: factoryIdSchema, provider: z.string().min(1), model: z.string().min(1) })
    .transform(({ factoryId, provider, model }, ctx) => {
      const entry = findSTTModel(provider, model);
      if (!entry) {
        ctx.addIssue({ code: 'custom', message: `${provider}/${model} is not a supported speech-to-text model.` });
        return z.NEVER;
      }
      return { factoryId, entry };
    }),
]);

export interface VoiceRoutesDeps extends RouteDependencies {
  authStorage?: AuthStorage;
  modelCredentials?: ModelCredentialsStorage;
  voiceSettings: VoiceSettingsStorage;
  factoryProjects: FactoryProjectsStorage;
}

interface VoiceRequest {
  caller: VoiceCaller;
  factory?: VoiceFactory;
  /** Absent in local mode, where there is no org admin to check. */
  orgId?: string;
}

type ModelChoice = { provider: string; model: string };

function choice(entry: STTModel | undefined): ModelChoice | null {
  return entry ? { provider: entry.provider, model: entry.model } : null;
}

export interface VoiceSettingsResponse {
  scope: VoicePolicy['scope'];
  selected: ModelChoice | null;
  canEdit: boolean;
  effective: ModelChoice | null;
  models: Array<ModelChoice & { label: string }>;
  /** `fromEnv`: local mode reads the key from the server environment, so it cannot be updated or removed here. */
  keys: Array<{ provider: string; envVar: string | undefined; saved: boolean; fromEnv: boolean }>;
}

export type TranscribeResponse = ModelChoice & { text: string };

export type LiveSessionResponse = { mode: 'batch' } | ({ mode: 'live' } & RealtimeSession);

function settingsResponse(
  request: VoiceRequest,
  policy: VoicePolicy,
  stored: VoiceSettingsRecord | null,
  canEdit: boolean,
  authStorage: AuthStorage | undefined,
): VoiceSettingsResponse {
  const saved = stored ? findSTTModel(stored.provider, stored.model) : undefined;
  const effective = chooseSTTModel(policy, saved);
  return {
    scope: policy.scope,
    selected:
      stored?.provider === GATEWAY_STT_PROVIDER ? { provider: stored.provider, model: stored.model } : choice(saved),
    canEdit,
    effective: 'error' in effective ? null : choice(effective.entry),
    models: STT_MODELS.map(m => ({ provider: m.provider, model: m.model, label: m.label })),
    keys: sttProviders().map(provider => {
      const envVar = sttApiKeyEnvVar(provider);
      const envKey = envVar ? process.env[envVar]?.trim() : undefined;
      return {
        provider,
        envVar,
        saved: policy.keyFor(provider) !== undefined,
        // Tenant mode never reads deployment env keys for transcription. Saving a key in local mode also copies it
        // into process.env, so an env value equal to the stored key is the stored key, not an environment one.
        fromEnv: !request.orgId && Boolean(envKey) && envKey !== authStorage?.getStoredApiKey(provider)?.trim(),
      };
    }),
  };
}

export class VoiceRoutes extends Route<VoiceRoutesDeps> {
  readonly #rateLimiter = voiceRateLimiter();

  async #request(c: Context, factoryId: string | undefined): Promise<VoiceRequest | { response: Response }> {
    const ctx = await resolveCredentialContext({ c, auth: this.deps.auth, credentials: this.deps.modelCredentials });
    if ('response' in ctx) return ctx;
    const caller =
      ctx.mode === 'tenant'
        ? tenantVoiceCaller(await ctx.storage.listCredentials(ctx.orgId, ctx.userId), ctx.orgId, ctx.userId)
        : localVoiceCaller(this.deps.authStorage);
    const orgId = ctx.mode === 'tenant' ? ctx.orgId : undefined;
    if (!factoryId) return { caller, orgId };

    const projects = this.deps.factoryProjects;
    await projects.ensureReady();
    // Local mode is single-user; tenants only ever see their own org's Factories.
    const project = orgId ? await projects.get({ orgId, id: factoryId }) : await projects.getById({ id: factoryId });
    if (!project) return { response: c.json({ error: 'factory_project_not_found' }, 404) };
    return { caller, orgId, factory: project };
  }

  /** A named 503 rather than a generic 500, and never a silent fall back to auto. */
  async #voiceSettings(c: Context): Promise<VoiceSettingsStorage | { response: Response }> {
    try {
      await this.deps.voiceSettings.ensureReady();
      return this.deps.voiceSettings;
    } catch {
      return {
        response: c.json(
          {
            error: 'voice_settings_unavailable',
            message: 'Voice settings storage is unavailable — the app database is not configured or failed to start.',
          },
          503,
        ),
      };
    }
  }

  async #canEdit(c: Context, request: VoiceRequest, policy: VoicePolicy): Promise<boolean> {
    if (policy.scope === 'user' || !request.orgId) return true;
    return this.deps.auth.isOrganizationAdmin(c, request.orgId);
  }

  #overLimit(c: Context, caller: VoiceCaller, use: 'check' | 'take'): Response | undefined {
    const { orgId, userId } = caller.settingsKey;
    const verdict = this.#rateLimiter[use](`${orgId}:${userId}`);
    if (verdict.allowed) return undefined;
    return c.json({ error: 'voice_rate_limited' }, 429, { 'Retry-After': String(verdict.retryAfterSeconds) });
  }

  async #selection(c: Context): Promise<{ chosen: STTSelection; caller: VoiceCaller } | { response: Response }> {
    const request = await this.#request(c, c.req.query('factoryId') || undefined);
    if ('response' in request) return request;
    const storage = await this.#voiceSettings(c);
    if ('response' in storage) return storage;
    const policy = voicePolicy(request.caller, request.factory);
    const chosen = chooseSTTModel(policy, await savedSTTModel(storage, policy.settingsKey));
    if ('error' in chosen) return { response: c.json({ error: chosen.error }, 400) };
    return { chosen, caller: request.caller };
  }

  routes() {
    const limitBody = bodyLimit({
      maxSize: MAX_TRANSCRIBE_AUDIO_BYTES,
      onError: c => c.json({ error: 'Recording is too long to transcribe.' }, 413),
    });
    return [
      registerApiRoute('/web/voice/settings', {
        method: 'GET',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const request = await this.#request(c, c.req.query('factoryId') || undefined);
          if ('response' in request) return request.response;
          const storage = await this.#voiceSettings(c);
          if ('response' in storage) return storage.response;
          const policy = voicePolicy(request.caller, request.factory);
          const saved = await storage.get(policy.settingsKey);
          return c.json(
            settingsResponse(request, policy, saved, await this.#canEdit(c, request, policy), this.deps.authStorage),
          );
        },
      }),
      registerApiRoute('/web/voice/settings', {
        method: 'PUT',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const parsed = settingsBodySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) {
            const custom = parsed.error.issues.find(issue => issue.code === 'custom');
            return c.json({ error: custom?.message ?? 'Expected { provider, model }.' }, 400);
          }
          const { factoryId, entry } = parsed.data;

          const request = await this.#request(c, factoryId);
          if ('response' in request) return request.response;
          const policy = voicePolicy(request.caller, request.factory);
          const canEdit = await this.#canEdit(c, request, policy);
          if (!canEdit) return c.json({ error: 'organization_admin_required' }, 403);
          const storage = await this.#voiceSettings(c);
          if ('response' in storage) return storage.response;
          if (entry) await storage.set({ ...policy.settingsKey, provider: entry.provider, model: entry.model });
          else await storage.clear(policy.settingsKey);
          return c.json(
            settingsResponse(request, policy, await storage.get(policy.settingsKey), canEdit, this.deps.authStorage),
          );
        },
      }),
      registerApiRoute('/web/voice/transcribe', {
        method: 'POST',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const mimeType = c.req.header('content-type') ?? '';
          if (!mimeType.trim().toLowerCase().startsWith('audio/')) {
            return c.json({ error: 'Expected an audio recording.' }, 415);
          }
          const selection = await this.#selection(c);
          if ('response' in selection) return selection.response;
          const overLimit = this.#overLimit(c, selection.caller, 'take');
          if (overLimit) return overLimit;
          const { chosen } = selection;

          let audio: Buffer | undefined;
          const limited = await limitBody(c, async () => {
            audio = Buffer.from(await c.req.arrayBuffer());
          });
          if (limited) return limited;
          if (!audio || audio.length === 0) return c.json({ error: 'Recording is empty.' }, 400);
          try {
            const text = await transcribeAudio(chosen, audio, mimeType);
            const body: TranscribeResponse = { text, provider: chosen.entry.provider, model: chosen.entry.model };
            return c.json(body);
          } catch (error) {
            console.warn('[voice] transcription failed', { provider: chosen.entry.provider, error });
            return c.json({ error: `Transcription failed: ${transcriptionFailureReason(error)}.` }, 502);
          }
        },
      }),
      registerApiRoute('/web/voice/live-session', {
        method: 'POST',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const selection = await this.#selection(c);
          if ('response' in selection) return selection.response;
          const { chosen } = selection;
          const { realtimeModel } = chosen.entry;
          const overLimit = this.#overLimit(c, selection.caller, 'check');
          if (overLimit) return overLimit;
          if (!realtimeModel) return c.json({ mode: 'batch' } satisfies LiveSessionResponse);
          let session: RealtimeSession;
          try {
            session = await mintRealtimeSession(chosen.apiKey, realtimeModel);
          } catch (error) {
            console.warn('[voice] realtime session request failed', { provider: chosen.entry.provider, error });
            if (keyCannotTranscribe(error)) {
              return c.json({ error: `Transcription failed: ${transcriptionFailureReason(error)}.` }, 502);
            }
            return c.json({ mode: 'batch' } satisfies LiveSessionResponse);
          }
          const overLimitAfterMint = this.#overLimit(c, selection.caller, 'take');
          if (overLimitAfterMint) return overLimitAfterMint;
          const body: LiveSessionResponse = { mode: 'live', ...session };
          return c.json(body, 200, { 'Cache-Control': 'no-store' });
        },
      }),
    ];
  }
}
