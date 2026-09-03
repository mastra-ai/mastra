import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { getAvailableModePacks, resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';
import type { ModePack, ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import {
  getCustomProviderId,
  isThinkingLevelSetting,
  loadSettings,
  saveSettings,
  THINKING_LEVEL_VALUES,
} from '@mastra/code-sdk/onboarding/settings';
import type { CustomProviderSetting, ThinkingLevelSetting } from '@mastra/code-sdk/onboarding/settings';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { Context } from 'hono';
import { peekSessionSandbox } from '../sandbox/session-sandbox.js';
import {
  applyStoredMemorySettings,
  DEFAULT_OBSERVATION_THRESHOLD,
  DEFAULT_REFLECTION_THRESHOLD,
} from '../session/memory-settings-hydration.js';
import { applyActiveModelPack } from '../session/model-pack-hydration.js';
import type {
  CredentialRecord,
  LoginSessionKind,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import type { CustomProviderRecord, CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import { factoryMemorySettingsUserId } from '../storage/domains/memory-settings/base.js';
import type {
  MemorySettingsFillIfUnset,
  MemorySettingsPatch,
  MemorySettingsRecord,
  MemorySettingsStorage,
} from '../storage/domains/memory-settings/base.js';
import type { ModelPackRecord, ModelPacksStorage } from '../storage/domains/model-packs/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { seedPersonalOmDefaults } from './om-seed.js';
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
  | 'oauth'
  | 'stored'
  | 'env'
  | 'none'
  | 'oauth-user'
  | 'oauth-org'
  | 'stored-user'
  | 'stored-org';

/** A model provider with the current source of its credentials. */
export interface ProviderInfo {
  provider: string;
  /** Env var the provider's key is read from, if any. */
  envVar?: string;
  /** Where the active credential comes from. */
  source: ProviderCredentialSource;
  /**
   * Tenant mode: whether an org-wide API key exists for this provider, even
   * when the caller's personal credential shadows it. Lets the UI tell
   * "shared with the org" apart from "only works for me".
   */
  orgKey?: boolean;
  /**
   * Tenant mode: the caller's personal credential for this provider, if any.
   * Reported independently of `source` so the UI can manage each scope even
   * when one shadows the other.
   */
  userCredential?: 'oauth' | 'api_key';
  /** Tenant mode: the shared org credential for this provider, if any. */
  orgCredential?: 'oauth' | 'api_key';
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
    getSetting: (args: { key: string }) => Promise<unknown>;
    setSetting: (args: { key: string; value: unknown }) => Promise<void>;
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
    let orgKey: boolean | undefined;
    let userCredential: ProviderInfo['userCredential'];
    let orgCredential: ProviderInfo['orgCredential'];
    if (tenantCredentials) {
      const userRec = tenantCredentials.find(r => r.scope === 'user' && r.provider === authProviderId);
      const orgRec = tenantCredentials.find(r => r.scope === 'org' && r.provider === authProviderId);
      // Any shared org credential (API key or org-wide OAuth) counts.
      orgKey = orgRec !== undefined;
      userCredential = userRec?.credential.type;
      orgCredential = orgRec?.credential.type;
      if (userRec?.credential.type === 'oauth') {
        source = 'oauth-user';
      } else if (userRec?.credential.type === 'api_key') {
        source = 'stored-user';
      } else if (orgRec?.credential.type === 'oauth') {
        source = 'oauth-org';
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
      ...(orgKey !== undefined ? { orgKey } : {}),
      ...(userCredential ? { userCredential } : {}),
      ...(orgCredential ? { orgCredential } : {}),
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

async function authorizePackSession({
  c,
  auth,
  sessions,
  packContext,
  resourceId,
  scope,
}: {
  c: Context;
  auth: RouteAuth;
  sessions?: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  packContext: PackContext;
  resourceId: string;
  scope: string | undefined;
}): Promise<Response | null> {
  if (!auth.enabled()) return null;
  if (!sessions) return c.json({ error: 'session_authorization_unavailable' }, 503);

  const sourceSession = await sessions.getBySessionId(resourceId);
  // Scope matches against the live memoized workdir ONLY (the deterministic
  // truth). The persisted column is observability, never an authorization
  // input — a row written under a previous provider could authorize a stale
  // scope. No live memo entry means no scoped grant (fail closed).
  const liveWorkdir = peekSessionSandbox(sourceSession?.id ?? '')?.workdir;
  if (
    !sourceSession ||
    sourceSession.orgId !== packContext.orgId ||
    sourceSession.userId !== packContext.userId ||
    (scope !== undefined && scope !== liveWorkdir)
  ) {
    return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
  }
  return null;
}

/** DB row → the `ModePack` shape the packs list and activation flow consume. */
function recordToModePack(record: ModelPackRecord): ModePack {
  return { id: `custom:${record.id}`, name: record.name, description: 'Saved custom pack', models: record.models };
}

/**
 * List available model packs (built-in, gated by provider access, plus saved
 * custom packs from the request's pack context). Drops the synthetic
 * "New Custom" placeholder because the web client has its own create flow.
 * `active` marks the user's default pack for new interactive chats.
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

async function resolveSessionModelPackId(session: PackSession | undefined): Promise<string | null> {
  if (!session?.thread.getId()) return null;
  const value = await session.thread.getSetting({ key: 'activeModelPackId' });
  return typeof value === 'string' ? value : null;
}

// ── Observational memory ────────────────────────────────────────────────────
// Mirrors the TUI `/om` command. Settings are persisted per organization and
// user in the Factory app database. Requests with an active session also apply
// changes immediately to that session's state and thread settings.

/** Read the current OM config from a session. */
export interface OMConfigInfo {
  observerModelId: string;
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
  observeAttachments: 'auto' | boolean;
}

export interface ProviderOMDefaultsResponse {
  ok: true;
  config: OMConfigInfo;
}

/** `GET /web/config/thinking` — deployment-scoped reasoning-effort defaults. */
export interface ThinkingConfigInfo {
  /** All selectable levels, in escalation order. */
  levels: readonly ThinkingLevelSetting[];
  /** `preferences.thinkingLevel` — fallback when a mode has no default. */
  globalDefault: ThinkingLevelSetting;
  /** `models.modeThinkingDefaults` — per-mode overrides of the global default. */
  modeDefaults: Record<string, ThinkingLevelSetting>;
  /** Mode ids known to the controller (for rendering per-mode rows). */
  modes: string[];
}

/** `PUT /web/config/thinking` success payload. */
export interface UpdateThinkingConfigResponse {
  ok: true;
  globalDefault: ThinkingLevelSetting;
  modeDefaults: Record<string, ThinkingLevelSetting>;
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

function readStoredOMConfig(record: MemorySettingsRecord | null, fallbackOmModelId?: string): OMConfigInfo {
  const fallback = fallbackOmModelId ?? DEFAULT_OM_MODEL_ID;
  return {
    observerModelId: record?.observerModelId ?? fallback,
    reflectorModelId: record?.reflectorModelId ?? fallback,
    observationThreshold: record?.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD,
    reflectionThreshold: record?.reflectionThreshold ?? DEFAULT_REFLECTION_THRESHOLD,
    observeAttachments: record?.observeAttachments ?? 'auto',
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

/**
 * Resolve the memory-settings context for a request, or a ready-to-return
 * error response. When `factoryProjectId` is provided the row addressed is the
 * factory project's shared settings (a sentinel user id in the caller's org)
 * instead of the caller's personal row — this is what factory board runs and
 * channel sessions hydrate from.
 */
async function resolveMemorySettingsContext({
  c,
  auth,
  memorySettings,
  factoryProjectId,
  factoryProjects,
}: {
  c: Context;
  auth: RouteAuth;
  memorySettings?: MemorySettingsStorage;
  factoryProjectId?: string;
  factoryProjects?: FactoryProjectsStorage;
}): Promise<MemorySettingsContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  // Factory-scoped rows are shared org state: the target project must exist in
  // the caller's org before its settings row can be read or written.
  if (factoryProjectId && tenant) {
    if (!factoryProjects) return { response: c.json({ error: 'factory_unavailable' }, 503) };
    try {
      await factoryProjects.ensureReady();
      const project = await factoryProjects.get({ orgId: tenantOrgId(tenant), id: factoryProjectId });
      if (!project) return { response: c.json({ error: 'factory_project_not_found' }, 404) };
    } catch {
      return { response: c.json({ error: 'factory_unavailable' }, 503) };
    }
  }
  if (memorySettings) {
    try {
      await memorySettings.ensureReady();
      const factoryUserId = factoryProjectId ? factoryMemorySettingsUserId(factoryProjectId) : undefined;
      return tenant
        ? { storage: memorySettings, orgId: tenantOrgId(tenant), userId: factoryUserId ?? tenant.userId }
        : { storage: memorySettings, orgId: 'local', userId: factoryUserId ?? 'local' };
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

/** Dependencies injected into {@link ConfigRoutes}. */
export interface ConfigRoutesDeps extends RouteDependencies {
  controller: ModelCatalog;
  features?: { knowledge: boolean };
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Tenant model-packs domain handle; absent in local (no-DB) mode. */
  modelPacks?: ModelPacksStorage;
  /** Source-control sessions used to authorize session-scoped model-pack access. */
  sourceControlSessions?: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  /** Tenant memory-settings domain handle; absent in local (no-DB) mode. */
  memorySettings?: MemorySettingsStorage;
  /** Factory projects domain, used to derive OM fallbacks from a factory's default model. */
  factoryProjects?: FactoryProjectsStorage;
  /** Custom-providers domain handle; absent when the app database is missing. */
  customProviders?: CustomProvidersStorage;
  /** Notifies the host after tenant credentials change so caches can be dropped. */
  onCredentialsChanged?: (tenant: { orgId: string; userId?: string }) => void;
  /** Notifies the host after custom providers change so model-router caches can be dropped. */
  onCustomProvidersChanged?: (tenant: { orgId: string }) => void;
  /**
   * Path of the server's settings.json backing the deployment-scoped thinking
   * defaults. Defaults to the standard app-data location; injectable for tests.
   */
  settingsPath?: string;
}

/**
 * The web config routes as Mastra `apiRoutes`:
 *   - `GET    /web/config/features`               — list server-enabled product features
 *   - `GET    /web/config/providers`              — list providers + key source
 *   - `PUT    /web/config/providers/:provider/key` — set/update a provider's API key
 *   - `DELETE /web/config/providers/:provider/key` — remove a stored API key
 *   - `GET    /web/config/models`                  — list available models (credentialed providers)
 *   - `GET    /web/config/custom-providers`        — list custom OpenAI-compatible providers
 *   - `POST   /web/config/custom-providers`        — create/update a custom provider
 *   - `DELETE /web/config/custom-providers/:id`    — remove a custom provider
 *   - `GET    /web/config/thinking`                — read thinking (reasoning-effort) defaults
 *   - `PUT    /web/config/thinking`                — set global/per-mode thinking defaults
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

    // Factory-scoped OM reads without a stored row fall back to the low-cost
    // OM model of the factory default model's provider — not the global
    // built-in default, whose provider may have no credential here.
    const factoryOmFallback = async (factoryProjectId: string | undefined): Promise<string | undefined> => {
      if (!factoryProjectId || !options.factoryProjects) return undefined;
      try {
        const project = await options.factoryProjects.getById({ id: factoryProjectId });
        const defaultModelId = project?.defaultModelId ?? undefined;
        const provider = defaultModelId?.split('/')[0];
        return provider ? resolveProviderOMDefault(provider, defaultModelId).modelId : undefined;
      } catch {
        return undefined;
      }
    };

    return [
      registerApiRoute('/web/config/features', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => c.json({ knowledge: options.features?.knowledge ?? false }),
      }),

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
            // Tenant mode also reports whether the caller may write org-wide
            // keys, so the settings UI can gate the "Everyone in org" option.
            const tenant = auth.tenant(loose(c));
            const orgKeyAdmin = tenant ? await auth.isOrganizationAdmin(loose(c), tenantOrgId(tenant)) : undefined;
            return c.json({
              providers: await listProviders({
                controller,
                authStorage: tenantCredentials ? undefined : authStorage,
                tenantCredentials,
              }),
              ...(orgKeyAdmin !== undefined ? { orgKeyAdmin } : {}),
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
              await seedPersonalOmDefaults({ memorySettings: options.memorySettings, tenant, provider });
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
      // Custom pack definitions are organization-scoped. Each user can choose a
      // default for new interactive chats, while a thread-specific activation
      // takes precedence. Factory work sessions use the project default model.

      registerApiRoute('/web/config/model-packs', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
          const resourceId = c.req.query('resourceId');
          const scope = c.req.query('scope') || undefined;
          try {
            const activePack = await packContext.storage.getActive({
              orgId: packContext.orgId,
              userId: packContext.userId,
            });
            const activePackId = activePack?.packId ?? null;
            if (resourceId) {
              const unauthorized = await authorizePackSession({
                c: loose(c),
                auth,
                sessions: options.sourceControlSessions,
                packContext,
                resourceId,
                scope,
              });
              if (unauthorized) return unauthorized;
            }
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const sessionPackId = await resolveSessionModelPackId(session);
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
              sessionPackId,
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

      registerApiRoute('/web/config/model-packs/active', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const packContext = await resolvePackContext({ c: loose(c), auth, modelPacks: options.modelPacks });
          if ('response' in packContext) return packContext.response;
          try {
            await packContext.storage.clearActive({ orgId: packContext.orgId, userId: packContext.userId });
            return c.json({ ok: true, activePackId: null });
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
          let body: { resourceId?: unknown; scope?: unknown; target?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const target = body.target ?? 'default';
          if (target !== 'default' && target !== 'session') {
            return c.json({ error: 'target must be "default" or "session"' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' && body.resourceId ? body.resourceId : undefined;
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          if (target === 'session' && !resourceId) {
            return c.json({ error: 'Missing required field for session activation: resourceId' }, 400);
          }
          try {
            if (target === 'session' && resourceId) {
              const unauthorized = await authorizePackSession({
                c: loose(c),
                auth,
                sessions: options.sourceControlSessions,
                packContext,
                resourceId,
                scope,
              });
              if (unauthorized) return unauthorized;
            }
            const session =
              target === 'session' && resourceId
                ? await controller.getSessionByResource?.(resourceId, scope)
                : undefined;
            if (target === 'session' && !session) {
              return c.json({ error: `No session for resourceId "${resourceId}"` }, 404);
            }
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
            if (target === 'default') {
              await packContext.storage.setActive({
                orgId: packContext.orgId,
                userId: packContext.userId,
                packId: pack.id,
                models: pack.models,
              });
              return c.json({ ok: true, target, activePackId: pack.id });
            }
            if (session) {
              await applyActiveModelPack(session, { packId: pack.id, models: pack.models });
            }
            return c.json({ ok: true, target, sessionPackId: pack.id });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Thinking (reasoning-effort) defaults ─────────────────────────────────
      // Deployment-scoped defaults stored in the server's settings.json: the
      // global `preferences.thinkingLevel` plus per-mode
      // `models.modeThinkingDefaults`. These are what request-time resolution
      // falls back to when a session carries no explicit override — including
      // automated (rule-driven) Factory runs nobody opens interactively. In
      // tenant mode, writes are disabled because the settings file is shared
      // deployment-wide rather than scoped to an organization.

      registerApiRoute('/web/config/thinking', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          try {
            const settings = loadSettings(options.settingsPath);
            const modes = controller.listModes?.().map(mode => mode.id) ?? [];
            return c.json({
              levels: THINKING_LEVEL_VALUES,
              globalDefault: settings.preferences.thinkingLevel,
              modeDefaults: settings.models.modeThinkingDefaults,
              modes,
            });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/thinking', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          if (auth.enabled()) {
            return c.json({ error: 'Deployment thinking defaults can only be changed in local mode' }, 403);
          }
          let body: { globalDefault?: unknown; modeDefaults?: unknown };
          try {
            const parsed: unknown = await c.req.json();
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              return c.json({ error: 'Request body must be a JSON object' }, 400);
            }
            body = parsed as { globalDefault?: unknown; modeDefaults?: unknown };
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          if (body.globalDefault === undefined && body.modeDefaults === undefined) {
            return c.json({ error: 'Provide globalDefault and/or modeDefaults' }, 400);
          }
          if (body.globalDefault !== undefined && !isThinkingLevelSetting(body.globalDefault)) {
            return c.json(
              { error: `Invalid globalDefault — expected one of: ${THINKING_LEVEL_VALUES.join(', ')}` },
              400,
            );
          }
          // Per-mode patch semantics: a valid level sets the mode's default,
          // `null` clears it (back to the global default).
          const modePatch: Record<string, ThinkingLevelSetting | null> = {};
          if (body.modeDefaults !== undefined) {
            if (!body.modeDefaults || typeof body.modeDefaults !== 'object' || Array.isArray(body.modeDefaults)) {
              return c.json({ error: 'modeDefaults must be an object of mode → level (or null to clear)' }, 400);
            }
            const knownModes = new Set(controller.listModes?.().map(mode => mode.id) ?? []);
            for (const [mode, level] of Object.entries(body.modeDefaults as Record<string, unknown>)) {
              if (!knownModes.has(mode)) {
                return c.json({ error: `Unknown mode "${mode}"` }, 400);
              }
              if (level === null) {
                modePatch[mode] = null;
              } else if (isThinkingLevelSetting(level)) {
                modePatch[mode] = level;
              } else {
                return c.json(
                  { error: `Invalid level for mode "${mode}" — expected one of: ${THINKING_LEVEL_VALUES.join(', ')}` },
                  400,
                );
              }
            }
          }
          try {
            const settings = loadSettings(options.settingsPath);
            if (body.globalDefault !== undefined && isThinkingLevelSetting(body.globalDefault)) {
              settings.preferences.thinkingLevel = body.globalDefault;
            }
            for (const [mode, level] of Object.entries(modePatch)) {
              if (level === null) delete settings.models.modeThinkingDefaults[mode];
              else settings.models.modeThinkingDefaults[mode] = level;
            }
            saveSettings(settings, options.settingsPath);
            return c.json({
              ok: true,
              globalDefault: settings.preferences.thinkingLevel,
              modeDefaults: settings.models.modeThinkingDefaults,
            });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/om/provider-defaults', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          let body: { providerId?: unknown; factoryModelId?: unknown; factoryId?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
          const factoryModelId = typeof body.factoryModelId === 'string' ? body.factoryModelId.trim() : '';
          const factoryProjectId = typeof body.factoryId === 'string' && body.factoryId ? body.factoryId : undefined;
          if (!providerId) return c.json({ error: 'Missing required field: providerId' }, 400);

          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;

          try {
            const tenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            const access = await buildProviderAccess({
              controller,
              authStorage: tenantCredentials ? undefined : authStorage,
              tenantCredentials,
            });
            if (!access[providerId]) return c.json({ error: `Provider "${providerId}" is not configured` }, 400);

            const modelId = resolveProviderOMDefault(providerId, factoryModelId).modelId;
            const record = await context.storage.patch({
              orgId: context.orgId,
              userId: context.userId,
              patch: {},
              fillIfUnset: { observerModelId: modelId, reflectorModelId: modelId },
            });
            return c.json({ ok: true, config: readStoredOMConfig(record) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Observational memory ──────────────────────────────────────────────────
      // Mirrors the TUI's /om command. All five knobs are durably stored in the
      // per-(org, user) `memory-settings` app table — never settings.json. When a
      // session is supplied, changes are also applied to its state and thread.

      registerApiRoute('/web/config/om', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resourceId = c.req.query('resourceId');
          const scope = c.req.query('scope') || undefined;
          const factoryProjectId = c.req.query('factoryId') || undefined;
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          try {
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const fallback = await factoryOmFallback(factoryProjectId);
            if (!resourceId) return c.json({ config: readStoredOMConfig(record, fallback) });

            // Session sync is best-effort: the stored row is authoritative and
            // new sessions hydrate from it, so a resourceId without a live
            // session (e.g. settings page after a restart) still reads the
            // stored config instead of failing.
            const session = await controller.getSessionByResource?.(resourceId, scope);
            if (!session) return c.json({ config: readStoredOMConfig(record, fallback) });
            await applyStoredMemorySettings(session, record, fallback);
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
          let body: { resourceId?: unknown; modelId?: unknown; scope?: unknown; factoryId?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          const factoryProjectId = typeof body.factoryId === 'string' && body.factoryId ? body.factoryId : undefined;
          const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
          if (!modelId) return c.json({ error: 'Missing required field: modelId' }, 400);
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          try {
            // Best-effort session sync: persist regardless, apply to the live
            // session only when one exists for the resourceId.
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const otherRole = session ? (role === 'observer' ? session.om.reflector : session.om.observer) : undefined;
            const otherRoleCurrentModelId = otherRole?.modelId() ?? null;
            await session?.om[role].switchModel({ modelId });
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
            const config = session
              ? readOMConfig(session)
              : readStoredOMConfig(
                  await context.storage.get({ orgId: context.orgId, userId: context.userId }),
                  await factoryOmFallback(factoryProjectId),
                );
            return c.json({ ok: true, config });
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
            factoryId?: unknown;
          };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          const factoryProjectId = typeof body.factoryId === 'string' && body.factoryId ? body.factoryId : undefined;
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
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          try {
            // Best-effort session sync: persist regardless, apply to the live
            // session only when one exists for the resourceId.
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            if (observation !== undefined && session) {
              await session.state.set({ observationThreshold: observation });
              await session.thread.setSetting({ key: 'observationThreshold', value: observation });
            }
            if (reflection !== undefined && session) {
              await session.state.set({ reflectionThreshold: reflection });
              await session.thread.setSetting({ key: 'reflectionThreshold', value: reflection });
            }
            await persistMemorySettings(context, {
              ...(observation !== undefined ? { observationThreshold: observation } : {}),
              ...(reflection !== undefined ? { reflectionThreshold: reflection } : {}),
            });
            const config = session
              ? readOMConfig(session)
              : readStoredOMConfig(
                  await context.storage.get({ orgId: context.orgId, userId: context.userId }),
                  await factoryOmFallback(factoryProjectId),
                );
            return c.json({ ok: true, config });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/om/observe-attachments', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          let body: { resourceId?: unknown; value?: unknown; scope?: unknown; factoryId?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
          const scope = typeof body.scope === 'string' && body.scope ? body.scope : undefined;
          const factoryProjectId = typeof body.factoryId === 'string' && body.factoryId ? body.factoryId : undefined;
          const raw = body.value;
          const value: 'auto' | boolean = raw === 'auto' || raw === true || raw === false ? raw : 'auto';
          if (raw !== 'auto' && raw !== true && raw !== false) {
            return c.json({ error: "value must be 'auto', true, or false" }, 400);
          }
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          try {
            // Best-effort session sync: persist regardless, apply to the live
            // session only when one exists for the resourceId.
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            if (session) {
              await session.state.set({ observeAttachments: value });
              await session.thread.setSetting({ key: 'observeAttachments', value });
            }
            await persistMemorySettings(context, { observeAttachments: value });
            const config = session
              ? readOMConfig(session)
              : readStoredOMConfig(
                  await context.storage.get({ orgId: context.orgId, userId: context.userId }),
                  await factoryOmFallback(factoryProjectId),
                );
            return c.json({ ok: true, config });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),
    ];
  }
}
