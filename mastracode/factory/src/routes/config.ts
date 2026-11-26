import type { CredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { listCustomProviderModels, testCustomProviderModel } from '@mastra/code-sdk/agents/custom-provider-check';
import type {
  CustomProviderCheckFailure,
  CustomProviderCheckOptions,
  CustomProviderConnection,
  CustomProviderModelsResult,
  CustomProviderModelTestResult,
} from '@mastra/code-sdk/agents/custom-provider-check';
import { MASTRACODE_GATEWAY_ID, MastraCodeGateway } from '@mastra/code-sdk/agents/mastracode-gateway';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { MIN_OBSERVATION_THRESHOLD } from '@mastra/code-sdk/constants';
import {
  customProviderHeaderProblem,
  isCustomProviderAuthScheme,
  MAX_CUSTOM_PROVIDER_HEADERS,
} from '@mastra/code-sdk/onboarding/custom-provider-headers';
import { resolveAutoOMModelId } from '@mastra/code-sdk/onboarding/packs';
import type { ProviderAccess, ProviderAccessLevel } from '@mastra/code-sdk/onboarding/packs';
import { getCustomProviderId, MASTRA_GATEWAY_PROVIDER } from '@mastra/code-sdk/onboarding/settings';
import type { CustomProviderAuthScheme } from '@mastra/code-sdk/onboarding/settings';
import { AMAZON_BEDROCK_GATEWAY_ID } from '@mastra/code-sdk/providers/amazon-bedrock-gateway';
import { GOOGLE_VERTEX_GATEWAY_ID } from '@mastra/code-sdk/providers/google-vertex-gateway';
import {
  MASTRA_GATEWAY_PREFIX,
  normalizeLegacyProviderId,
  withCodexFastModels,
} from '@mastra/code-sdk/providers/model-ids';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { getModelReasoningOptions, MastraGateway, PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ModelReasoningOption } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { Context } from 'hono';
import { z } from 'zod';
import type { ModelPackSet, ResolvedModelSelection } from '../model-packs.js';
import { resolveFactoryModelPolicy, routedPersonalDefaults } from '../session/credential-policy.js';
import { DEFAULT_OBSERVATION_THRESHOLD, DEFAULT_REFLECTION_THRESHOLD } from '../session/memory-settings-hydration.js';
import type {
  CredentialRecord,
  CredentialScope as StoredCredentialScope,
  LoginSessionKind,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import { resolveCustomProviderSettings } from '../storage/domains/custom-providers/base.js';
import type {
  CustomProviderCallSettings,
  CustomProviderHeaderInput,
  CustomProviderInput,
  CustomProviderLastCheck,
  CustomProviderOwner,
  CustomProviderRecord,
  CustomProviderSettingsDraft,
  CustomProviderSettingsRefusal,
  CustomProvidersStorage,
  CustomProviderWrite,
} from '../storage/domains/custom-providers/base.js';
import type {
  MemorySettingsPatch,
  MemorySettingsRecord,
  MemorySettingsStorage,
} from '../storage/domains/memory-settings/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope, factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { customEndpointUrlProblem, hostedOnPlatform } from './custom-endpoint-url.js';
import { customProviderOwner } from './custom-provider-source.js';
import { createGatewayKey, getGatewayCredits, MASTRA_SIGN_IN_REQUIRED, MastraGatewayError } from './mastra-gateway.js';
import {
  modelPackRoutes,
  readSessionModelSelection,
  resolveSessionModelPackSet,
  sessionAddressSchema,
} from './model-pack-routes.js';
import type { SessionAddress } from './model-pack-routes.js';
import {
  credentialLabel,
  getAuthProviderId,
  listTenantCredentialsForRequest,
  MASTRA_GATEWAY_CATALOG_PROVIDER,
  resolveCredentialContext,
  runScopeFor,
  storedScopeFor,
  tenantOrgId,
  WEB_OAUTH_PROVIDERS,
} from './provider-credentials.js';
import { loose, Route } from './route.js';
import type { RouteAuth, RouteDependencies } from './route.js';
import { readRunningPackages } from './running-packages.js';
import type { RunningPackage } from './running-packages.js';
import { resolveTenantProviderDefaultModel } from './tenant-credentials.js';

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
  /** Tenant mode: the caller's personal sign-in could not be renewed and must be redone. */
  userCredentialExpired?: true;
  /** Tenant mode: the shared org credential for this provider, if any. */
  orgCredential?: 'oauth' | 'api_key';
  /** Tenant mode: the shared org sign-in could not be renewed and must be redone. */
  orgCredentialExpired?: true;
  /** Web OAuth sign-in capability, when the provider supports it. */
  oauth?: { supported: true; modes: LoginSessionKind[] };
  /** The provider is a stored custom OpenAI-compatible endpoint. */
  custom?: true;
  /** Tenant mode: Factory can mint this provider's key with the caller's Mastra account (the Mastra Gateway). */
  connectWithMastraAccount?: true;
  /**
   * Tenant mode: the server has its own key for this provider (the Mastra Gateway), which serves
   * any scope that has no stored credential. Reported apart from `source`, which names only the
   * credential that wins for the caller.
   */
  serverKey?: true;
}

/** Minimal session surface the config routes touch. */
export interface OMSession {
  /** `get()` returns '' when no model is selected, so callers fall back on falsy. */
  model: {
    get: () => string;
    switch?: (modelId: string, options?: { thinkingLevel?: ThinkingLevelSetting }) => Promise<void>;
  };
  thread?: {
    getId: () => string | null;
    getById?: (input: { threadId: string }) => Promise<{ metadata?: Record<string, unknown> } | null>;
    setSettingOn?: (input: { threadId: string; key: string; value: unknown }) => Promise<void>;
  };
}

/** Minimal controller surface this module needs (model catalog + modes + sessions). */
export interface ModelCatalog {
  listAvailableModels: () => Promise<
    Array<{
      id?: string;
      modelName: string;
      provider: string;
      hasApiKey: boolean;
      apiKeyEnvVar?: string;
      releaseDate?: string;
    }>
  >;
  /** Drops cached auth so the next `listAvailableModels` call sees a credential change. */
  invalidateAvailableModelsCache?: () => void;
  listModes?: () => Array<{ id: string; defaultModelId?: string }>;
  getDefaultMode?: () => { defaultModelId?: string };
  getSession?: (sessionId: string) => Promise<OMSession | undefined>;
}

type CatalogModel = Awaited<ReturnType<ModelCatalog['listAvailableModels']>>[number];

/**
 * Whether a custom provider may not take `providerId`, because it already
 * means something to model resolution or to the provider pickers: a provider
 * Factory ships with (even if its catalog failed to load or this server does
 * not enable it), the id its
 * credentials are saved under, an older id rewritten before lookup, or a
 * gateway's own namespace. A custom provider there would be shadowed,
 * rerouted, or shown to others as that provider.
 */
async function isReservedProviderId(controller: ModelCatalog, providerId: string): Promise<boolean> {
  if (normalizeLegacyProviderId(providerId) !== providerId) return true;
  const catalog = await controller.listAvailableModels();
  const knownIds = [
    MASTRA_GATEWAY_CATALOG_PROVIDER,
    MASTRA_GATEWAY_PROVIDER,
    MASTRACODE_GATEWAY_ID,
    AMAZON_BEDROCK_GATEWAY_ID,
    GOOGLE_VERTEX_GATEWAY_ID,
    ...Object.keys(WEB_OAUTH_PROVIDERS),
    ...Object.keys(PROVIDER_REGISTRY),
    ...catalog.map(model => model.provider),
  ];
  return knownIds.some(id => id === providerId || getAuthProviderId(id) === providerId);
}

/**
 * The controller's model catalog, plus the Mastra Gateway's models for tenant
 * callers. The boot-time catalog lists `mastra/...` models only when the server
 * itself has a gateway key; tenants bring their own (connected in one click).
 */
async function listCatalogModels(
  controller: ModelCatalog,
  tenantCredentials: CredentialRecord[] | undefined,
): Promise<CatalogModel[]> {
  const models = await controller.listAvailableModels();
  if (!tenantCredentials || models.some(m => m.provider === MASTRA_GATEWAY_CATALOG_PROVIDER)) return models;
  const gateway = (await new MastraGateway().fetchProviders())[MASTRA_GATEWAY_CATALOG_PROVIDER];
  const gatewayModels = (gateway?.models ?? []).map(modelName => ({
    id: `${MASTRA_GATEWAY_CATALOG_PROVIDER}/${modelName}`,
    provider: MASTRA_GATEWAY_CATALOG_PROVIDER,
    modelName,
    hasApiKey: false,
    releaseDate: gateway?.modelReleaseDates?.[modelName],
  }));
  return [...models, ...gatewayModels];
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
  listCustomProviders,
  connectWithMastraAccount,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  tenantCredentials?: CredentialRecord[];
  deploymentProviders?: ReadonlySet<string>;
  listCustomProviders?: () => Promise<ScopedCustomProvider[]>;
  /** The auth provider can act on the Mastra platform as the caller. */
  connectWithMastraAccount?: boolean;
}): Promise<ProviderInfo[]> {
  const models = await listCatalogModels(controller, tenantCredentials);
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
    // The server has its own gateway key, such as the one the Mastra platform adds to a deploy.
    const serverGatewayKey =
      model.provider === MASTRA_GATEWAY_CATALOG_PROVIDER && Boolean(MastraCodeGateway.getMastraGatewayApiKey());
    let source: ProviderInfo['source'] = 'none';
    let orgKey: boolean | undefined;
    let userCredential: ProviderInfo['userCredential'];
    let userCredentialExpired = false;
    let orgCredential: ProviderInfo['orgCredential'];
    let orgCredentialExpired = false;
    if (tenantCredentials) {
      const userRec = tenantCredentials.find(r => r.scope === 'user' && r.provider === authProviderId);
      const orgRec = tenantCredentials.find(r => r.scope === 'org' && r.provider === authProviderId);
      // Any shared org credential (API key or org-wide OAuth) counts.
      orgKey = orgRec !== undefined;
      userCredential = userRec?.credential.type;
      userCredentialExpired = userRec?.refreshFailedAt !== undefined;
      orgCredential = orgRec?.credential.type;
      orgCredentialExpired = orgRec?.refreshFailedAt !== undefined;
      if (userRec?.credential.type === 'oauth') {
        source = 'oauth-user';
      } else if (userRec?.credential.type === 'api_key') {
        source = 'stored-user';
      } else if (orgRec?.credential.type === 'oauth') {
        source = 'oauth-org';
      } else if (orgRec?.credential.type === 'api_key') {
        source = 'stored-org';
      } else if (serverGatewayKey) {
        // Model resolution already falls back to the server's key, so the shared
        // account is connected without a key of its own.
        source = 'deployment';
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

    const flowKind = WEB_OAUTH_PROVIDERS[model.provider]?.flow;
    seen.set(model.provider, {
      provider: model.provider,
      envVar: model.apiKeyEnvVar,
      source,
      ...(orgKey !== undefined ? { orgKey } : {}),
      ...(userCredential ? { userCredential } : {}),
      ...(userCredentialExpired ? { userCredentialExpired: true as const } : {}),
      ...(orgCredential ? { orgCredential } : {}),
      ...(orgCredentialExpired ? { orgCredentialExpired: true as const } : {}),
      ...(flowKind ? { oauth: { supported: true as const, modes: [flowKind] } } : {}),
      // A server that already has a gateway key needs no key minted, so the one-click connect is not offered.
      ...(tenantCredentials &&
      connectWithMastraAccount &&
      model.provider === MASTRA_GATEWAY_CATALOG_PROVIDER &&
      !serverGatewayKey
        ? { connectWithMastraAccount: true as const }
        : {}),
      ...(tenantCredentials && serverGatewayKey ? { serverKey: true as const } : {}),
    });
  }

  if (listCustomProviders) {
    try {
      // A custom endpoint is reported at the scope it is saved at, through the
      // fields a saved key uses, so every scope-aware reader treats it like a
      // provider connected there.
      for (const { record, scope } of await listCustomProviders()) {
        const listed = seen.get(record.providerId);
        // A built-in provider keeps its row: a custom endpoint is never
        // reported as that provider's credential.
        if (listed && !listed.custom) continue;
        // Gateway alias of this same endpoint, not a separate provider.
        seen.delete(`${MASTRACODE_GATEWAY_ID}/${record.providerId}`);
        const info: ProviderInfo = listed ?? { provider: record.providerId, source: 'none', custom: true };
        if (!tenantCredentials) {
          info.source = 'stored';
        } else if (scope === 'user') {
          info.userCredential = 'api_key';
          info.source = 'stored-user';
        } else {
          info.orgCredential = 'api_key';
          info.orgKey = true;
          if (info.source === 'none') info.source = 'stored-org';
        }
        seen.set(record.providerId, info);
      }
    } catch {
      // Keep the built-in provider catalog available if custom-provider storage is unavailable.
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.provider.localeCompare(b.provider));
}

export type { CustomProviderCheckFailure, CustomProviderModelsResult, CustomProviderModelTestResult };
export type { CustomProviderLastCheck };

/** A saved custom header as the client sees it. */
export interface CustomProviderHeaderInfo {
  name: string;
  secret: boolean;
  /** Present only for headers that are not secret. */
  value?: string;
}

/** A user-defined OpenAI-compatible provider, with key presence (never the key). */
export interface CustomProviderInfo {
  id: string;
  name: string;
  url: string;
  hasApiKey: boolean;
  authScheme: CustomProviderAuthScheme;
  headers: CustomProviderHeaderInfo[];
  models: string[];
  /** Saved for the caller (`user`) or for their organization (`org`), like a provider key. */
  scope: StoredCredentialScope;
  /** Why this server refuses to call the endpoint. Its models are not offered until the URL is fixed. */
  urlProblem?: string;
  /**
   * The last connection test, cleared when the URL, key, auth scheme or headers
   * change. It records the connection test only, never a test message.
   */
  lastCheck?: CustomProviderLastCheck;
}

/** The response of `POST /web/config/custom-providers/check`. A failing check is data here, not an HTTP error. */
export interface CustomProviderCheckResponse {
  ok: true;
  check: { models: CustomProviderModelsResult; reply?: CustomProviderModelTestResult };
  /** Present when a saved row was checked and its `lastCheck` was recorded. */
  provider?: CustomProviderInfo;
}

/** The 422 body of a save with `check: true` whose connection test failed. Nothing is written. */
export interface CustomProviderCheckFailedResponse {
  error: 'custom_endpoint_check_failed';
  message: string;
  failure: CustomProviderCheckFailure;
}

/** A stored custom provider and the settings scope it is saved at. */
export interface ScopedCustomProvider {
  record: CustomProviderRecord;
  scope: StoredCredentialScope;
}

/** Redact a stored custom-provider row for the client: key presence only, and no secret header value. */
function toCustomProviderInfo({ record, scope }: ScopedCustomProvider): CustomProviderInfo {
  return {
    id: record.providerId,
    name: record.name,
    url: record.url,
    hasApiKey: Boolean(record.apiKey),
    authScheme: record.authScheme ?? 'bearer',
    headers: record.headers.map(header =>
      header.secret === false
        ? { name: header.name, secret: false, value: header.value }
        : { name: header.name, secret: true },
    ),
    models: record.models,
    scope,
    urlProblem: customEndpointUrlProblem(record.url),
    ...(record.lastCheck ? { lastCheck: record.lastCheck } : {}),
  };
}

function isCallable(record: CustomProviderRecord): boolean {
  return !customEndpointUrlProblem(record.url);
}

/** The custom provider lists a request can reach. */
interface CustomProvidersContext {
  storage: CustomProvidersStorage;
  /** The account making the request, recorded as the creator of what it adds. */
  userId: string;
  /** The list behind each Settings scope. No-auth mode has only the one shared list, under `user`. */
  lists: { user: CustomProviderOwner; org?: CustomProviderOwner };
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
  const listAt = (scope: StoredCredentialScope) =>
    customProviderOwner(tenant && { ...tenant, credentialScope: runScopeFor(scope) }, auth.enabled());
  const user = listAt('user');
  if (!user) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (customProviders) {
    try {
      await customProviders.ensureReady();
      return {
        storage: customProviders,
        userId: tenant?.userId ?? 'local',
        lists: auth.enabled() ? { user, org: listAt('org') } : { user },
      };
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

/** Every custom provider the caller can reach in Settings, with the scope each is saved at. */
async function listScopedCustomProviders(ctx: CustomProvidersContext): Promise<ScopedCustomProvider[]> {
  const [user, org] = await Promise.all([
    ctx.storage.list(ctx.lists.user),
    ctx.lists.org ? ctx.storage.list(ctx.lists.org) : [],
  ]);
  return [
    ...user.map(record => ({ record, scope: 'user' as const })),
    ...org.map(record => ({ record, scope: 'org' as const })),
  ];
}

/**
 * The custom providers model resolution uses for `tenant`, so a catalog never
 * offers a model its session cannot run. Without a tenant the route applies no
 * credential scope, and every list the caller can reach counts — the same rule
 * those routes apply to saved keys.
 */
async function listCustomProvidersInEffect({
  c,
  auth,
  customProviders,
  tenant,
}: {
  c: Context;
  auth: RouteAuth;
  customProviders: CustomProvidersStorage;
  tenant: CredentialTenant | undefined;
}): Promise<CustomProviderRecord[]> {
  const ctx = await resolveCustomProvidersContext({ c, auth, customProviders });
  if ('response' in ctx) return [];
  if (!tenant) return (await listScopedCustomProviders(ctx)).map(({ record }) => record).filter(isCallable);
  const owner = customProviderOwner(tenant, auth.enabled());
  return owner ? (await ctx.storage.list(owner)).filter(isCallable) : [];
}

/** A request body field that failed validation, as a 400 response body. */
interface CustomProviderBodyError {
  error: string;
  message?: string;
}

const QUERY_OR_FRAGMENT_REFUSED = 'url must not have a query string or fragment';

/**
 * Whether a base URL carries a query string or fragment. Request paths are
 * appended to it as text, so `/models` and `/chat/completions` would land
 * inside the query and call another path.
 */
function hasQueryOrFragment(url: string): boolean {
  return url.includes('?') || url.includes('#');
}

/** Read `url`, `apiKey`, `authScheme` and `headers` from a save or check body. */
function parseConnectionFields(b: Record<string, unknown>): CustomProviderSettingsDraft | CustomProviderBodyError {
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
  if (hasQueryOrFragment(url)) return { error: QUERY_OR_FRAGMENT_REFUSED };
  const apiKey = typeof b.apiKey === 'string' && b.apiKey.trim() ? b.apiKey.trim() : undefined;
  if (b.authScheme !== undefined && !isCustomProviderAuthScheme(b.authScheme)) {
    return { error: 'authScheme must be "bearer" or "x-api-key"' };
  }
  const authScheme = isCustomProviderAuthScheme(b.authScheme) ? b.authScheme : undefined;
  if (b.headers === undefined) return { url, apiKey, authScheme };
  if (!Array.isArray(b.headers)) return { error: 'header_refused', message: 'Custom headers must be a list.' };
  // Counted before anything walks the list, so an oversized body is refused cheaply.
  if (b.headers.length > MAX_CUSTOM_PROVIDER_HEADERS) {
    return {
      error: 'header_refused',
      message: `A provider can send at most ${MAX_CUSTOM_PROVIDER_HEADERS} custom headers.`,
    };
  }
  // Trimmed the way settings.json headers are, so both stores hold the same values.
  const trimmed = b.headers.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return entry;
    const { name, value } = entry as Record<string, unknown>;
    return {
      ...entry,
      name: typeof name === 'string' ? name.trim() : name,
      value: typeof value === 'string' ? value.trim() : value,
    };
  });
  // Without a scheme an edit keeps the saved one, which is unknown here, so only
  // a header both schemes refuse fails now. The storage and the draft check test
  // the final list against the scheme it ends up with.
  const entriesToCheck = trimmed as Array<{ name: unknown; value?: unknown }>;
  const problem = authScheme
    ? customProviderHeaderProblem(entriesToCheck, authScheme)
    : customProviderHeaderProblem(entriesToCheck, 'bearer') && customProviderHeaderProblem(entriesToCheck, 'x-api-key');
  if (problem) return { error: 'header_refused', message: problem };
  const entries = trimmed as Array<{ name: string; value?: string; secret?: unknown }>;
  // Reading a malformed flag as "omitted" would make the header secret or keep
  // the saved flag, which is not what the client asked for.
  const malformed = entries.find(({ secret }) => secret !== undefined && typeof secret !== 'boolean');
  if (malformed) {
    return {
      error: 'header_refused',
      message: `The secret flag of the ${malformed.name} header must be true or false.`,
    };
  }
  const headers = entries.map(
    ({ name, value, secret }): CustomProviderHeaderInput => ({
      name,
      ...(value === undefined ? {} : { value }),
      ...(typeof secret === 'boolean' ? { secret } : {}),
    }),
  );
  return { url, apiKey, authScheme, headers };
}

/** A validated custom-provider save request. */
interface CustomProviderSave extends CustomProviderSettingsDraft {
  name: string;
  models: string[];
  /** The id of the provider being edited. Absent when adding one. */
  previousId?: string;
  /** Where to save it. Anything but `org` means the caller's own list, like provider keys. */
  scope: StoredCredentialScope;
  /** Run the connection test first and save only when it passes. */
  check: boolean;
}

/** Validate + coerce a request body into a custom-provider save. */
function parseCustomProviderBody(body: unknown): CustomProviderSave | CustomProviderBodyError {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };
  const b: Record<string, unknown> = { ...body };
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { error: 'Missing required field: name' };
  const connection = parseConnectionFields(b);
  if ('error' in connection) return connection;
  const models = Array.isArray(b.models)
    ? b.models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map(m => m.trim())
    : [];
  const previousId = typeof b.previousId === 'string' && b.previousId ? b.previousId : undefined;
  // Reading a malformed flag as false would save the provider untested.
  if (b.check !== undefined && typeof b.check !== 'boolean') return { error: 'check must be true or false' };
  return {
    ...connection,
    name,
    models,
    previousId,
    scope: b.scope === 'org' ? 'org' : 'user',
    check: b.check === true,
  };
}

/**
 * A validated `POST /web/config/custom-providers/check` request: a draft to
 * check without saving it, which may reuse the secrets of the saved row named
 * by `previousId`, or a saved row to check as stored.
 */
type CustomProviderCheckRequest = {
  scope: StoredCredentialScope;
  /** Also send the test message to this model. */
  model?: string;
} & (
  | { kind: 'draft'; draft: CustomProviderSettingsDraft; previousId?: string }
  | { kind: 'saved'; previousId: string }
);

/**
 * Validate a check request. Without `url` the saved row named by `previousId`
 * is checked as stored, and the other connection fields are ignored.
 */
function parseCustomProviderCheckBody(body: unknown): CustomProviderCheckRequest | CustomProviderBodyError {
  if (!body || typeof body !== 'object') return { error: 'Invalid JSON body' };
  const b: Record<string, unknown> = { ...body };
  const previousId = typeof b.previousId === 'string' && b.previousId ? b.previousId : undefined;
  if (b.model !== undefined && typeof b.model !== 'string') return { error: 'model must be a string' };
  const model = b.model?.trim() || undefined;
  const scope = b.scope === 'org' ? 'org' : 'user';
  if (b.url === undefined) {
    if (!previousId) return { error: 'Missing required field: url or previousId' };
    return { kind: 'saved', previousId, scope, model };
  }
  const draft = parseConnectionFields(b);
  if ('error' in draft) return draft;
  return { kind: 'draft', previousId, scope, draft, model };
}

/** What each storage refusal tells the client. */
const CUSTOM_PROVIDER_REFUSALS = {
  name_taken: {
    status: 409,
    error: 'provider_name_taken',
    message: 'A provider with this name already exists here. Choose another name.',
  },
  not_found: { status: 404, error: 'custom_provider_not_found', message: 'This provider no longer exists.' },
  changed: {
    status: 409,
    error: 'custom_provider_changed',
    message: 'This provider changed while it was being tested. Try again.',
  },
  api_key_required: {
    status: 400,
    error: 'api_key_required',
    message: 'Enter the API key again: the saved key is only kept while the URL stays on the same host.',
  },
  header_value_required: {
    status: 400,
    error: 'header_value_required',
    message:
      'Enter a value for each header: a saved value is only kept for a header of the same name, and a secret one only while it stays secret and the URL keeps the same scheme, host and port.',
  },
  header_refused: { status: 400, error: 'header_refused', message: 'These custom headers cannot be sent.' },
} as const;

/** The status and body for a refused write or check, with the header rule that failed when there is one. */
function customProviderRefusal(refusal: Extract<CustomProviderWrite, { refused: string }>): {
  status: 400 | 404 | 409;
  body: { error: string; message: string };
} {
  const { status, error, message } = CUSTOM_PROVIDER_REFUSALS[refusal.refused];
  return { status, body: { error, message: 'problem' in refusal ? refusal.problem : message } };
}

/**
 * The connection a check calls: `draft` combined with the saved row it edits,
 * under the same rules a save applies (see `resolveCustomProviderSettings`).
 * The saved secrets it resolves are passed on, so the SDK redacts them too.
 */
function customProviderConnection(
  saved: CustomProviderCallSettings | null,
  draft: CustomProviderSettingsDraft,
): { connection: CustomProviderConnection } | CustomProviderSettingsRefusal {
  const settings = resolveCustomProviderSettings(saved, draft);
  if ('refused' in settings) return settings;
  const { url, apiKey, authScheme, headers } = settings.resolved;
  return { connection: { url, apiKey: apiKey ?? undefined, authScheme: authScheme ?? undefined, headers } };
}

/**
 * Options for both SDK checks. A hosted Factory keeps only an upstream error
 * message or page title, because the server may have reached an address the
 * caller could not, and its raw body text is not theirs to read.
 */
function customProviderCheckOptions(): CustomProviderCheckOptions {
  return { summaryDetailOnly: hostedOnPlatform() };
}

/**
 * Providers whose credentials can only come from the server process. Amazon
 * Bedrock uses the AWS credential chain, while Google Vertex uses Application
 * Default Credentials. In tenant mode they are usable only when the operator
 * lists them in `MastraFactoryConfig.deploymentModelProviders`.
 */
export const DEPLOYMENT_MODEL_PROVIDERS: readonly string[] = [AMAZON_BEDROCK_GATEWAY_ID, GOOGLE_VERTEX_GATEWAY_ID];

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

function grantingTenantRecord(records: CredentialRecord[], authProviderId: string) {
  return (
    records.find(r => r.scope === 'user' && r.provider === authProviderId) ??
    records.find(r => r.scope === 'org' && r.provider === authProviderId)
  );
}

export type ModelCredentialHolder = 'personal' | 'organization' | 'deployment';

function tenantModelCredential(
  records: CredentialRecord[] | undefined,
  provider: string,
): { credentialLabel?: string; credentialHolder?: ModelCredentialHolder } {
  if (!records) return {};
  if (isDeploymentModelProvider(provider)) return { credentialHolder: 'deployment' };
  const record = grantingTenantRecord(records, getAuthProviderId(provider));
  if (!record) return {};
  return {
    credentialLabel: credentialLabel(provider, record.credential.type),
    credentialHolder: record.scope === 'user' ? 'personal' : 'organization',
  };
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
  const models = await listCatalogModels(controller, tenantCredentials);
  const hasModelKey = (provider: string) => models.some(m => m.provider === provider && m.hasApiKey);
  const accessLevel = (provider: string): ProviderAccessLevel => {
    const authProviderId = getAuthProviderId(provider);
    if (tenantCredentials) {
      // Tenant rows never authenticate these providers; only an operator
      // opt-in plus credentials on the server process does.
      if (isDeploymentModelProvider(provider)) {
        return deploymentProviders?.has(provider) && hasModelKey(provider) ? 'apikey' : false;
      }
      const credential = grantingTenantRecord(tenantCredentials, authProviderId)?.credential;
      if (credential?.type === 'oauth') return 'oauth';
      if (credential?.type === 'api_key' && credential.key.trim().length > 0) return 'apikey';
      // Model resolution falls back to the server's own gateway key, if it has one.
      if (provider === MASTRA_GATEWAY_CATALOG_PROVIDER && MastraCodeGateway.getMastraGatewayApiKey()) return 'apikey';
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

/** A model the caller can pick or switch to. */
export interface ModelCatalogEntry {
  id: string;
  provider: string;
  modelName: string;
  releaseDate?: string;
  hasApiKey: true;
  reasoningOptions?: ModelReasoningOption[];
  credentialLabel?: string;
  credentialHolder?: ModelCredentialHolder;
}

/**
 * Models usable with the given credentials: built-in models whose provider the
 * credentials reach, then the org's custom provider models. The Settings model
 * picker and `factory_switch_session_model` both use this so they cannot drift.
 */
export async function buildModelCatalog({
  controller,
  authStorage,
  tenantCredentials,
  deploymentProviders,
  listCustomProviders,
}: {
  controller: ModelCatalog;
  authStorage?: AuthStorage;
  /** Tenant rows in deployed mode; absent in local mode, where `authStorage` and server keys govern. */
  tenantCredentials?: CredentialRecord[];
  deploymentProviders?: ReadonlySet<string>;
  listCustomProviders?: () => Promise<CustomProviderRecord[]>;
}): Promise<ModelCatalogEntry[]> {
  const [models, access] = await Promise.all([
    listCatalogModels(controller, tenantCredentials),
    buildProviderAccess({
      controller,
      authStorage: tenantCredentials ? undefined : authStorage,
      tenantCredentials,
      deploymentProviders,
    }),
  ]);
  const builtIn: ModelCatalogEntry[] = models.flatMap(({ id, provider, modelName, releaseDate }) =>
    typeof id === 'string' && canUseModelProvider(access, provider)
      ? [
          {
            id,
            provider,
            modelName,
            releaseDate,
            hasApiKey: true as const,
            reasoningOptions: getModelReasoningOptions(id),
            ...tenantModelCredential(tenantCredentials, provider),
          },
        ]
      : [],
  );
  const catalog = withCodexFastModels(builtIn, { codexOAuth: access.openai === 'oauth' });
  // The boot-time gateway catalog only carries the local custom providers, so
  // tenant callers get the rows in effect for them here. Dedupe against ids
  // already present.
  if (listCustomProviders) {
    try {
      const known = new Set(catalog.map(m => m.id));
      for (const record of await listCustomProviders()) {
        const credentialHolder: ModelCredentialHolder = record.userId === null ? 'organization' : 'personal';
        for (const model of record.models) {
          const id = `${record.providerId}/${model}`;
          if (known.has(id)) continue;
          known.add(id);
          catalog.push({
            id,
            provider: record.providerId,
            modelName: model,
            hasApiKey: true,
            ...(tenantCredentials ? { credentialHolder } : {}),
          });
        }
      }
    } catch {
      // Fail soft: the catalog still serves the built-in models.
    }
  }
  return catalog.sort((a, b) =>
    a.provider === b.provider ? a.id.localeCompare(b.id) : a.provider.localeCompare(b.provider),
  );
}

/**
 * The tenant credentials a session's model policy allows: the Factory's (org
 * rows) for Factory-scoped sessions, the session owner's for user-scoped ones.
 */
export async function listSessionScopedCredentials({
  credentials,
  orgId,
  userId,
  modelScope,
}: {
  credentials: Pick<ModelCredentialsStorage, 'listCredentials'>;
  orgId: string;
  userId: string;
  modelScope: 'factory' | 'user';
}): Promise<CredentialRecord[]> {
  const storedScope = storedScopeFor(modelScope);
  return (await credentials.listCredentials(orgId, userId)).filter(record => record.scope === storedScope);
}

// Mirrors the TUI `/om` command. Settings are persisted per organization and
// user in the Factory app database, then loaded into request context for each
// invocation without copying them into mutable session state.

export interface OMRoleConfigInfo {
  model: 'auto' | string;
  effectiveModelId: string;
  effectiveModelSource: 'explicit' | 'live-session' | 'configured-default';
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

function modelProvider(modelId: string): string {
  // Effective IDs keep their `mastra/` route; the provider segment after it is what
  // the SDK resolver falls back to when the gateway is not configured.
  const normalized = modelId.replace(/^mastracode\//, '').replace(/^mastra\//, '');
  return normalized.split('/', 1)[0] ?? '';
}

function roleConfig(
  model: OMRoleConfigInfo['model'],
  effectiveModelId: string,
  autoModelSource: 'live-session' | 'configured-default',
  availableProviders: ReadonlySet<string>,
): OMRoleConfigInfo {
  return {
    model,
    effectiveModelId,
    effectiveModelSource: model === 'auto' ? autoModelSource : 'explicit',
    providerStatus:
      availableProviders.has(modelProvider(effectiveModelId)) ||
      (effectiveModelId.startsWith(MASTRA_GATEWAY_PREFIX) && availableProviders.has(MASTRA_GATEWAY_PROVIDER))
        ? 'available'
        : 'unavailable',
  };
}

function readStoredOMConfig(
  record: MemorySettingsRecord | null,
  currentModelId: string | undefined,
  autoModelSource: 'live-session' | 'configured-default',
  availableProviders: ReadonlySet<string>,
): OMConfigInfo {
  const autoModelId = resolveAutoOMModelId(currentModelId, providerId => availableProviders.has(providerId));
  const observerModelId = record?.observerModelId ?? autoModelId;
  const reflectorModelId = record?.reflectorModelId ?? autoModelId;
  return {
    observer: roleConfig(record?.observerModelId ?? 'auto', observerModelId, autoModelSource, availableProviders),
    reflector: roleConfig(record?.reflectorModelId ?? 'auto', reflectorModelId, autoModelSource, availableProviders),
    observerModelId,
    reflectorModelId,
    observationThreshold: Math.max(
      record?.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD,
      MIN_OBSERVATION_THRESHOLD,
    ),
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
 * instead of the caller's personal row — the row requests paid with the
 * Factory's credentials read.
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
      const factoryUserId = factoryProjectId ? factoryProjectSettingsUserId(factoryProjectId) : undefined;
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

export interface PersonalModelDefaultsResponse extends ModelPackSet {
  modelId: string | null;
  thinkingLevel: ThinkingLevelSetting | null;
}

interface SessionModelPackSelection extends ModelPackSet {
  modelSelection: ResolvedModelSelection;
}

export interface SessionModelPolicy extends SessionModelPackSelection {
  modelScope: 'factory' | 'user';
  defaultModelId: string | null;
  personalThinkingLevel: ThinkingLevelSetting | null;
  models: ModelCatalogEntry[];
}

export interface SessionModelContext {
  tenantCredentials: CredentialRecord[];
  modelScope: 'factory' | 'user';
  defaultModelId: string | null;
  personalThinkingLevel: ThinkingLevelSetting | null;
  credentialTenant: CredentialTenant;
}

export type SessionModelContextResolver = (
  c: Context,
  address: SessionAddress,
  includeDefaultModel?: boolean,
) => Promise<SessionModelContext | { response: Response } | undefined>;

/** Dependencies injected into {@link ConfigRoutes}. */
export interface ConfigRoutesDeps extends RouteDependencies {
  controller: ModelCatalog;
  /** `mcp`: the Factory MCP endpoint is mounted (auth plus an MCP authorization server). */
  features?: { knowledge: boolean; mcp?: boolean };
  /** Reads the Mastra packages this server runs; defaults to the build manifest. */
  readPackages?: () => Promise<RunningPackage[]>;
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Tenant model-defaults domain handle; absent in local (no-DB) mode. */
  modelDefaults?: ModelDefaultsStorage;
  /** Source-control sessions available to config route integrations. */
  sourceControlSessions?: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  /** Thread membership used to resolve the same model policy as an invocation. */
  workItems?: WorkItemsStorage;
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
}

/**
 * The web config routes as Mastra `apiRoutes`:
 *   - `GET    /web/config/features`               — list server-enabled product features
 *   - `GET    /web/config/versions`               — list the Mastra packages and Node version this server runs
 *   - `GET    /web/config/providers`              — list providers + key source
 *   - `PUT    /web/config/providers/:provider/key` — set/update a provider's API key
 *   - `DELETE /web/config/providers/:provider/key` — remove a stored API key
 *   - `GET    /web/config/models`                  — list available models (credentialed providers)
 *   - `GET    /web/config/default-model`           — read the caller's default model and model packs
 *   - `PUT    /web/config/model-packs`             — replace the caller's model packs
 *   - `PUT    /web/config/session-model`           — run a live session on a pack or an exact model
 *   - `GET    /web/config/custom-providers`        — list custom OpenAI-compatible providers
 *   - `POST   /web/config/custom-providers`        — create/update a custom provider
 *   - `POST   /web/config/custom-providers/check`  - test a draft or a saved custom provider
 *   - `DELETE /web/config/custom-providers/:id`    — remove a custom provider
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
    const connectWithMastraAccount = auth.fetchPlatformAsUser !== undefined;
    const listTenantProviders = (records: CredentialRecord[]) =>
      listProviders({ controller, tenantCredentials: records, deploymentProviders, connectWithMastraAccount });
    const gatewayFailure = (c: Context, error: unknown) =>
      error instanceof MastraGatewayError
        ? c.json({ error: error.message }, error.status)
        : c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    const onCustomProvidersChanged = options.onCustomProvidersChanged ?? (() => {});
    // Model resolution reads the per-org snapshot; the model catalog reads custom
    // providers through the gateway and caches them. Refresh both after a write.
    const customProvidersChanged = (orgId: string) => {
      onCustomProvidersChanged({ orgId });
      controller.invalidateAvailableModelsCache?.();
    };

    /**
     * The list a custom-provider write addresses. Changing the organization's
     * list takes an admin, as org-wide keys do. No-auth mode has one list,
     * whatever scope the request names.
     */
    const resolveCustomProviderWrite = async (c: Context, ctx: CustomProvidersContext, scope: unknown) => {
      if (scope !== 'org' || !ctx.lists.org) return { owner: ctx.lists.user, scope: 'user' as const };
      if (!(await auth.isOrganizationAdmin(c, ctx.lists.org.orgId))) {
        return {
          response: c.json(
            {
              error: 'organization_admin_required',
              message: 'Only organization admins can change org-wide providers.',
            },
            403,
          ),
        };
      }
      return { owner: ctx.lists.org, scope: 'org' as const };
    };

    const resolveSessionModelContext: SessionModelContextResolver = async (c, address, includeDefaultModel = true) => {
      await auth.ensureUser(c);
      const tenant = auth.tenant(c);
      if (!tenant && auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
      if (!tenant) return undefined;
      if (
        !options.factoryProjects ||
        !options.sourceControlSessions ||
        !options.workItems ||
        !options.modelCredentials
      ) {
        return { response: c.json({ error: 'session_model_policy_unavailable' }, 503) };
      }

      const requestContext = new RequestContext();
      requestContext.set('user', { id: tenant.userId, organizationId: tenantOrgId(tenant) });
      requestContext.set('controller', address);
      let policy;
      try {
        policy = await resolveFactoryModelPolicy(requestContext, {
          projects: options.factoryProjects,
          sourceControl: options.sourceControlSessions,
          workItems: options.workItems,
        });
      } catch {
        return { response: c.json({ error: 'session_model_policy_unavailable' }, 403) };
      }
      if (!policy) return { response: c.json({ error: 'unauthorized' }, 401) };

      const orgId = policy.tenant.orgId ?? tenantOrgId(tenant);
      const modelScope = policy.tenant.credentialScope ?? 'user';
      const tenantCredentials = await listSessionScopedCredentials({
        credentials: options.modelCredentials,
        orgId,
        userId: policy.tenant.userId,
        modelScope,
      });
      let defaultModelId = policy.factoryDefaultModelId ?? null;
      let personalThinkingLevel: ThinkingLevelSetting | null = null;
      if (modelScope === 'user' && includeDefaultModel) {
        if (!options.modelDefaults) return { response: c.json({ error: 'model_defaults_unavailable' }, 503) };
        const ownerDefaults = await routedPersonalDefaults(policy.tenant, options.modelDefaults);
        defaultModelId = ownerDefaults?.modelId ?? null;
        personalThinkingLevel = ownerDefaults?.thinkingLevel ?? null;
      }
      const credentialTenant: CredentialTenant = { orgId, userId: policy.tenant.userId, credentialScope: modelScope };
      return { tenantCredentials, modelScope, defaultModelId, personalThinkingLevel, credentialTenant };
    };

    const resolveOMResponseContext = async (
      c: Context,
      {
        sessionId,
        threadId,
        resourceId,
        factoryProjectId,
      }: {
        sessionId?: string;
        threadId?: string;
        resourceId?: string;
        factoryProjectId?: string;
      },
    ) => {
      let tenantCredentials = await listTenantCredentialsForRequest({
        c: loose(c),
        auth,
        credentials: options.modelCredentials,
      });
      const tenant = auth.tenant(c);
      // Custom providers follow the same scope as the credentials below.
      let customProviderTenant: CredentialTenant | undefined = tenant && { ...tenant, credentialScope: 'user' };
      if (sessionId !== undefined && threadId !== undefined) {
        const address = z
          .object({
            sessionId: z.string().trim().min(1),
            threadId: z.string().trim().min(1),
            resourceId: z.string().trim().min(1).optional(),
          })
          .transform(data => ({ ...data, resourceId: data.resourceId ?? data.sessionId }))
          .safeParse({ sessionId, threadId, resourceId });
        if (!address.success) return { response: c.json({ error: 'invalid_session_context' }, 400) };
        const sessionContext = await resolveSessionModelContext(c, address.data, false);
        if (sessionContext && 'response' in sessionContext) return { response: sessionContext.response };
        tenantCredentials = sessionContext?.tenantCredentials;
        customProviderTenant = sessionContext?.credentialTenant;
      } else if (threadId !== undefined) {
        return { response: c.json({ error: 'invalid_session_context' }, 400) };
      } else if (tenantCredentials && factoryProjectId && tenant) {
        if (!options.factoryProjects) return { response: c.json({ error: 'factory_unavailable' }, 503) };
        await options.factoryProjects.ensureReady();
        const project = await options.factoryProjects.get({ orgId: tenantOrgId(tenant), id: factoryProjectId });
        if (!project) return { response: c.json({ error: 'factory_project_not_found' }, 404) };
        const credentialScope = effectiveModelScope(project.modelScope, 'run');
        tenantCredentials = tenantCredentials.filter(record => record.scope === storedScopeFor(credentialScope));
        customProviderTenant = { ...tenant, credentialScope };
      } else if (tenantCredentials) {
        tenantCredentials = tenantCredentials.filter(record => record.scope === 'user');
      }

      const access = await buildProviderAccess({
        controller,
        authStorage: tenantCredentials ? undefined : authStorage,
        tenantCredentials,
        deploymentProviders,
      });
      const availableProviders = new Set(
        Object.entries(access).flatMap(([providerId, configured]) => (configured ? [providerId] : [])),
      );
      // `mastra/` routes run through the Mastra gateway whenever a key is configured:
      // the caller's own (tenant mode) or the server's.
      if (access[MASTRA_GATEWAY_CATALOG_PROVIDER] || MastraCodeGateway.getMastraGatewayApiKey()) {
        availableProviders.add(MASTRA_GATEWAY_PROVIDER);
      }
      if (options.customProviders) {
        const customProviders = await listCustomProvidersInEffect({
          c: loose(c),
          auth,
          customProviders: options.customProviders,
          tenant: customProviderTenant,
        });
        for (const provider of customProviders) availableProviders.add(provider.providerId);
      }
      return { availableProviders };
    };

    // Without a live session, Auto previews against the factory default model
    // (resolved with this account's providers in readStoredOMConfig) — not the
    // global built-in default, whose provider may have no credential here.
    const factoryOmFallback = async (factoryProjectId: string | undefined): Promise<string | undefined> => {
      try {
        return factoryProjectId
          ? await options.factoryProjects
              ?.getById({ id: factoryProjectId })
              .then(project => project?.defaultModelId ?? undefined)
          : controller.listModes?.().find(mode => mode.defaultModelId)?.defaultModelId;
      } catch {
        return undefined;
      }
    };

    return [
      ...modelPackRoutes(options, resolveSessionModelContext),
      registerApiRoute('/web/config/features', {
        method: 'GET',
        requiresAuth: false,
        handler: async c =>
          c.json({ knowledge: options.features?.knowledge ?? false, mcp: options.features?.mcp ?? false }),
      }),

      registerApiRoute('/web/config/versions', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          await auth.ensureUser(loose(c));
          if (!auth.tenant(loose(c)) && auth.enabled()) return c.json({ error: 'unauthorized' }, 401);
          const packages = await (options.readPackages ?? readRunningPackages)();
          return c.json({ packages, nodeVersion: process.version });
        },
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
            const customProviders = options.customProviders;
            const listCustomProviders = customProviders
              ? async () => {
                  const ctx = await resolveCustomProvidersContext({ c: loose(c), auth, customProviders });
                  if ('response' in ctx) return [];
                  return (await listScopedCustomProviders(ctx)).filter(({ record }) => isCallable(record));
                }
              : undefined;
            return c.json({
              providers: await listProviders({
                controller,
                authStorage: tenantCredentials ? undefined : authStorage,
                tenantCredentials,
                deploymentProviders,
                listCustomProviders,
                connectWithMastraAccount,
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
              const providers = await listTenantProviders(records);
              return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
            }
            if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
            // Local mode is single-user: scope is meaningless and ignored.
            authStorage.setStoredApiKey(provider, key, envVar);
            controller.invalidateAvailableModelsCache?.();
            const providers = await listProviders({ controller, authStorage });
            return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute(`/web/config/providers/${MASTRA_GATEWAY_CATALOG_PROVIDER}/connect`, {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: options.modelCredentials });
          if ('response' in ctx) return ctx.response;
          if (ctx.mode !== 'tenant') return c.json({ error: MASTRA_SIGN_IN_REQUIRED }, 400);
          let body: { scope?: unknown };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const scope = body.scope === 'org' ? 'org' : 'user';
          if (scope === 'org' && !(await auth.isOrganizationAdmin(loose(c), ctx.orgId))) {
            return c.json({ error: 'organization_admin_required' }, 403);
          }
          const tenant = scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
          try {
            // A server with its own gateway key does not offer this connect. Never mint a
            // second key there, even for a client that still calls the route.
            const serverHasKey = Boolean(MastraCodeGateway.getMastraGatewayApiKey());
            if (!serverHasKey && !(await ctx.storage.getCredential(tenant, MASTRA_GATEWAY_PROVIDER))) {
              const apiKey = await createGatewayKey(auth, loose(c), ctx.orgId, scope);
              await ctx.storage.setCredential(tenant, MASTRA_GATEWAY_PROVIDER, { type: 'api_key', key: apiKey });
              onCredentialsChanged(tenant);
            }
            const providers = await listTenantProviders(await ctx.storage.listCredentials(ctx.orgId, ctx.userId));
            return c.json({ ok: true, provider: providers.find(p => p.provider === MASTRA_GATEWAY_CATALOG_PROVIDER) });
          } catch (error) {
            return gatewayFailure(loose(c), error);
          }
        },
      }),

      registerApiRoute(`/web/config/providers/${MASTRA_GATEWAY_CATALOG_PROVIDER}/credits`, {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const ctx = await resolveCredentialContext({ c: loose(c), auth, credentials: options.modelCredentials });
          if ('response' in ctx) return ctx.response;
          if (ctx.mode !== 'tenant') return c.json({ error: MASTRA_SIGN_IN_REQUIRED }, 400);
          try {
            return c.json(await getGatewayCredits(auth, loose(c), ctx.orgId));
          } catch (error) {
            return gatewayFailure(loose(c), error);
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
              const providers = await listTenantProviders(await ctx.storage.listCredentials(ctx.orgId, ctx.userId));
              return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
            }
            if (!authStorage) return c.json({ error: 'Credential storage is not available' }, 503);
            authStorage.removeStoredApiKey(provider);
            controller.invalidateAvailableModelsCache?.();
            const providers = await listProviders({ controller, authStorage });
            return c.json({ ok: true, provider: providers.find(p => p.provider === provider) });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // Mirrors the TUI's /custom-providers command, but backed by the
      // `custom-providers` domain — the server never reads settings.json for
      // these. Like provider keys, each one is saved at a scope: the caller's
      // own (`user`, the default) or their organization's (`org`).

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
            return c.json({ providers: (await listScopedCustomProviders(ctx)).map(toCustomProviderInfo) });
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
          if ('error' in parsed) return c.json(parsed, 400);
          const urlProblem = customEndpointUrlProblem(parsed.url);
          if (urlProblem) return c.json({ error: 'custom_endpoint_url_refused', message: urlProblem }, 400);
          const target = await resolveCustomProviderWrite(loose(c), ctx, parsed.scope);
          if ('response' in target) return target.response;
          const input: CustomProviderInput = {
            providerId: getCustomProviderId(parsed.name),
            name: parsed.name,
            url: parsed.url,
            apiKey: parsed.apiKey,
            authScheme: parsed.authScheme,
            headers: parsed.headers,
            models: parsed.models,
          };
          try {
            // A custom provider that took a built-in provider's id would
            // silently replace it for everyone using this list. No-auth mode
            // is single-user and its catalog already lists these providers.
            if (auth.enabled() && (await isReservedProviderId(controller, input.providerId))) {
              return c.json(
                {
                  error: 'provider_name_taken',
                  message: `"${parsed.name}" is reserved for a built-in provider. Choose another name.`,
                },
                409,
              );
            }
            let checked: CustomProviderRecord | undefined;
            if (parsed.check) {
              // Refuse a name already in use before the test calls the endpoint.
              // The unique index still settles a create or rename racing this one.
              if (
                input.providerId !== parsed.previousId &&
                (await ctx.storage.get({ owner: target.owner, providerId: input.providerId }))
              ) {
                const { status, body: refusal } = customProviderRefusal({ refused: 'name_taken' });
                return c.json(refusal, status);
              }
              const saved = parsed.previousId
                ? await ctx.storage.get({ owner: target.owner, providerId: parsed.previousId })
                : null;
              if (parsed.previousId && !saved) {
                const { status, body: refusal } = customProviderRefusal({ refused: 'not_found' });
                return c.json(refusal, status);
              }
              // The test sends what the write would store, saved secrets included,
              // and the origin rules refuse a draft before anything is sent.
              const resolved = customProviderConnection(saved, input);
              if ('refused' in resolved) {
                const { status, body: refusal } = customProviderRefusal(resolved);
                return c.json(refusal, status);
              }
              const result = await listCustomProviderModels(resolved.connection, customProviderCheckOptions());
              if (!result.ok) {
                return c.json(
                  {
                    error: 'custom_endpoint_check_failed',
                    message: 'The connection test failed, so the provider was not saved.',
                    failure: result.failure,
                  } satisfies CustomProviderCheckFailedResponse,
                  422,
                );
              }
              input.lastCheck = { at: new Date().toISOString(), ok: true };
              checked = saved ?? undefined;
            }
            const write = parsed.previousId
              ? await ctx.storage.update({ owner: target.owner, providerId: parsed.previousId, input, checked })
              : await ctx.storage.create({ owner: target.owner, createdBy: ctx.userId, input });
            if ('refused' in write) {
              const { status, body: refusal } = customProviderRefusal(write);
              return c.json(refusal, status);
            }
            customProvidersChanged(target.owner.orgId);
            return c.json({ ok: true, provider: toCustomProviderInfo({ record: write.saved, scope: target.scope }) });
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
          const target = await resolveCustomProviderWrite(loose(c), ctx, c.req.query('scope'));
          if ('response' in target) return target.response;
          try {
            if (!(await ctx.storage.delete({ owner: target.owner, providerId: id }))) {
              const { status, error, message } = CUSTOM_PROVIDER_REFUSALS.not_found;
              return c.json({ error, message }, status);
            }
            customProvidersChanged(target.owner.orgId);
            return c.json({ ok: true });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // Calls an endpoint the way a session would, without running one. Checks
      // follow the write permission of the list they address, because a check
      // sends that list's saved key and headers.
      registerApiRoute('/web/config/custom-providers/check', {
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
          const parsed = parseCustomProviderCheckBody(body);
          if ('error' in parsed) return c.json(parsed, 400);
          const target = await resolveCustomProviderWrite(loose(c), ctx, parsed.scope);
          if ('response' in target) return target.response;
          try {
            const saved = parsed.previousId
              ? await ctx.storage.get({ owner: target.owner, providerId: parsed.previousId })
              : null;
            if (parsed.previousId && !saved) {
              const { status, body: refusal } = customProviderRefusal({ refused: 'not_found' });
              return c.json(refusal, status);
            }
            // Without a draft the saved row is checked as stored: its own URL
            // keeps every saved setting. Such a request always names a row,
            // and a missing one was answered with a 404 above.
            const draft = parsed.kind === 'draft' ? parsed.draft : { url: saved!.url };
            // A row saved before this rule may still hold such a URL. It stays as
            // saved, but is never called.
            if (hasQueryOrFragment(draft.url)) return c.json({ error: QUERY_OR_FRAGMENT_REFUSED }, 400);
            const urlProblem = customEndpointUrlProblem(draft.url);
            if (urlProblem) return c.json({ error: 'custom_endpoint_url_refused', message: urlProblem }, 400);
            const resolved = customProviderConnection(saved, draft);
            if ('refused' in resolved) {
              const { status, body: refusal } = customProviderRefusal(resolved);
              return c.json(refusal, status);
            }
            const checkOptions = customProviderCheckOptions();
            const [models, reply] = await Promise.all([
              listCustomProviderModels(resolved.connection, checkOptions),
              parsed.model
                ? testCustomProviderModel(
                    {
                      providerId: saved?.providerId ?? 'custom-endpoint',
                      connection: resolved.connection,
                      modelId: parsed.model,
                    },
                    checkOptions,
                  )
                : undefined,
            ]);
            let provider: CustomProviderInfo | undefined;
            if (parsed.kind === 'saved' && saved) {
              const recorded = await ctx.storage.recordCheck({
                owner: target.owner,
                providerId: saved.providerId,
                checked: saved,
                lastCheck: {
                  at: new Date().toISOString(),
                  ok: models.ok,
                  ...(models.ok ? {} : { message: models.failure.message }),
                },
              });
              if (recorded) provider = toCustomProviderInfo({ record: recorded, scope: target.scope });
            }
            return c.json({
              ok: true,
              check: { models, ...(reply ? { reply } : {}) },
              ...(provider ? { provider } : {}),
            } satisfies CustomProviderCheckResponse);
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // Session-independent model catalog for settings pickers (Factory default
      // model, pack editors). Only models whose provider has a credential are
      // returned — the same filter the session-scoped hook applies client-side.

      registerApiRoute('/web/config/models', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          try {
            const allTenantCredentials = await listTenantCredentialsForRequest({
              c: loose(c),
              auth,
              credentials: options.modelCredentials,
            });
            const factoryProjectId = c.req.query('factoryId') || undefined;
            const tenant = auth.tenant(c);
            let tenantCredentials = allTenantCredentials;
            let sessionPolicy: Omit<SessionModelPolicy, 'models'> | SessionModelPackSelection | undefined;
            let credentialTenant: CredentialTenant | undefined;
            let sessionTenant: CredentialTenant | undefined;
            const resourceId = c.req.query('resourceId');
            const threadId = c.req.query('threadId');
            const sessionId = c.req.query('sessionId');
            if (resourceId !== undefined || threadId !== undefined || sessionId !== undefined) {
              // A caller that names no session addresses it by the resource, which is
              // the session id for sessions that run under their own resource.
              const address = sessionAddressSchema.safeParse({ resourceId, threadId, sessionId });
              if (!address.success) return c.json({ error: 'invalid_session_context' }, 400);
              const context = await resolveSessionModelContext(c, address.data);
              if (context && 'response' in context) return context.response;
              const modelPackSet = await resolveSessionModelPackSet(options, c, address.data);
              const packSelection: SessionModelPackSelection = {
                modelPacks: modelPackSet.modelPacks,
                defaultModelPackId: modelPackSet.defaultModelPackId,
                modelSelection: await readSessionModelSelection(controller, address.data, modelPackSet),
              };
              sessionPolicy = packSelection;
              if (context) {
                tenantCredentials = context.tenantCredentials;
                sessionTenant = context.credentialTenant;
                sessionPolicy = {
                  ...packSelection,
                  modelScope: context.modelScope,
                  defaultModelId: context.defaultModelId,
                  personalThinkingLevel: context.personalThinkingLevel,
                };
              }
            } else if (c.req.query('scope') !== undefined) {
              // Explicit settings scopes never override a live thread's owner and policy above.
              const scope = z.enum(['org', 'user']).safeParse(c.req.query('scope'));
              if (!scope.success) return c.json({ error: 'invalid_model_scope' }, 400);
              tenantCredentials = allTenantCredentials?.filter(record => record.scope === scope.data);
              if (tenant) {
                credentialTenant = {
                  orgId: tenantOrgId(tenant),
                  userId: tenant.userId,
                  credentialScope: runScopeFor(scope.data),
                };
              }
            } else if (allTenantCredentials && factoryProjectId && tenant) {
              if (!options.factoryProjects) return c.json({ error: 'factory_unavailable' }, 503);
              await options.factoryProjects.ensureReady();
              const project = await options.factoryProjects.get({ orgId: tenantOrgId(tenant), id: factoryProjectId });
              if (!project) return c.json({ error: 'factory_project_not_found' }, 404);
              const storedScope = project.modelScope === 'user' ? 'user' : 'org';
              tenantCredentials = allTenantCredentials.filter(record => record.scope === storedScope);
              credentialTenant = {
                orgId: tenantOrgId(tenant),
                userId: tenant.userId,
                credentialScope: runScopeFor(storedScope),
              };
            }
            const customProviders = options.customProviders;
            const listCustomProviders = customProviders
              ? () =>
                  listCustomProvidersInEffect({
                    c: loose(c),
                    auth,
                    customProviders,
                    tenant: sessionTenant ?? credentialTenant,
                  })
              : undefined;
            const models = await buildModelCatalog({
              controller,
              authStorage,
              tenantCredentials,
              deploymentProviders,
              listCustomProviders,
            });
            if (!credentialTenant) return c.json({ ...sessionPolicy, models });
            const modeModelId = controller.getDefaultMode?.().defaultModelId;
            const candidate =
              (await resolveTenantProviderDefaultModel(credentialTenant, modeModelId).catch(error => {
                console.warn('[Factory Config] Failed to resolve a provider default model', {
                  error: error instanceof Error ? error.message : String(error),
                });
                return undefined;
              })) ?? modeModelId;
            const fallbackModelId = models.find(model => model.id === candidate)?.id ?? null;
            return c.json({ fallbackModelId, models });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // Mirrors the TUI's /om command. All five knobs are durably stored in the
      // per-(org, user) `memory-settings` app table — never settings.json or
      // mutable session state.

      registerApiRoute('/web/config/om', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const sessionId = c.req.query('sessionId');
          const threadId = c.req.query('threadId');
          const resourceId = c.req.query('resourceId');
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
            const responseContext = await resolveOMResponseContext(loose(c), {
              sessionId,
              threadId,
              resourceId,
              factoryProjectId,
            });
            if ('response' in responseContext) return responseContext.response;
            const session = sessionId ? await controller.getSession?.(sessionId) : undefined;
            const sessionModelId = session?.model.get();
            return c.json({
              config: readStoredOMConfig(
                record,
                sessionModelId || fallback,
                sessionModelId ? 'live-session' : 'configured-default',
                responseContext.availableProviders,
              ),
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
          let body: {
            sessionId?: unknown;
            threadId?: unknown;
            resourceId?: unknown;
            modelId?: unknown;
            factoryId?: unknown;
          };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
          const threadId = typeof body.threadId === 'string' ? body.threadId : undefined;
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : undefined;
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
          const responseContext = await resolveOMResponseContext(loose(c), {
            sessionId,
            threadId,
            resourceId,
            factoryProjectId,
          });
          if ('response' in responseContext) return responseContext.response;
          try {
            await persistMemorySettings(context, {
              [role === 'observer' ? 'observerModelId' : 'reflectorModelId']: wantsAuto ? null : model,
            });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = sessionId ? await controller.getSession?.(sessionId) : undefined;
            const sessionModelId = session?.model.get();
            const config = readStoredOMConfig(
              record,
              sessionModelId || (await factoryOmFallback(factoryProjectId)),
              sessionModelId ? 'live-session' : 'configured-default',
              responseContext.availableProviders,
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
            sessionId?: unknown;
            threadId?: unknown;
            resourceId?: unknown;
            observationThreshold?: unknown;
            reflectionThreshold?: unknown;
            factoryId?: unknown;
          };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
          const threadId = typeof body.threadId === 'string' ? body.threadId : undefined;
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : undefined;
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
          if (observation !== undefined && observation < MIN_OBSERVATION_THRESHOLD) {
            return c.json(
              { error: `observationThreshold must be greater than ${MIN_OBSERVATION_THRESHOLD - 1} tokens` },
              400,
            );
          }
          const context = await resolveMemorySettingsContext({
            c: loose(c),
            auth,
            memorySettings: options.memorySettings,
            factoryProjectId,
            factoryProjects: options.factoryProjects,
          });
          if ('response' in context) return context.response;
          const responseContext = await resolveOMResponseContext(loose(c), {
            sessionId,
            threadId,
            resourceId,
            factoryProjectId,
          });
          if ('response' in responseContext) return responseContext.response;
          try {
            await persistMemorySettings(context, {
              ...(observation !== undefined ? { observationThreshold: observation } : {}),
              ...(reflection !== undefined ? { reflectionThreshold: reflection } : {}),
            });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = sessionId ? await controller.getSession?.(sessionId) : undefined;
            const sessionModelId = session?.model.get();
            const config = readStoredOMConfig(
              record,
              sessionModelId || (await factoryOmFallback(factoryProjectId)),
              sessionModelId ? 'live-session' : 'configured-default',
              responseContext.availableProviders,
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
          let body: {
            sessionId?: unknown;
            threadId?: unknown;
            resourceId?: unknown;
            value?: unknown;
            factoryId?: unknown;
          };
          try {
            body = await c.req.json();
          } catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
          }
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
          const threadId = typeof body.threadId === 'string' ? body.threadId : undefined;
          const resourceId = typeof body.resourceId === 'string' ? body.resourceId : undefined;
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
          const responseContext = await resolveOMResponseContext(loose(c), {
            sessionId,
            threadId,
            resourceId,
            factoryProjectId,
          });
          if ('response' in responseContext) return responseContext.response;
          try {
            await persistMemorySettings(context, { observeAttachments: value });
            const record = await context.storage.get({ orgId: context.orgId, userId: context.userId });
            const session = sessionId ? await controller.getSession?.(sessionId) : undefined;
            const sessionModelId = session?.model.get();
            const config = readStoredOMConfig(
              record,
              sessionModelId || (await factoryOmFallback(factoryProjectId)),
              sessionModelId ? 'live-session' : 'configured-default',
              responseContext.availableProviders,
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
