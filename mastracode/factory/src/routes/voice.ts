/**
 * Voice input routes for the web composer.
 *
 * The browser records a clip with `MediaRecorder` and posts it here; the server
 * transcribes it with the caller's provider API key (see `voice/transcription.ts`
 * for which key and model apply under each Factory model scope), so keys never
 * reach the browser.
 */

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { STT_MODELS, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';
import {
  chooseSTTModel,
  factoryVoiceSettingsKey,
  localVoiceCaller,
  MAX_TRANSCRIBE_AUDIO_BYTES,
  savedSTTModel,
  tenantVoiceCaller,
  transcribeAudio,
  voicePolicy,
} from '../voice/transcription.js';
import type { VoiceCaller, VoiceFactory } from '../voice/transcription.js';
import { resolveCredentialContext } from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

function loose(c: unknown): Context {
  return c as Context;
}

const transcribeBodySchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().min(1),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  factoryId: z.string().min(1).optional(),
});

const settingsBodySchema = z.object({
  /** `personal` saves the caller's own choice; `factory` saves the Factory's (org admins only). */
  target: z.enum(['personal', 'factory']).default('personal'),
  factoryId: z.string().min(1).optional(),
  provider: z.string().min(1).nullable(),
  model: z.string().min(1).optional(),
});

export interface VoiceRoutesDeps extends RouteDependencies {
  /** File-backed credentials for local (no-auth) mode. */
  authStorage?: AuthStorage;
  /** Tenant credential domain; absent in local mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Saved transcription model choices. Without it voice input stays on auto. */
  voiceSettings?: VoiceSettingsStorage;
  /** Factory projects, for the model scope and Factory voice model a request names. */
  factoryProjects?: FactoryProjectsStorage;
}

interface VoiceRequest {
  caller: VoiceCaller;
  factory?: VoiceFactory;
  /** The tenant org, for admin checks; absent in local mode. */
  orgId?: string;
}

function choice(entry: STTModel | undefined): { provider: string; model: string } | null {
  return entry ? { provider: entry.provider, model: entry.model } : null;
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
    if (!projects) return { response: c.json({ error: 'factory_unavailable' }, 503) };
    await projects.ensureReady();
    // Local mode is single-user; tenants only ever see their own org's Factories.
    const project = orgId ? await projects.get({ orgId, id: factoryId }) : await projects.getById({ id: factoryId });
    if (!project) return { response: c.json({ error: 'factory_project_not_found' }, 404) };
    return { caller, orgId, factory: { id: project.id, orgId: project.orgId, modelScope: project.modelScope } };
  }

  async #canEditFactory(c: Context, request: VoiceRequest): Promise<boolean> {
    if (!request.factory) return false;
    return request.orgId ? this.deps.auth.isOrganizationAdmin(c, request.orgId) : true;
  }

  async #settings(c: Context, request: VoiceRequest) {
    const storage = this.deps.voiceSettings;
    const { caller, factory } = request;
    const policy = voicePolicy(caller, factory);
    const effective = await chooseSTTModel(policy, storage);
    return {
      modelScope: factory?.modelScope ?? null,
      personal: choice(await savedSTTModel(storage, caller.settingsKey)),
      factory: factory ? choice(await savedSTTModel(storage, factoryVoiceSettingsKey(factory))) : null,
      canEditFactory: await this.#canEditFactory(c, request),
      effective: 'error' in effective ? null : choice(effective.entry),
      models: STT_MODELS.map(m => ({
        provider: m.provider,
        model: m.model,
        label: m.label,
        available: policy.keyFor(m.provider) !== undefined,
      })),
      keys: sttProviders().map(provider => ({
        provider,
        user: caller.userKey(provider) !== undefined,
        org: caller.orgKey(provider) !== undefined,
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
          const request = await this.#request(c, c.req.query('factoryId') || undefined);
          if ('response' in request) return request.response;
          return c.json(await this.#settings(c, request));
        },
      }),
      registerApiRoute('/web/voice/settings', {
        method: 'PUT',
        requiresAuth: false,
        handler: async context => {
          const c = loose(context);
          const parsed = settingsBodySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) return c.json({ error: 'Expected { provider, model }.' }, 400);
          const { target, factoryId, provider, model } = parsed.data;
          if (target === 'factory' && !factoryId) return c.json({ error: 'Expected a factoryId.' }, 400);

          const request = await this.#request(c, factoryId);
          if ('response' in request) return request.response;
          const storage = this.deps.voiceSettings;
          if (!storage) return c.json({ error: 'Voice settings storage is unavailable.' }, 503);
          if (target === 'factory' && !(await this.#canEditFactory(c, request))) {
            return c.json({ error: 'organization_admin_required' }, 403);
          }
          const key =
            target === 'factory' && request.factory
              ? factoryVoiceSettingsKey(request.factory)
              : request.caller.settingsKey;

          await storage.ensureReady();
          if (provider === null) {
            await storage.clear(key);
            return c.json(await this.#settings(c, request));
          }
          const entry = model
            ? STT_MODELS.find(m => m.provider === provider && m.model === model)
            : STT_MODELS.find(m => m.provider === provider);
          if (!entry)
            return c.json({ error: `${provider}/${model ?? ''} is not a supported speech-to-text model.` }, 400);
          await storage.set({ ...key, provider: entry.provider, model: entry.model });
          return c.json(await this.#settings(c, request));
        },
      }),
      registerApiRoute('/web/voice/transcribe', {
        method: 'POST',
        requiresAuth: false,
        middleware: (context, next) => limitBody(loose(context), next),
        handler: async context => {
          const c = loose(context);
          const parsed = transcribeBodySchema.safeParse(await c.req.json().catch(() => undefined));
          if (!parsed.success) return c.json({ error: 'Expected { audio, mimeType }.' }, 400);
          const audio = Buffer.from(parsed.data.audio, 'base64');
          if (audio.length === 0) return c.json({ error: 'Recording is empty.' }, 400);
          if (audio.length > MAX_TRANSCRIBE_AUDIO_BYTES) {
            return c.json({ error: 'Recording is too long to transcribe.' }, 413);
          }

          const request = await this.#request(c, parsed.data.factoryId);
          if ('response' in request) return request.response;
          const chosen = await chooseSTTModel(voicePolicy(request.caller, request.factory), this.deps.voiceSettings, {
            provider: parsed.data.provider,
            model: parsed.data.model,
          });
          if ('error' in chosen) return c.json({ error: chosen.error }, 400);
          try {
            const text = await transcribeAudio(chosen, audio, parsed.data.mimeType);
            return c.json({ text, provider: chosen.entry.provider, model: chosen.entry.model });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ error: `Transcription failed: ${message}` }, 502);
          }
        },
      }),
    ];
  }
}
