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
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';
import {
  chooseSTTModel,
  localVoiceCaller,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  savedSTTModel,
  tenantVoiceCaller,
  transcribeAudio,
  voicePolicy,
} from '../voice/transcription.js';
import type { VoiceCaller, VoiceFactory, VoicePolicy } from '../voice/transcription.js';
import { resolveCredentialContext } from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

function loose(c: unknown): Context {
  return c as Context;
}

const factoryIdSchema = z.string().min(1).optional();

const settingsBodySchema = z.union([
  z
    .object({ factoryId: factoryIdSchema, provider: z.null() })
    .transform(({ factoryId }) => ({ factoryId, entry: null })),
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
  keys: Array<{ provider: string; envVar: string | undefined; saved: boolean }>;
}

export type TranscribeResponse = ModelChoice & { text: string };

function settingsResponse(policy: VoicePolicy, saved: STTModel | undefined, canEdit: boolean): VoiceSettingsResponse {
  const effective = chooseSTTModel(policy, saved);
  return {
    scope: policy.scope,
    selected: choice(saved),
    canEdit,
    effective: 'error' in effective ? null : choice(effective.entry),
    models: STT_MODELS.map(m => ({ provider: m.provider, model: m.model, label: m.label })),
    keys: sttProviders().map(provider => ({
      provider,
      envVar: sttApiKeyEnvVar(provider),
      saved: policy.keyFor(provider) !== undefined,
    })),
  };
}

export class VoiceRoutes extends Route<VoiceRoutesDeps> {
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

  async #canEdit(c: Context, request: VoiceRequest, policy: VoicePolicy): Promise<boolean> {
    if (policy.scope === 'user' || !request.orgId) return true;
    return this.deps.auth.isOrganizationAdmin(c, request.orgId);
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
          const policy = voicePolicy(request.caller, request.factory);
          const saved = await savedSTTModel(this.deps.voiceSettings, policy.settingsKey);
          return c.json(settingsResponse(policy, saved, await this.#canEdit(c, request, policy)));
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
          const storage = this.deps.voiceSettings;
          await storage.ensureReady();
          if (entry) await storage.set({ ...policy.settingsKey, provider: entry.provider, model: entry.model });
          else await storage.clear(policy.settingsKey);
          return c.json(settingsResponse(policy, entry ?? undefined, canEdit));
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
          const request = await this.#request(c, c.req.query('factoryId') || undefined);
          if ('response' in request) return request.response;
          const policy = voicePolicy(request.caller, request.factory);
          const chosen = chooseSTTModel(policy, await savedSTTModel(this.deps.voiceSettings, policy.settingsKey));
          if ('error' in chosen) return c.json({ error: chosen.error }, 400);

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
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ error: `Transcription failed: ${message}` }, 502);
          }
        },
      }),
    ];
  }
}
