import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { resolveAutoOMModelId } from '@mastra/code-sdk/onboarding/packs';
import type { ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import {
  getCustomProviderId,
  isThinkingLevelSetting,
  loadSettings,
  saveSettings,
  THINKING_LEVEL_VALUES,
} from '@mastra/code-sdk/onboarding/settings';
import type { CustomProviderSetting, ThinkingLevelSetting } from '@mastra/code-sdk/onboarding/settings';
import { AMAZON_BEDROCK_GATEWAY_ID } from '@mastra/code-sdk/providers/amazon-bedrock-gateway';
import { getModelReasoningOptions } from '@mastra/core/llm';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { Context } from 'hono';
import { z } from 'zod';
import { DEFAULT_OBSERVATION_THRESHOLD, DEFAULT_REFLECTION_THRESHOLD } from '../session/memory-settings-hydration.js';
import type {
  CredentialRecord,
  LoginSessionKind,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import type { CustomProviderRecord, CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import { factoryMemorySettingsUserId } from '../storage/domains/memory-settings/base.js';
import type {
  MemorySettingsPatch,
  MemorySettingsRecord,
  MemorySettingsStorage,
} from '../storage/domains/memory-settings/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
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
 * `deployment` (tenant mode) marks a provider the operator opted in to run on
 * the server process's own credentials (e.g. Amazon Bedrock's AWS chain).
 */
export type ProviderCredentialSource =
  | 'deployment'
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

/** Minimal session surface the config routes touch. */
export interface OMSession {
  /** `get()` returns '' when no model is selected, so callers fall back on falsy. */
  model: { get: () => string };
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
  deploymentProviders,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
  deploymentProviders?: ReadonlySet<string>;
}): Promise<ProviderInfo[]> {
  const models = await controller.listAvailableModels();
  const seen = new Map<string, ProviderInfo>();

  for (const model of models) {
    if (seen.has(model.provider)) continue;

    if (tenantCredentials && isDeploymentModelProvider(model.provider)) {
      // Credentials for these providers live on the server process, never in
      // tenant rows, so no account can connect them. List them only when the
      // operator opted the deployment in and the server has credentials.
      const usable =
        deploymentProviders?.has(model.provider) && models.some(m => m.provider === model.provider && m.hasApiKey);
      if (usable) seen.set(model.provider, { provider: model.provider, source: 'deployment' });
      continue;
    }

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

// ── Available models ───────────────────────────────────────────────────────

/**
 * Providers whose credentials can only come from the server process (Amazon
 * Bedrock authenticates through the AWS credential chain). In tenant mode they
 * are usable only when the operator lists them in
 * `MastraFactoryConfig.deploymentModelProviders`.
 */
export const DEPLOYMENT_MODEL_PROVIDERS: readonly string[] = [AMAZON_BEDROCK_GATEWAY_ID];

export function isDeploymentModelProvider(provider: string): boolean {
  return DEPLOYMENT_MODEL_PROVIDERS.includes(provider);
}

/**
 * Normalize the operator's `deploymentModelProviders` list. Unsupported ids are
 * ignored with a warning rather than failing boot.
 */
export function resolveDeploymentModelProviders(providers: readonly string[] | undefined): ReadonlySet<string> {
  const resolved = new Set<string>();
  for (const raw of providers ?? []) {
    const provider = raw.trim();
    if (!provider) continue;
    if (isDeploymentModelProvider(provider)) {
      resolved.add(provider);
    } else {
      console.warn(
        `[factory] Ignoring deployment model provider "${provider}". Supported: ${DEPLOYMENT_MODEL_PROVIDERS.join(', ')}.`,
      );
    }
  }
  return resolved;
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
  deploymentProviders,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
  deploymentProviders?: ReadonlySet<string>;
}): Promise<ProviderAccess> {
  const models = await controller.listAvailableModels();
  const hasModelKey = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (provider: string): ProviderAccessLevel => {
    const authProviderId = getAuthProviderId(provider);
    if (tenantCredentials) {
      // Tenant rows never authenticate these providers; only an operator
      // opt-in plus credentials on the server process does.
      if (isDeploymentModelProvider(provider)) {
        return deploymentProviders?.has(provider) && hasModelKey(provider) ? 'apikey' : false;
      }
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

// ── Default model ──────────────────────────────────────────────────────────

/** Per-user default model context for the current request. */
export interface ModelDefaultsContext {
  storage: ModelDefaultsStorage;
  orgId: string;
  userId: string;
}

/** Resolve the default-model context for a request, or a ready-to-return error response. */
async function resolveModelDefaultsContext({
  c,
  auth,
  modelDefaults,
}: {
  c: Context;
  auth: RouteAuth;
  modelDefaults?: ModelDefaultsStorage;
}): Promise<ModelDefaultsContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (modelDefaults) {
    try {
      await modelDefaults.ensureReady();
      return tenant
        ? { storage: modelDefaults, orgId: tenantOrgId(tenant), userId: tenant.userId }
        : { storage: modelDefaults, orgId: 'local', userId: 'local' };
    } catch {
      // fall through to the unavailable response
    }
  }
  return {
    response: c.json(
      {
        error: 'model_defaults_unavailable',
        message: 'Default model storage is unavailable — the app database is not configured or failed to start.',
      },
      503,
    ),
  };
}

// ── Observational memory ────────────────────────────────────────────────────
// Mirrors the TUI `/om` command. Settings are persisted per organization and
// user in the Factory app database, then loaded into request context for each
// invocation without copying them into mutable session state.

export interface OMRoleConfigInfo {
  model: 'auto' | string;
  effectiveModelId: string;
  providerStatus: 'available' | 'unavailable';
}

/** Persisted intent plus the concrete models the current Factory configuration resolves. */
export interface OMConfigInfo {
  observer: OMRoleConfigInfo;
  reflector: OMRoleConfigInfo;
  /** @deprecated Use `observer.effectiveModelId`. */
  observerModelId: string;
  /** @deprecated Use `reflector.effectiveModelId`. */
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
  /** False when the deployment refuses writes, so the UI can render read-only rows. */
  editable: boolean;
}

/** `PUT /web/config/thinking` success payload. */
export interface UpdateThinkingConfigResponse {
  ok: true;
  globalDefault: ThinkingLevelSetting;
  modeDefaults: Record<string, ThinkingLevelSetting>;
}

function modelProvider(modelId: string): string {
  // Mirrors the gateway-prefix stripping in the SDK's `resolveAutoOMModelId` so an
  // effective ID reports the same provider here as it resolved to there.
  const normalized = modelId.replace(/^mastracode\//, '').replace(/^mastra\//, '');
  return normalized.split('/', 1)[0] ?? '';
}

function roleConfig(
  model: OMRoleConfigInfo['model'],
  effectiveModelId: string,
  availableProviders: ReadonlySet<string>,
): OMRoleConfigInfo {
  return {
    model,
    effectiveModelId,
    providerStatus: availableProviders.has(modelProvider(effectiveModelId)) ? 'available' : 'unavailable',
  };
}

function readStoredOMConfig(
  record: MemorySettingsRecord | null,
  currentModelId: string | undefined,
  availableProviders: ReadonlySet<string>,
): OMConfigInfo {
  const autoModelId = resolveAutoOMModelId(currentModelId);
  const observerModelId = record?.observerModelId ?? autoModelId;
  const reflectorModelId = record?.reflectorModelId ?? autoModelId;
  return {
    observer: roleConfig(record?.observerModelId ?? 'auto', observerModelId, availableProviders),
    reflector: roleConfig(record?.reflectorModelId ?? 'auto', reflectorModelId, availableProviders),
    observerModelId,
    reflectorModelId,
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
async function persistMemorySettings(context: MemorySettingsContext, patch: MemorySettingsPatch): Promise<void> {
  await context.storage.patch({ orgId: context.orgId, userId: context.userId, patch });
}

/** Dependencies injected into {@link ConfigRoutes}. */
export interface ConfigRoutesDeps extends RouteDependencies {
  controller: ModelCatalog;
  features?: { knowledge: boolean };
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Tenant model-defaults domain handle; absent in local (no-DB) mode. */
  modelDefaults?: ModelDefaultsStorage;
  /** Source-control sessions available to config route integrations. */
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
   * Tenant mode: providers the operator opted in to run on the server process's
   * own credentials (see `DEPLOYMENT_MODEL_PROVIDERS`).
   */
  deploymentProviders?: ReadonlySet<string>;
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
    const { controller, authStorage, auth, deploymentProviders } = options;
    const onCredentialsChanged = options.onCredentialsChanged ?? (() => {});
    const onCustomProvidersChanged = options.onCustomProvidersChanged ?? (() => {});

    const resolveOMResponseContext = async (c: Context) => {
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
      const availableProviders = new Set(
        Object.entries(access).flatMap(([providerId, configured]) => (configured ? [providerId] : [])),
      );
      if (options.customProviders) {
        const context = await resolveCustomProvidersContext({
          c: loose(c),
          auth,
          customProviders: options.customProviders,
        });
        if (!('response' in context)) {
          for (const provider of await context.storage.list({ orgId: context.orgId })) {
            availableProviders.add(provider.providerId);
          }
        }
      }
      return availableProviders;
    };

    // Factory-scoped OM reads without a stored row fall back to the low-cost
    // OM model of the factory default model's provider — not the global
    // built-in default, whose provider may have no credential here.
    const factoryOmFallback = async (factoryProjectId: string | undefined): Promise<string | undefined> => {
      try {
        const defaultModelId = factoryProjectId
          ? await options.factoryProjects
              ?.getById({ id: factoryProjectId })
              .then(project => project?.defaultModelId ?? undefined)
          : controller.listModes?.().find(mode => mode.defaultModelId)?.defaultModelId;
        return defaultModelId ? resolveAutoOMModelId(defaultModelId) : undefined;
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
                deploymentProviders,
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
              // A stored key would never be read: these providers authenticate
              // with the server process's credentials only.
              if (isDeploymentModelProvider(provider)) {
                return c.json(
                  {
                    error: 'provider_configured_by_deployment',
                    message: `${provider} is configured by the Factory deployment (credentials on the server), not per account.`,
                  },
                  400,
                );
              }
              if (scope === 'org' && !(await auth.isOrganizationAdmin(loose(c), ctx.orgId))) {
                return c.json({ error: 'organization_admin_required' }, 403);
              }
              const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
              // envVar is intentionally ignored: tenant credentials are resolved
              // per-request, never written into process.env.
              await ctx.storage.setCredential(tenant, getAuthProviderId(provider), { type: 'api_key', key });
              onCredentialsChanged(tenant);
              const records = await ctx.storage.listCredentials(ctx.orgId, ctx.userId);
              const providers = await listProviders({ controller, tenantCredentials: records, deploymentProviders });
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
              const providers = await listProviders({ controller, tenantCredentials: records, deploymentProviders });
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
                deploymentProviders,
              }),
            ]);
            const catalog = models.flatMap(({ id, provider, modelName }) =>
              typeof id === 'string' && canUseModelProvider(access, provider)
                ? [{ id, provider, modelName, hasApiKey: true, reasoningOptions: getModelReasoningOptions(id) }]
                : [],
            );
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
                      catalog.push({
                        id,
                        provider: record.providerId,
                        modelName: model,
                        hasApiKey: true,
                        reasoningOptions: undefined,
                      });
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

      // ── Default model ───────────────────────────────────────────────────────

      registerApiRoute('/web/config/default-model', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const context = await resolveModelDefaultsContext({
            c: loose(c),
            auth,
            modelDefaults: options.modelDefaults,
          });
          if ('response' in context) return context.response;
          try {
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            return c.json({ modelId: record?.modelId ?? null });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/default-model', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          const context = await resolveModelDefaultsContext({
            c: loose(c),
            auth,
            modelDefaults: options.modelDefaults,
          });
          if ('response' in context) return context.response;
          let body: unknown;
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const parsed = z.object({ modelId: z.string().trim().min(1).max(256) }).safeParse(body);
          if (!parsed.success) return c.json({ error: 'Missing required field: modelId' }, 400);
          const { modelId } = parsed.data;
          try {
            await context.storage.set({ orgId: context.orgId, userId: context.userId, modelId });
            return c.json({ ok: true, modelId });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/default-model', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => {
          const context = await resolveModelDefaultsContext({
            c: loose(c),
            auth,
            modelDefaults: options.modelDefaults,
          });
          if ('response' in context) return context.response;
          try {
            await context.storage.clear({ orgId: context.orgId, userId: context.userId });
            return c.json({ ok: true, modelId: null });
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
              editable: !auth.enabled(),
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
            return c.json(
              {
                error:
                  'Deployment thinking defaults are shared by the whole deployment, so they cannot be changed while authentication is enabled',
              },
              403,
            );
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

      // Provider connection changes reachability, not selection intent, so this
      // no longer seeds observer/reflector rows from the provider's low-cost
      // pack: it validates the provider and returns the current config. The
      // route is kept as a contract for callers that still probe it.
      registerApiRoute('/web/config/om/provider-defaults', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          let body: { providerId?: unknown; factoryId?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
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
              deploymentProviders,
            });
            if (!access[providerId]) return c.json({ error: `Provider "${providerId}" is not configured` }, 400);

            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const availableProviders = await resolveOMResponseContext(loose(c));
            return c.json({
              ok: true,
              config: readStoredOMConfig(record, await factoryOmFallback(factoryProjectId), availableProviders),
            });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // ── Observational memory ──────────────────────────────────────────────────
      // Mirrors the TUI's /om command. All five knobs are durably stored in the
      // per-(org, user) `memory-settings` app table — never settings.json or
      // mutable session state.

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
            const availableProviders = await resolveOMResponseContext(loose(c));
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            return c.json({
              config: readStoredOMConfig(record, session?.model.get() || fallback, availableProviders),
            });
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
          const model = typeof body.modelId === 'string' ? body.modelId.trim() : '';
          if (!model) {
            return c.json({ error: 'Missing required field: modelId' }, 400);
          }
          // `'auto'` is selection intent, not a model ID: store null so the role
          // follows the active main model instead of pinning a model named "auto".
          const wantsAuto = model === 'auto';
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          // Resolve the response context before persisting: a provider-enumeration
          // failure must not report 500 for a write that already succeeded.
          const availableProviders = await resolveOMResponseContext(loose(c));
          try {
            await persistMemorySettings(context, {
              [role === 'observer' ? 'observerModelId' : 'reflectorModelId']: wantsAuto ? null : model,
            });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const config = readStoredOMConfig(
              record,
              session?.model.get() || (await factoryOmFallback(factoryProjectId)),
              availableProviders,
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
          const availableProviders = await resolveOMResponseContext(loose(c));
          try {
            await persistMemorySettings(context, {
              ...(observation !== undefined ? { observationThreshold: observation } : {}),
              ...(reflection !== undefined ? { reflectionThreshold: reflection } : {}),
            });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const config = readStoredOMConfig(
              record,
              session?.model.get() || (await factoryOmFallback(factoryProjectId)),
              availableProviders,
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
          const availableProviders = await resolveOMResponseContext(loose(c));
          try {
            await persistMemorySettings(context, { observeAttachments: value });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = resourceId ? await controller.getSessionByResource?.(resourceId, scope) : undefined;
            const config = readStoredOMConfig(
              record,
              session?.model.get() || (await factoryOmFallback(factoryProjectId)),
              availableProviders,
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
