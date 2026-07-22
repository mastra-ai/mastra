import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { getAvailableModePacks } from '@mastra/code-sdk/onboarding/packs';
import type { ModePack, ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import { getCustomProviderId, THREAD_ACTIVE_MODEL_PACK_ID_KEY } from '@mastra/code-sdk/onboarding/settings';
import type { CustomProviderSetting } from '@mastra/code-sdk/onboarding/settings';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { Context } from 'hono';
import type {
  CredentialRecord,
  LoginSessionKind,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import type { CustomProviderRecord, CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type {
  MemorySettingsFillIfUnset,
  MemorySettingsPatch,
  MemorySettingsRecord,
  MemorySettingsStorage,
} from '../storage/domains/memory-settings/base.js';
import type { ModelPackRecord, ModelPacksStorage } from '../storage/domains/model-packs/base.js';
import {
  getAuthProviderId,
  listTenantCredentialsForRequest,
  resolveCredentialContext,
  tenantOrgId,
  WEB_OAUTH_FLOW_KINDS,
} from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteAuth, RouteDependencies } from './route.js';

/** Widen a route-local Hono context to the plain `Context` the auth helpers take. */
function loose(c: unknown): Context {
  return c as Context;
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
  listAvailableModels: () => Promise<
    Array<{ id?: string; modelName?: string; provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }>
  >;
  listModes?: () => Array<{ id: string; defaultModelId?: string }>;
  getSessionByResource?: (resourceId: string, scope?: string) => Promise<OMSession | undefined>;
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
export async function listProviders({
  controller,
  authStorage,
  tenantCredentials,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
}): Promise<ProviderInfo[]> {
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

/** Redact a stored custom-provider row for the client (key presence only). */
function toCustomProviderInfo(record: CustomProviderRecord): CustomProviderInfo {
  return {
    id: record.providerId,
    name: record.name,
    url: record.url,
    hasApiKey: Boolean(record.apiKey),
    models: record.models,
  };
}

/** The resolved custom-providers storage scope for a request. */
interface CustomProvidersContext {
  storage: CustomProvidersStorage;
  orgId: string;
  userId: string;
}

/**
 * Resolve the custom-providers context for a request, or a ready-to-return
 * error response. Same posture as memory settings: tenant rows in deployed
 * mode, a sentinel `local` org in no-auth mode — never settings.json.
 */
async function resolveCustomProvidersContext({
  c,
  auth,
  customProviders,
}: {
  c: Context;
  auth: RouteAuth;
  customProviders?: CustomProvidersStorage;
}): Promise<CustomProvidersContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (customProviders) {
    try {
      await customProviders.ensureReady();
      return tenant
        ? { storage: customProviders, orgId: tenantOrgId(tenant), userId: tenant.userId }
        : { storage: customProviders, orgId: 'local', userId: 'local' };
    } catch {
      // fall through to the unavailable response
    }
  }
  return {
    response: c.json(
      {
        error: 'custom_providers_unavailable',
        message: 'Custom provider storage is unavailable — the app database is not configured or failed to start.',
      },
      503,
    ),
  };
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
export async function buildProviderAccess({
  controller,
  authStorage,
  tenantCredentials,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
}): Promise<ProviderAccess> {
  const models = await controller.listAvailableModels();
  const hasModelKey = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (provider: string): ProviderAccessLevel => {
    const authProviderId = getAuthProviderId(provider);
    if (tenantCredentials) {
      const userRec = tenantCredentials.find(r => r.scope === 'user' && r.provider === authProviderId);
      const orgRec = tenantCredentials.find(r => r.scope === 'org' && r.provider === authProviderId);
      const credential = userRec?.credential ?? orgRec?.credential;
      if (credential?.type === 'oauth') return 'oauth';
      if (credential?.type === 'api_key' && credential.key.trim().length > 0) return 'apikey';
      return false;
    }

    const oauthCredential = authStorage?.get(authProviderId);
    if (oauthCredential?.type === 'oauth') return 'oauth';
    if (authStorage?.hasStoredApiKey(provider)) return 'apikey';
    const directCredential = authStorage?.get(provider);
    if (directCredential?.type === 'api_key' && directCredential.key.trim().length > 0) return 'apikey';
    return hasModelKey(provider) ? 'apikey' : false;
  };
  const access: ProviderAccess = {
    anthropic: accessLevel('anthropic'),
    openai: accessLevel('openai'),
    cerebras: accessLevel('cerebras'),
    google: accessLevel('google'),
    deepseek: accessLevel('deepseek'),
    'github-copilot': accessLevel('github-copilot'),
  };
  const seen = new Set(Object.keys(access));
  for (const m of models) {
    if (!seen.has(m.provider)) {
      access[m.provider] = accessLevel(m.provider);
      seen.add(m.provider);
    }
  }
  return access;
}

function canUseModelProvider(access: ProviderAccess, provider: string): boolean {
  return Boolean(access[provider]);
}

/**
 * Where a request's custom model packs live. Same posture as memory settings
 * and custom providers: the `model-packs` factory storage domain, scoped per
 * org in deployed mode and to a sentinel `local` org in no-auth mode — never
 * settings.json.
 */
export interface PackContext {
  storage: ModelPacksStorage;
  orgId: string;
  userId: string;
}

/** Resolve the pack context for a request, or a ready-to-return error response. */
async function resolvePackContext({
  c,
  auth,
  modelPacks,
}: {
  c: Context;
  auth: RouteAuth;
  modelPacks?: ModelPacksStorage;
}): Promise<PackContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (modelPacks) {
    try {
      await modelPacks.ensureReady();
      return tenant
        ? { storage: modelPacks, orgId: tenantOrgId(tenant), userId: tenant.userId }
        : { storage: modelPacks, orgId: 'local', userId: 'local' };
    } catch {
      // fall through to the unavailable response
    }
  }
  return {
    response: c.json(
      {
        error: 'model_packs_unavailable',
        message: 'Model pack storage is unavailable — the app database is not configured or failed to start.',
      },
      503,
    ),
  };
}

/** DB row → the `ModePack` shape the packs list and activation flow consume. */
function recordToModePack(record: ModelPackRecord): ModePack {
  return { id: `custom:${record.id}`, name: record.name, description: 'Saved custom pack', models: record.models };
}

/**
 * List available model packs (built-in, gated by provider access, plus saved
 * custom packs from the request's pack context). Drops the synthetic
 * "New Custom" placeholder — the web client has its own create flow. `active`
 * is set from the given session's thread when a resourceId is supplied.
 */
export async function listModelPacks({
  controller,
  authStorage,
  tenantCredentials,
  packContext,
  activePackId,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
  packContext: PackContext;
  activePackId?: string | null;
}): Promise<ModelPackInfo[]> {
  const access = await buildProviderAccess({ controller, authStorage, tenantCredentials });
  const packs = [
    ...getAvailableModePacks(access),
    ...(await packContext.storage.list({ orgId: packContext.orgId })).map(recordToModePack),
  ];
  return packs
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
async function applyPackToSession({
  controller,
  session,
  pack,
}: {
  controller: ModelCatalog;
  session: PackSession;
  pack: ModePack;
}): Promise<void> {
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

/**
 * Where a request's OM settings live: the `memory-settings` factory storage
 * domain, one row per (org, user). Without a tenant (auth disabled), settings
 * land on a sentinel `(local, local)` row in the same table — the web surface
 * never reads or writes `settings.json` for memory settings.
 */
interface MemorySettingsContext {
  storage: MemorySettingsStorage;
  orgId: string;
  userId: string;
}

/** Resolve the memory-settings context for a request, or a ready-to-return error response. */
async function resolveMemorySettingsContext({
  c,
  auth,
  memorySettings,
}: {
  c: Context;
  auth: RouteAuth;
  memorySettings?: MemorySettingsStorage;
}): Promise<MemorySettingsContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (memorySettings) {
    try {
      await memorySettings.ensureReady();
      return tenant
        ? { storage: memorySettings, orgId: tenantOrgId(tenant), userId: tenant.userId }
        : { storage: memorySettings, orgId: 'local', userId: 'local' };
    } catch {
      // fall through to the unavailable response
    }
  }
  return {
    response: c.json(
      {
        error: 'memory_settings_unavailable',
        message: 'Memory settings storage is unavailable — the app database is not configured or failed to start.',
      },
      503,
    ),
  };
}

/** Persist an OM knob change to the caller's memory-settings row. */
async function persistMemorySettings(
  context: MemorySettingsContext,
  patch: MemorySettingsPatch,
  fillIfUnset?: MemorySettingsFillIfUnset,
): Promise<void> {
  await context.storage.patch({ orgId: context.orgId, userId: context.userId, patch, fillIfUnset });
}

/**
 * Apply the stored memory-settings row onto the session, so the DB — not
 * whatever happens to sit in persisted session state (e.g. a stale boot-time
 * seed from before memory settings moved to the DB) — is what the web surface
 * reads and what the session's OM actually runs with. The row is authoritative:
 * knobs without a stored value reset to the built-in defaults.
 */
async function hydrateSessionMemorySettings(session: OMSession, record: MemorySettingsRecord | null): Promise<void> {
  for (const role of ['observer', 'reflector'] as const) {
    const stored = role === 'observer' ? record?.observerModelId : record?.reflectorModelId;
    const target = stored ?? DEFAULT_OM_MODEL_ID;
    if (session.om[role].modelId() !== target) {
      await session.om[role].switchModel({ modelId: target });
    }
  }
  const state = session.state.get() ?? {};
  const updates: OMStateWrites = {};
  const observationThreshold = record?.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD;
  if (state.observationThreshold !== observationThreshold) {
    updates.observationThreshold = observationThreshold;
  }
  const reflectionThreshold = record?.reflectionThreshold ?? DEFAULT_REFLECTION_THRESHOLD;
  if (state.reflectionThreshold !== reflectionThreshold) {
    updates.reflectionThreshold = reflectionThreshold;
  }
  const observeAttachments = record?.observeAttachments ?? 'auto';
  if ((state.observeAttachments ?? 'auto') !== observeAttachments) {
    updates.observeAttachments = observeAttachments;
  }
  if (Object.keys(updates).length > 0) await session.state.set(updates);
}

/** Dependencies injected into {@link ConfigRoutes}. */
export interface ConfigRoutesDeps extends RouteDependencies {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Tenant model-packs domain handle; absent in local (no-DB) mode. */
  modelPacks?: ModelPacksStorage;
  /** Tenant memory-settings domain handle; absent in local (no-DB) mode. */
  memorySettings?: MemorySettingsStorage;
  /** Custom-providers domain handle; absent when the app database is missing. */
  customProviders?: CustomProvidersStorage;
  /** Notifies the host after tenant credentials change so caches can be dropped. */
  onCredentialsChanged?: (tenant: { orgId: string; userId?: string }) => void;
  /** Notifies the host after custom providers change so model-router caches can be dropped. */
  onCustomProvidersChanged?: (tenant: { orgId: string }) => void;
}

/**
 * The web config routes as Mastra `apiRoutes`:
 *   - `GET    /web/config/providers`              — list providers + key source
 *   - `PUT    /web/config/providers/:provider/key` — set/update a provider's API key
 *   - `DELETE /web/config/providers/:provider/key` — remove a stored API key
 *   - `GET    /web/config/models`                  — list available models (credentialed providers)
 *   - `GET    /web/config/custom-providers`        — list custom OpenAI-compatible providers
 *   - `POST   /web/config/custom-providers`        — create/update a custom provider
 *   - `DELETE /web/config/custom-providers/:id`    — remove a custom provider
 *   - `GET    /web/config/om`                      — read OM models/thresholds/observe-attachments
 *   - `PUT    /web/config/om/:role/model`          — switch observer/reflector model
 *   - `PUT    /web/config/om/thresholds`           — set observation/reflection thresholds
 *   - `PUT    /web/config/om/observe-attachments`  — set observe-attachments (auto/on/off)
 */
export class ConfigRoutes extends Route<ConfigRoutesDeps> {
  routes(): ApiRoute[] {
    const options = this.deps;
    const { controller, authStorage, auth } = options;
    const onCredentialsChanged = options.onCredentialsChanged ?? (() => {});
    const onCustomProvidersChanged = options.onCustomProvidersChanged ?? (() => {});

    return [
      registerApiRoute('/web/config/providers', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          try {
            // Tenant mode lists the caller's rows and never exposes the
            // server-global auth.json; local mode is unchanged.
            const tenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            return c.json({
              providers: await listProviders({
                controller,
                authStorage: tenantCredentials ? undefined : authStorage,
                tenantCredentials,
              }),
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
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: options.modelCredentials });
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
              if (scope === 'org' && !(await auth.isOrganizationAdmin(loose(c), ctx.orgId))) {
                return c.json({ error: 'organization_admin_required' }, 403);
              }
              const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
              // envVar is intentionally ignored: tenant credentials are resolved
              // per-request, never written into process.env.
              await ctx.storage.setCredential(tenant, getAuthProviderId(provider), { type: 'api_key', key });
              onCredentialsChanged(tenant);
              const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
              const providers = await listProviders({ controller, tenantCredentials: records });
              return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
            }
            if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
            // Local mode is single-user: scope is meaningless and ignored.
            authStorage.setStoredApiKey(provider, key, envVar);
            const providers = await listProviders({ controller, authStorage });
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
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: options.modelCredentials });
          if ('response' in ctx) return ctx.response;

          const provider = c.req.param('provider');
          const scope = c.req.query('scope') === 'org' ? 'org' : 'user';
          try {
            if (ctx.mode === 'tenant') {
              if (scope === 'org' && !(await auth.isOrganizationAdmin(loose(c), ctx.orgId))) {
                return c.json({ error: 'organization_admin_required' }, 403);
              }
              const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
              await ctx.storage.removeCredential(tenant, getAuthProviderId(provider));
              onCredentialsChanged(tenant);
              const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
              const providers = await listProviders({ controller, tenantCredentials: records });
              return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
            }
            if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
            authStorage.remove(`apikey:${provider}`);
            const providers = await listProviders({ controller, authStorage });
            return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Custom providers (OpenAI-compatible endpoints) ──────────────────────
      // Mirrors the TUI's /custom-providers command, but backed by the
      // `custom-providers` domain (org rows in tenant mode, a sentinel `local`
      // org in no-auth mode) — the server never reads settings.json for these.

      registerApiRoute('/web/config/custom-providers', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCustomProvidersContext({
            c: loose(c),
            auth,
            customProviders: options.customProviders,
          });
          if ('response' in ctx) return ctx.response;
          try {
            const records = await ctx.storage.list({ orgId: ctx.orgId });
            return c.json({ providers: records.map(toCustomProviderInfo) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/custom-providers', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCustomProvidersContext({
            c: loose(c),
            auth,
            customProviders: options.customProviders,
          });
          if ('response' in ctx) return ctx.response;
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
            const record = await ctx.storage.upsert({
              orgId: ctx.orgId,
              userId: ctx.userId,
              input: {
                providerId: getCustomProviderId(parsed.name),
                name: parsed.name,
                url: parsed.url,
                apiKey: parsed.apiKey,
                models: parsed.models,
              },
              previousProviderId: previousId,
            });
            onCustomProvidersChanged({ orgId: ctx.orgId });
            return c.json({ ok: true, provider: toCustomProviderInfo(record) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/custom-providers/:id', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCustomProvidersContext({
            c: loose(c),
            auth,
            customProviders: options.customProviders,
          });
          if ('response' in ctx) return ctx.response;
          const id = c.req.param('id');
          try {
            await ctx.storage.delete({ orgId: ctx.orgId, providerId: id });
            onCustomProvidersChanged({ orgId: ctx.orgId });
            return c.json({ ok: true });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Available models ────────────────────────────────────────────────────
      // Session-independent model catalog for settings pickers (Factory default
      // model, pack editors). Only models whose provider has a credential are
      // returned — the same filter the session-scoped hook applies client-side.

      registerApiRoute('/web/config/models', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          try {
            const tenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            const [models, access] = await Promise.all([
              controller.listAvailableModels(),
              buildProviderAccess({
                controller,
                authStorage: tenantCredentials ? undefined : authStorage,
                tenantCredentials,
              }),
            ]);
            const catalog = models
              .filter(m => canUseModelProvider(access, m.provider) && typeof m.id === 'string')
              .map(m => ({ id: m.id!, provider: m.provider, modelName: m.modelName, hasApiKey: true }));
            // Append the caller's custom provider models (DB-backed, org rows in
            // tenant mode / sentinel `local` org in no-auth mode). The boot-time
            // gateway catalog only carries the local list, so tenant callers get
            // theirs here. Dedupe against ids already present.
            if (options.customProviders) {
              try {
                const ctx = await resolveCustomProvidersContext({
                  c: loose(c),
                  auth,
                  customProviders: options.customProviders,
                });
                if (!('response' in ctx)) {
                  const known = new Set(catalog.map(m => m.id));
                  for (const record of await ctx.storage.list({ orgId: ctx.orgId })) {
                    for (const model of record.models) {
                      const id = `${record.providerId}/${model}`;
                      if (known.has(id)) continue;
                      known.add(id);
                      catalog.push({ id, provider: record.providerId, modelName: model, hasApiKey: true });
                    }
                  }
                }
              } catch {
                // Fail soft: the catalog still serves the built-in models.
              }
            }
            return c.json({
              models: catalog.sort((a, b) =>
                a.provider === b.provider ? a.id.localeCompare(b.id) : a.provider.localeCompare(b.provider),
              ),
            });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Model packs ─────────────────────────────────────────────────────────
      // Mirrors the TUI's /models-pack command. Custom-pack CRUD lives in the
      // model-packs storage domain (org-scoped, sentinel `local` org in no-auth
      // mode — never settings.json); activation is session-scoped and resolves
      // the session from the controller registry by resourceId.

      registerApiRoute('/web/config/model-packs', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
          const resourceId = c.req.query('resourceId');
          const scope = c.req.query('scope') || undefined;
          try {
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const activePackId = await resolveActivePackId(session);
            const tenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            return c.json({
              packs: await listModelPacks({
                controller,
                authStorage: tenantCredentials ? undefined : authStorage,
                tenantCredentials,
                packContext,
                activePackId,
              }),
              activePackId,
            });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/model-packs', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
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
            const record = await packContext.storage.upsert({
              orgId: packContext.orgId,
              userId: packContext.userId,
              input: { name, models: { build, plan, fast } },
            });
            return c.json({ ok: true, pack: recordToModePack(record) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/model-packs/:id', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
          const id = decodeURIComponent(c.req.param('id'));
          try {
            const recordId = id.startsWith('custom:') ? id.slice('custom:'.length) : id;
            const deleted = await packContext.storage.delete({ orgId: packContext.orgId, id: recordId });
            return deleted ? c.json({ ok: true }) : c.json({ error: `Unknown pack "${id}"` }, 404);
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/model-packs/:id/activate', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
          const id = decodeURIComponent(c.req.param('id'));
          let body: { resourceId?: unknown; scope?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
          try {
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            const tenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            const packs = await listModelPacks({
              controller,
              authStorage: tenantCredentials ? undefined : authStorage,
              tenantCredentials,
              packContext,
            });
            const pack = packs.find(p => p.id === id);
            if (!pack) return c.json({ error: `Unknown pack "${id}"` }, 404);
            await applyPackToSession({ controller, session, pack });
            return c.json({ ok: true, activePackId: pack.id });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Observational memory ──────────────────────────────────────────────────
      // Mirrors the TUI's /om command. All five knobs are session-scoped (resolved
      // from the session, persisted to its state + thread setting) and durably
      // stored in the per-(org, user) `memory-settings` app table — never
      // settings.json. GET hydrates the session from the stored row first so the
      // DB, not the SDK's boot-time seed, is the source of truth.

      registerApiRoute('/web/config/om', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resourceId = c.req.query('resourceId');
          const scope = c.req.query('scope') || undefined;
          if (!resourceId) return c.json({ error: 'Missing required query param: resourceId' }, 400);
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
          });
          if ('response' in context) return context.response;
          try {
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            await hydrateSessionMemorySettings(session, record);
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
          let body: { resourceId?: unknown; modelId?: unknown; scope?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
          if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
          if (!modelId) return c.json({ error: 'Missing required field: modelId' }, 400);
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
          });
          if ('response' in context) return context.response;
          try {
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            const otherRole = role === 'observer' ? session.om.reflector : session.om.observer;
            const otherRoleCurrentModelId = otherRole.modelId() ?? null;
            await session.om[role].switchModel({ modelId });
            // Pin the other role's current model too, so a later restart
            // doesn't drift it once this role is explicitly overridden. The
            // "only if still unset" check runs inside the storage layer's
            // atomic update, so a concurrent explicit switch of the other
            // role is never clobbered by this fill.
            const otherKey = role === 'observer' ? 'reflectorModelId' : 'observerModelId';
            await persistMemorySettings(
              context,
              { [role === 'observer' ? 'observerModelId' : 'reflectorModelId']: modelId },
              otherRoleCurrentModelId ? { [otherKey]: otherRoleCurrentModelId } : undefined,
            );
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
          let body: {
            resourceId?: unknown;
            observationThreshold?: unknown;
            reflectionThreshold?: unknown;
            scope?: unknown;
          };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
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
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
          });
          if ('response' in context) return context.response;
          try {
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            if (observation !== undefined) {
              await session.state.set({ observationThreshold: observation });
              await session.thread.setSetting({ key: 'observationThreshold', value: observation });
            }
            if (reflection !== undefined) {
              await session.state.set({ reflectionThreshold: reflection });
              await session.thread.setSetting({ key: 'reflectionThreshold', value: reflection });
            }
            await persistMemorySettings(context, {
              ...(observation !== undefined ? { observationThreshold: observation } : {}),
              ...(reflection !== undefined ? { reflectionThreshold: reflection } : {}),
            });
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
          let body: { resourceId?: unknown; value?: unknown; scope?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          if (!resourceId) return c.json({ error: 'Missing required field: resourceId' }, 400);
          const raw = body.value;
          const value: 'auto' | boolean = raw === 'auto' || raw === true || raw === false ? raw : 'auto';
          if (raw !== 'auto' && raw !== true && raw !== false) {
            return c.json({ error: "value must be 'auto', true, or false" }, 400);
          }
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
          });
          if ('response' in context) return context.response;
          try {
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            await session.state.set({ observeAttachments: value });
            await session.thread.setSetting({ key: 'observeAttachments', value });
            await persistMemorySettings(context, { observeAttachments: value });
            return c.json({ ok: true, config: readOMConfig(session) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),
    ];
  }
}
