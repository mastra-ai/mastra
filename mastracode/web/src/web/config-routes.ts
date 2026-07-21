import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { removeCustomPackFromSettings } from '@mastra/code-sdk/onboarding/custom-packs';
import {
  removeCustomProviderFromSettings,
  upsertCustomProviderInSettings,
} from '@mastra/code-sdk/onboarding/custom-providers';
import { applyOmRoleOverride, persistOmObserveAttachments } from '@mastra/code-sdk/onboarding/om-settings';
import { getAvailableModePacks } from '@mastra/code-sdk/onboarding/packs';
import type { ModePack, ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import {
  getCustomProviderId,
  loadSettings,
  saveSettings,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import type { CustomProviderSetting } from '@mastra/code-sdk/onboarding/settings';

import { isOrganizationAdmin } from './auth.js';
import {
  getAuthProviderId,
  listTenantCredentialsForRequest,
  resolveCredentialContext,
  WEB_OAUTH_FLOW_KINDS,
} from './provider-credentials.js';
import { invalidateTenantCredentialSnapshots } from './tenant-credentials.js';
import type { CredentialRecord, LoginSessionKind } from './storage/domains/credentials/base';

/** Widen a route-local Hono context to the plain `Context` the auth helpers take. */
function loose(c: unknown): import('hono').Context {
  return c as import('hono').Context;
}

/**
 * Server-side configuration routes for the web app.
 *
 * The browser has no access to the credential store or the model catalog, so
 * the web settings panel asks the server — which owns both — to list providers
 * and manage API keys. This mirrors the TUI's `/api-keys` command, exposing the
 * same `AuthStorage`-backed key management over HTTP.
 *
 * Keys are never returned to the client; only their presence and source.
 */

/**
 * Where a provider's active credential comes from, as seen by the caller.
 * Local mode reports `oauth`/`stored` (server-global `auth.json`); tenant mode
 * reports the scoped variants (`oauth-user`/`stored-user`/`stored-org`).
 */
export type ProviderCredentialSource =
  'oauth' | 'stored' | 'env' | 'none' | 'oauth-user' | 'stored-user' | 'stored-org';

/** A model provider with the current source of its credentials. */
export interface ProviderInfo {
  provider: string;
  /** Env var the provider's key is read from, if any. */
  envVar?: string;
  /** Where the active credential comes from. */
  source: ProviderCredentialSource;
  /** Web OAuth sign-in capability, when the provider supports it. */
  oauth?: { supported: true; modes: LoginSessionKind[] };
}

/** Minimal session surface a pack activation touches. */
interface PackSession {
  mode: { get: () => string };
  model: { switch: (args: { modelId: string }) => Promise<void> };
  subagents: { model: { set: (args: { modelId: string; agentType: string }) => Promise<void> } };
  thread: {
    getId: () => string | null;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
    list: () => Promise<Array<{ id: string; metadata?: Record<string, unknown> }>>;
  };
}

/** One observational-memory role's read/switch surface. */
interface OMRole {
  modelId: () => string | undefined;
  threshold: () => number | undefined;
  switchModel: (args: { modelId: string }) => Promise<void>;
}

/**
 * Session-state fields the OM config routes write. The index signatures mirror
 * `MastraCodeState` so the concrete `Session.state.set(Partial<MastraCodeState>)`
 * stays assignable to this minimal surface (contravariant parameter check).
 */
interface OMStateWrites {
  [key: string]: unknown;
  [key: `subagentModelId_${string}`]: string | undefined;
  observationThreshold?: number;
  reflectionThreshold?: number;
  observeAttachments?: 'auto' | boolean;
}

/** Minimal session surface the OM config routes touch. */
export interface OMSession extends PackSession {
  state: {
    get: () => Record<string, unknown> | undefined;
    set: (updates: OMStateWrites) => Promise<void> | void;
  };
  om: { observer: OMRole; reflector: OMRole };
}

/** Minimal controller surface this module needs (model catalog + modes + sessions). */
interface ModelCatalog {
  listAvailableModels: () => Promise<Array<{ provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }>>;
  listModes?: () => Array<{ id: string; defaultModelId?: string }>;
  getSessionByResource?: (resourceId: string) => Promise<OMSession | undefined>;
}

/**
 * Build a deduplicated, sorted list of providers from the model catalog,
 * annotated with where each provider's credential currently comes from.
 * Mirrors the TUI's `/api-keys` provider list.
 *
 * When `tenantCredentials` is given (deployed mode), sources reflect the
 * *caller's* tenant rows with user > org precedence and the server-global
 * `authStorage` is ignored; otherwise the local `auth.json` view is reported.
 */
export async function listProviders(
  controller: ModelCatalog,
  authStorage?: AuthStorage,
  tenantCredentials?: CredentialRecord[],
): Promise<ProviderInfo[]> {
  const models = await controller.listAvailableModels();
  const seen = new Map<string, ProviderInfo>();

  for (const model of models) {
    if (seen.has(model.provider)) continue;

    const authProviderId = getAuthProviderId(model.provider);
    let source: ProviderInfo['source'] = 'none';
    if (tenantCredentials) {
      const userRec = tenantCredentials.find(r => r.scope === 'user' && r.provider === authProviderId);
      const orgRec = tenantCredentials.find(r => r.scope === 'org' && r.provider === authProviderId);
      if (userRec?.credential.type === 'oauth') {
        source = 'oauth-user';
      } else if (userRec?.credential.type === 'api_key') {
        source = 'stored-user';
      } else if (orgRec?.credential.type === 'api_key') {
        source = 'stored-org';
      }
    } else if (authStorage?.isLoggedIn(authProviderId)) {
      source = 'oauth';
    } else if (authStorage?.hasStoredApiKey(model.provider)) {
      source = 'stored';
    } else if (model.apiKeyEnvVar && process.env[model.apiKeyEnvVar]) {
      source = 'env';
    } else if (model.hasApiKey) {
      source = 'env';
    }

    const flowKind = WEB_OAUTH_FLOW_KINDS[model.provider];
    seen.set(model.provider, {
      provider: model.provider,
      envVar: model.apiKeyEnvVar,
      source,
      ...(flowKind ? { oauth: { supported: true as const, modes: [flowKind] } } : {}),
    });
  }

  return Array.from(seen.values()).sort((a, b) => a.provider.localeCompare(b.provider));
}

/** A user-defined OpenAI-compatible provider, with key presence (never the key). */
export interface CustomProviderInfo {
  id: string;
  name: string;
  url: string;
  hasApiKey: boolean;
  models: string[];
}

/** Read the saved custom providers from global settings (keys redacted). */
export function listCustomProviders(): CustomProviderInfo[] {
  const settings = loadSettings();
  return settings.customProviders.map(p => ({
    id: getCustomProviderId(p.name),
    name: p.name,
    url: p.url,
    hasApiKey: Boolean(p.apiKey),
    models: p.models,
  }));
}

/** Validate + coerce a request body into a CustomProviderSetting. */
function parseCustomProviderBody(body: unknown): CustomProviderSetting | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { error: 'Missing required field: name' };
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  if (!url) return { error: 'Missing required field: url' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'url must be an http(s) URL' };
    }
  } catch {
    return { error: 'url must be a valid URL' };
  }
  const apiKey = typeof b.apiKey === 'string' && b.apiKey.trim() ? b.apiKey.trim() : undefined;
  const models = Array.isArray(b.models)
    ? b.models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map(m => m.trim())
    : [];
  return { name, url, apiKey, models };
}

// ── Model packs ──────────────────────────────────────────────────────────

/** A model pack as surfaced to the web client, with an `active` flag. */
export interface ModelPackInfo extends ModePack {
  custom: boolean;
  active: boolean;
}

/**
 * Compute which providers the user can reach, mirroring the TUI's
 * `/models-pack` access derivation: OAuth/api-key from the credential store for
 * the named providers, plus any other provider that has a usable key.
 */
export async function buildProviderAccess(
  controller: ModelCatalog,
  authStorage?: AuthStorage,
): Promise<ProviderAccess> {
  const models = await controller.listAvailableModels();
  const hasEnv = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (storageProviderId: string): ProviderAccessLevel => {
    const cred = authStorage?.get(storageProviderId);
    if (cred?.type === 'oauth') return 'oauth';
    if (cred?.type === 'api_key' && cred.key.trim().length > 0) return 'apikey';
    return false;
  };
  const access: ProviderAccess = {
    anthropic: accessLevel('anthropic'),
    openai: accessLevel('openai-codex'),
    cerebras: hasEnv('cerebras') ? 'apikey' : false,
    google: hasEnv('google') ? 'apikey' : false,
    deepseek: hasEnv('deepseek') ? 'apikey' : false,
    'github-copilot': accessLevel('github-copilot'),
  };
  const seen = new Set(Object.keys(access));
  for (const m of models) {
    if (!seen.has(m.provider) && m.hasApiKey) {
      access[m.provider] = 'apikey';
      seen.add(m.provider);
    }
  }
  return access;
}

/**
 * List available model packs (built-in, gated by provider access, plus saved
 * custom packs). Drops the synthetic "New Custom" placeholder — the web client
 * has its own create flow. `active` is set from the given session's thread when
 * a resourceId is supplied.
 */
export async function listModelPacks(
  controller: ModelCatalog,
  authStorage?: AuthStorage,
  activePackId?: string | null,
): Promise<ModelPackInfo[]> {
  const access = await buildProviderAccess(controller, authStorage);
  const settings = loadSettings();
  return getAvailableModePacks(access, settings.customModelPacks)
    .filter(p => p.id !== 'custom') // synthetic "choose each model" placeholder
    .map(p => ({
      ...p,
      custom: p.id.startsWith('custom:'),
      active: activePackId != null && p.id === activePackId,
    }));
}

/** Resolve the active pack id for a session by reading its current thread. */
async function resolveActivePackId(session: PackSession | undefined): Promise<string | null> {
  if (!session) return null;
  const threadId = session.thread.getId();
  if (!threadId) return null;
  const thread = (await session.thread.list()).find(t => t.id === threadId);
  const value = thread?.metadata?.[THREAD_ACTIVE_MODEL_PACK_ID_KEY];
  return typeof value === 'string' ? value : null;
}

/**
 * Apply a pack to a session: seed each mode's default model, switch the current
 * mode's model, set per-subagent models, and tag the thread with the active
 * pack id. Mirrors the TUI `applyPack` orchestration.
 */
async function applyPackToSession(controller: ModelCatalog, session: PackSession, pack: ModePack): Promise<void> {
  const modes = controller.listModes?.() ?? [];
  const packModels = pack.models as Record<string, string>;

  for (const mode of modes) {
    const modelId = packModels[mode.id];
    if (modelId) {
      mode.defaultModelId = modelId;
      await session.thread.setSetting({ key: `modeModelId_${mode.id}`, value: modelId });
    }
  }

  const currentModeModel = packModels[session.mode.get()];
  if (currentModeModel) {
    await session.model.switch({ modelId: currentModeModel });
  }

  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
    const saModelId = packModels[modeId];
    if (saModelId) {
      await session.subagents.model.set({ modelId: saModelId, agentType });
    }
  }

  await session.thread.setSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pack.id });
}

// ── Observational memory ────────────────────────────────────────────────────
// Mirrors the TUI `/om` command. Observer/reflector model + threshold reads come
// from the session (state, falling back to omConfig defaults); writes go to both
// the session (state + thread setting, via the same session methods the TUI uses)
// and GlobalSettings (settings.json), so the choice survives restarts and stays
// in sync with the terminal.

/** Default thresholds mirror the TUI `/om` fallbacks. */
const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
const DEFAULT_REFLECTION_THRESHOLD = 40_000;

/** Read the current OM config from a session. */
export interface OMConfigInfo {
  observerModelId: string;
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
  observeAttachments: 'auto' | boolean;
}

export function readOMConfig(session: OMSession): OMConfigInfo {
  const state = session.state.get() ?? {};
  const observeAttachments = state.observeAttachments;
  return {
    observerModelId: session.om.observer.modelId() ?? '',
    reflectorModelId: session.om.reflector.modelId() ?? '',
    observationThreshold: session.om.observer.threshold() ?? DEFAULT_OBSERVATION_THRESHOLD,
    reflectionThreshold: session.om.reflector.threshold() ?? DEFAULT_REFLECTION_THRESHOLD,
    observeAttachments: observeAttachments === true || observeAttachments === false ? observeAttachments : 'auto',
  };
}

/** Persist an OM threshold to GlobalSettings (settings.json), mirroring `/om`. */
function persistOmThreshold(role: 'observation' | 'reflection', value: number): void {
  const settings = loadSettings();
  if (role === 'observation') settings.models.omObservationThreshold = value;
  else settings.models.omReflectionThreshold = value;
  saveSettings(settings);
}

/** Persist an OM role model override to GlobalSettings, snapshotting the other role. */
function persistOmRoleOverride(
  role: 'observer' | 'reflector',
  modelId: string,
  otherRoleCurrentModelId: string | null,
): void {
  const settings = loadSettings();
  applyOmRoleOverride(settings, role, modelId, otherRoleCurrentModelId);
  saveSettings(settings);
}

/**
 * Build the web config routes as Mastra `apiRoutes`:
 *   - `GET    /web/config/providers`              — list providers + key source
 *   - `PUT    /web/config/providers/:provider/key` — set/update a provider's API key
 *   - `DELETE /web/config/providers/:provider/key` — remove a stored API key
 *   - `GET    /web/config/custom-providers`        — list custom OpenAI-compatible providers
 *   - `POST   /web/config/custom-providers`        — create/update a custom provider
 *   - `DELETE /web/config/custom-providers/:id`    — remove a custom provider
 *   - `GET    /web/config/om`                      — read OM models/thresholds/observe-attachments
 *   - `PUT    /web/config/om/:role/model`          — switch observer/reflector model
 *   - `PUT    /web/config/om/thresholds`           — set observation/reflection thresholds
 *   - `PUT    /web/config/om/observe-attachments`  — set observe-attachments (auto/on/off)
 */
export function buildConfigRoutes(options: { controller: ModelCatalog; authStorage?: AuthStorage }): ApiRoute[] {
  const { controller, authStorage } = options;

  return [
    registerApiRoute('/web/config/providers', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        try {
          // Tenant mode lists the caller's rows and never exposes the
          // server-global auth.json; local mode is unchanged.
          const tenantCredentials = await listTenantCredentialsForRequest(loose(c));
          return c.json({
            providers: await listProviders(controller, tenantCredentials ? undefined : authStorage, tenantCredentials),
          });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/providers/:provider/key', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const ctx = await resolveCredentialContext(loose(c));
        if ('response' in ctx) return ctx.response;

        const provider = c.req.param('provider');
        let body: { key?: unknown; envVar?: unknown; scope?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const key = typeof body.key === 'string' ? body.key.trim() : '';
        if (!key) return c.json({ error: 'Missing required field: key' }, 400);
        const envVar = typeof body.envVar === 'string' ? body.envVar : undefined;
        const scope = body.scope === 'org' ? 'org' : 'user';
        try {
          if (ctx.mode === 'tenant') {
            if (scope === 'org' && !(await isOrganizationAdmin(loose(c), ctx.orgId))) {
              return c.json({ error: 'organization_admin_required' }, 403);
            }
            const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
            // envVar is intentionally ignored: tenant credentials are resolved
            // per-request, never written into process.env.
            await ctx.storage.setCredential(tenant, getAuthProviderId(provider), { type: 'api_key', key });
            invalidateTenantCredentialSnapshots(tenant);
            const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
            const providers = await listProviders(controller, undefined, records);
            return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
          }
          if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
          // Local mode is single-user: scope is meaningless and ignored.
          authStorage.setStoredApiKey(provider, key, envVar);
          const providers = await listProviders(controller, authStorage);
          return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/providers/:provider/key', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const ctx = await resolveCredentialContext(loose(c));
        if ('response' in ctx) return ctx.response;

        const provider = c.req.param('provider');
        const scope = c.req.query('scope') === 'org' ? 'org' : 'user';
        try {
          if (ctx.mode === 'tenant') {
            if (scope === 'org' && !(await isOrganizationAdmin(loose(c), ctx.orgId))) {
              return c.json({ error: 'organization_admin_required' }, 403);
            }
            const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
            await ctx.storage.removeCredential(tenant, getAuthProviderId(provider));
            invalidateTenantCredentialSnapshots(tenant);
            const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
            const providers = await listProviders(controller, undefined, records);
            return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
          }
          if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
          authStorage.remove(`apikey:${provider}`);
          const providers = await listProviders(controller, authStorage);
          return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    // ── Custom providers (OpenAI-compatible endpoints) ──────────────────────
    // Mirrors the TUI's /custom-providers command. Backed by GlobalSettings
    // (settings.json), not session state — these are user-global definitions.

    registerApiRoute('/web/config/custom-providers', {
      method: 'GET',
      requiresAuth: false,
      handler: c => {
        try {
          return c.json({ providers: listCustomProviders() });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/custom-providers', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const parsed = parseCustomProviderBody(body);
        if ('error' in parsed) return c.json({ error: parsed.error }, 400);
        // `previousId` lets a rename remove the old entry as well as any name clash.
        const previousId =
          body && typeof body === 'object' && typeof (body as Record<string, unknown>).previousId === 'string'
            ? ((body as Record<string, unknown>).previousId as string)
            : undefined;
        try {
          const settings = loadSettings();
          upsertCustomProviderInSettings(settings, parsed, previousId);
          saveSettings(settings);
          const id = getCustomProviderId(parsed.name);
          return c.json({ ok: true, provider: listCustomProviders().find(p => p.id === id) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/custom-providers/:id', {
      method: 'DELETE',
      requiresAuth: false,
      handler: c => {
        const id = c.req.param('id');
        try {
          const settings = loadSettings();
          removeCustomProviderFromSettings(settings, id);
          saveSettings(settings);
          return c.json({ ok: true });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    // ── Model packs ─────────────────────────────────────────────────────────
    // Mirrors the TUI's /models-pack command. Listing + custom-pack CRUD are
    // global-settings state; activation is session-scoped and resolves the
    // session from the controller registry by resourceId.

    registerApiRoute('/web/config/model-packs', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resourceId = c.req.query('resourceId');
        try {
          const session = resourceId ? await controller.getSessionByResource?.(resourceId) : undefined;
          const activePackId = await resolveActivePackId(session);
          return c.json({ packs: await listModelPacks(controller, authStorage, activePackId), activePackId });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/model-packs', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        let body: { name?: unknown; models?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return c.json({ error: 'Missing required field: name' }, 400);
        const m = (body.models ?? {}) as Record<string, unknown>;
        const build = typeof m.build === 'string' ? m.build.trim() : '';
        const plan = typeof m.plan === 'string' ? m.plan.trim() : '';
        const fast = typeof m.fast === 'string' ? m.fast.trim() : '';
        if (!build || !plan || !fast) {
          return c.json({ error: 'models.build, models.plan and models.fast are required' }, 400);
        }
        try {
          const settings = loadSettings();
          const entry = { name, models: { build, plan, fast }, createdAt: new Date().toISOString() };
          const idx = settings.customModelPacks.findIndex(p => p.name === name);
          if (idx >= 0) settings.customModelPacks[idx] = entry;
          else settings.customModelPacks.push(entry);
          saveSettings(settings);
          return c.json({ ok: true, pack: { id: `custom:${name}`, name, models: { build, plan, fast } } });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/model-packs/:id', {
      method: 'DELETE',
      requiresAuth: false,
      handler: c => {
        const id = decodeURIComponent(c.req.param('id'));
        try {
          const settings = loadSettings();
          removeCustomPackFromSettings(settings, id);
          saveSettings(settings);
          return c.json({ ok: true });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/model-packs/:id/activate', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const id = decodeURIComponent(c.req.param('id'));
        let body: { resourceId?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
        if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
        try {
          const session = await controller.getSessionByResource?.(resourceId);
          if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
          const packs = await listModelPacks(controller, authStorage);
          const pack = packs.find(p => p.id === id);
          if (!pack) return c.json({ error: `Unknown pack "${id}"` }, 404);
          await applyPackToSession(controller, session, pack);
          return c.json({ ok: true, activePackId: pack.id });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    // ── Observational memory ──────────────────────────────────────────────────
    // Mirrors the TUI's /om command. All five knobs are session-scoped (resolved
    // from the session, persisted to its state + thread setting) plus written to
    // GlobalSettings so the choice survives restarts and stays in sync with the TUI.

    registerApiRoute('/web/config/om', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resourceId = c.req.query('resourceId');
        if (!resourceId) return c.json({ error: 'Missing required query param: resourceId' }, 400);
        try {
          const session = await controller.getSessionByResource?.(resourceId);
          if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
          return c.json({ config: readOMConfig(session) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/om/:role/model', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        const role = c.req.param('role');
        if (role !== 'observer' && role !== 'reflector') {
          return c.json({ error: `Unknown OM role "${role}"` }, 400);
        }
        let body: { resourceId?: unknown; modelId?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
        const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
        if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
        if (!modelId) return c.json({ error: 'Missing required field: modelId' }, 400);
        try {
          const session = await controller.getSessionByResource?.(resourceId);
          if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
          const otherRole = role === 'observer' ? session.om.reflector : session.om.observer;
          const otherRoleCurrentModelId = otherRole.modelId() ?? null;
          await session.om[role].switchModel({ modelId });
          persistOmRoleOverride(role, modelId, otherRoleCurrentModelId);
          return c.json({ ok: true, config: readOMConfig(session) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/om/thresholds', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        let body: { resourceId?: unknown; observationThreshold?: unknown; reflectionThreshold?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
        if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
        const observation =
          typeof body.observationThreshold === 'number' && body.observationThreshold > 0
            ? Math.round(body.observationThreshold)
            : undefined;
        const reflection =
          typeof body.reflectionThreshold === 'number' && body.reflectionThreshold > 0
            ? Math.round(body.reflectionThreshold)
            : undefined;
        if (observation === undefined && reflection === undefined) {
          return c.json({ error: 'Provide observationThreshold and/or reflectionThreshold (positive numbers)' }, 400);
        }
        try {
          const session = await controller.getSessionByResource?.(resourceId);
          if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
          if (observation !== undefined) {
            await session.state.set({ observationThreshold: observation });
            await session.thread.setSetting({ key: 'observationThreshold', value: observation });
            persistOmThreshold('observation', observation);
          }
          if (reflection !== undefined) {
            await session.state.set({ reflectionThreshold: reflection });
            await session.thread.setSetting({ key: 'reflectionThreshold', value: reflection });
            persistOmThreshold('reflection', reflection);
          }
          return c.json({ ok: true, config: readOMConfig(session) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),

    registerApiRoute('/web/config/om/observe-attachments', {
      method: 'PUT',
      requiresAuth: false,
      handler: async c => {
        let body: { resourceId?: unknown; value?: unknown };
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
        if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
        const raw = body.value;
        const value: 'auto' | boolean = raw === 'auto' || raw === true || raw === false ? raw : 'auto';
        if (raw !== 'auto' && raw !== true && raw !== false) {
          return c.json({ error: "value must be 'auto', true, or false" }, 400);
        }
        try {
          const session = await controller.getSessionByResource?.(resourceId);
          if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
          await session.state.set({ observeAttachments: value });
          await session.thread.setSetting({ key: 'observeAttachments', value });
          persistOmObserveAttachments(value);
          return c.json({ ok: true, config: readOMConfig(session) });
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    }),
  ];
}
