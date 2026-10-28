/**
 * Per-tenant credential resolution seam for deployed (multi-user) servers.
 *
 * Locally, model resolution reads the server-global file-backed `AuthStorage`.
 * A deployed web host registers a {@link CredentialStoreProvider} at boot; from
 * then on `resolveModel` uses the host's trusted execution policy, never mutable
 * session state. Factory scope reads organization credentials only. User scope reads
 * the Factory session owner's credentials only, or the authenticated principal
 * for project-less personal sessions.
 *
 * When no provider is registered (TUI, local web), everything falls through to
 * the existing global behavior unchanged.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { CredentialStore } from '../auth/types.js';

export type CredentialScope = 'factory' | 'user';

/** The identity and exclusive scope a credential lookup is resolved against. */
export interface CredentialTenant {
  /** Org tenant; absent for personal accounts (store impls may synthesize one). */
  orgId?: string;
  /** Stable user id used for user-scoped credentials and tenant cache keys. */
  userId: string;
  /** Exclusive credential scope for this request. */
  credentialScope: CredentialScope;
}

/**
 * Returns a tenant-scoped {@link CredentialStore}, or `undefined` when tenant
 * storage is unavailable. Must be synchronous — implementations serve from a
 * primed snapshot and do authoritative async work inside `getApiKey`.
 */
export type CredentialStoreProvider = (tenant: CredentialTenant) => CredentialStore | undefined;

export type CredentialTenantResolver = (requestContext: RequestContext) => Promise<CredentialTenant | undefined>;

export type CredentialTenantFailureReason =
  | 'missing-user-context'
  | 'invalid-organization-id'
  | 'no-policy-for-principal';

const CREDENTIAL_TENANT_FAILURES: Record<CredentialTenantFailureReason, string> = {
  'missing-user-context':
    'Tenant model credential policy could not be resolved: the request has no authenticated user.',
  'invalid-organization-id':
    "Tenant model credential policy could not be resolved: the authenticated user's organization id is not a string.",
  'no-policy-for-principal':
    'Tenant model credential policy could not be resolved: no credential policy applies to this request.',
};

class CredentialTenantError extends Error {
  override readonly name = 'CredentialTenantError';

  constructor(readonly reason: CredentialTenantFailureReason) {
    super(CREDENTIAL_TENANT_FAILURES[reason]);
  }
}

function isCredentialTenantFailureReason(value: unknown): value is CredentialTenantFailureReason {
  return typeof value === 'string' && Object.hasOwn(CREDENTIAL_TENANT_FAILURES, value);
}

export function credentialTenantFailureReason(error: unknown): CredentialTenantFailureReason | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.name === 'CredentialTenantError' && 'reason' in error && isCredentialTenantFailureReason(error.reason)) {
    return error.reason;
  }
  // A run's error reaches its session through core's run-failed event as the message alone.
  return Object.keys(CREDENTIAL_TENANT_FAILURES)
    .filter(isCredentialTenantFailureReason)
    .find(reason => CREDENTIAL_TENANT_FAILURES[reason] === error.message);
}

const CREDENTIAL_POLICY_KEY = 'mastracode__credentialPolicy';
let credentialStoreProvider: CredentialStoreProvider | undefined;
let credentialTenantResolver: CredentialTenantResolver | undefined;
let trustedTenants = new WeakMap<object, { tenant?: CredentialTenant; sourceContext: RequestContext }>();

type CredentialLogger = { error(message: string, meta?: Record<string, unknown>): void };
const consoleLogger: CredentialLogger = { error: (message, meta) => console.error(message, meta) };
let logger: CredentialLogger = consoleLogger;

/** Route credential failures to the host's logger (e.g. Mastra's), so they reach deployed log sinks. */
export function setCredentialLogger(next: CredentialLogger | undefined): void {
  logger = next ?? consoleLogger;
}

const unavailableTenantCredentialStore: CredentialStore = {
  allowEnvironmentFallback: false,
  reload() {},
  get() {
    return undefined;
  },
  getStoredApiKey() {
    return undefined;
  },
  async getApiKey() {
    return undefined;
  },
};

/** Register (or clear) the tenant credential store provider. Deployed-web only. */
export function setCredentialStoreProvider(
  provider: CredentialStoreProvider | undefined,
  resolveTenant?: CredentialTenantResolver,
): void {
  credentialStoreProvider = provider;
  credentialTenantResolver = provider ? resolveTenant : undefined;
  trustedTenants = new WeakMap();
}

/** Refresh authority before a fresh model invocation; cloned contexts inherit only an opaque token. */
export async function prepareCredentialTenant(requestContext?: RequestContext): Promise<void> {
  if (!credentialTenantResolver) return;
  if (!requestContext) throw new Error('Tenant model resolution requires a request context.');
  const inheritedToken = requestContext.get(CREDENTIAL_POLICY_KEY);
  const inheritedPolicy =
    inheritedToken && typeof inheritedToken === 'object' ? trustedTenants.get(inheritedToken) : undefined;
  // Subagents and internal memory contexts can strip the controller's thread identity.
  // Keep their billing origin outside those mutable context fields.
  const sourceController = inheritedPolicy?.sourceContext.get('controller') as { resourceId?: string } | undefined;
  const sourceContext =
    inheritedPolicy && sourceController?.resourceId ? inheritedPolicy.sourceContext : requestContext;
  const token = {};
  requestContext.set(CREDENTIAL_POLICY_KEY, token);
  trustedTenants.set(token, { sourceContext });
  const tenant = await credentialTenantResolver(sourceContext);
  if (!tenant) throw unresolvedTenantError(sourceContext, Boolean(inheritedPolicy));
  trustedTenants.set(token, { tenant, sourceContext });
}

/**
 * Explain a failed tenant resolution. The message is safe to show the end user
 * (channels post it into the chat); the warning carries non-secret diagnostics
 * and the stack, which is what locates a caller that dropped the request context.
 */
function unresolvedTenantError(sourceContext: RequestContext, inherited: boolean): CredentialTenantError {
  const principal = readPrincipal(sourceContext);
  const error = new CredentialTenantError('tenant' in principal ? 'no-policy-for-principal' : principal.failure);
  const controller = sourceContext.get('controller') as { resourceId?: unknown; threadId?: unknown } | undefined;
  logger.error('[MastraCode] Tenant model credential policy could not be resolved', {
    reason: error.reason,
    hasUser: sourceContext.get('user') !== undefined,
    inheritedPolicy: inherited,
    hasControllerResource: typeof controller?.resourceId === 'string',
    hasControllerThread: typeof controller?.threadId === 'string',
    // Ids and key names only: the stack loses the caller across async hops, so
    // these identify which session and which kind of start built the context.
    resourceId: typeof controller?.resourceId === 'string' ? controller.resourceId : undefined,
    threadId: typeof controller?.threadId === 'string' ? controller.threadId : undefined,
    contextKeys: Array.from(sourceContext.keys()).map(String),
    stack: error.stack,
  });
  return error;
}

export function withCredentialTenantPreparation<T>(
  resolve: (ctx: { requestContext: RequestContext }) => T | Promise<T>,
) {
  return async (ctx: { requestContext: RequestContext }): Promise<T> => {
    await prepareCredentialTenant(ctx.requestContext);
    return resolve(ctx);
  };
}

/**
 * Whether a tenant provider is registered. Used to disable the
 * `loadStoredApiKeysIntoEnv` side-channel in deployed mode — per-tenant
 * credentials must never leak into process-global env vars.
 */
export function hasCredentialStoreProvider(): boolean {
  return credentialStoreProvider !== undefined;
}

export function hasCredentialTenantResolver(): boolean {
  return credentialTenantResolver !== undefined;
}

/** Shape the web auth gate stashes on the request context under `user`. */
interface RequestContextUser {
  workosId?: string;
  id?: string;
  organizationId?: string;
}

/**
 * Session-shaped `authenticateToken` results (better-auth) arrive as a wrapper
 * whose active org lives on the session half rather than on the user.
 */
interface RequestContextSession {
  user?: RequestContextUser;
  session?: { activeOrganizationId?: string };
}

export function resolveCredentialScope(requestContext?: RequestContext): CredentialScope {
  return resolveTenantFromRequestContext(requestContext)?.credentialScope ?? 'user';
}

/**
 * Derive the calling tenant from a request context, if an authenticated web
 * user was stashed on it. Mirrors the web layer's stable-id resolution
 * (`workosId` falling back to the provider `id`).
 *
 * Session state and HTTP-supplied policy values never establish credential authority.
 */
export function resolveTenantFromRequestContext(requestContext?: RequestContext): CredentialTenant | undefined {
  if (!credentialTenantResolver) return resolveAuthenticatedCredentialTenant(requestContext);
  const token = requestContext?.get(CREDENTIAL_POLICY_KEY);
  return token && typeof token === 'object' ? trustedTenants.get(token)?.tenant : undefined;
}

/** Authenticated principal only, for hosts resolving durable session ownership. */
export function resolveAuthenticatedCredentialTenant(requestContext?: RequestContext): CredentialTenant | undefined {
  const principal = readPrincipal(requestContext);
  return 'tenant' in principal ? principal.tenant : undefined;
}

function readPrincipal(
  requestContext?: RequestContext,
): { tenant: CredentialTenant } | { failure: Exclude<CredentialTenantFailureReason, 'no-policy-for-principal'> } {
  const raw = requestContext?.get('user') as (RequestContextUser & RequestContextSession) | undefined;
  if (!raw || typeof raw !== 'object') return { failure: 'missing-user-context' };

  // Precedence matches `toFactoryAuthUser` in `@mastra/factory`: a wrapper's org
  // comes from the session half only, never from the inner user.
  const wrapped = Boolean(raw.user && typeof raw.user === 'object' && raw.session && typeof raw.session === 'object');
  const user = wrapped ? (raw.user as RequestContextUser) : raw;
  const principalOrgId = wrapped ? raw.session?.activeOrganizationId : user.organizationId;
  const principalUserId = user.workosId ?? user.id;
  if (typeof principalUserId !== 'string' || !principalUserId) return { failure: 'missing-user-context' };
  if (principalOrgId !== undefined && typeof principalOrgId !== 'string') return { failure: 'invalid-organization-id' };

  return { tenant: { orgId: principalOrgId, userId: principalUserId, credentialScope: 'user' } };
}

/**
 * Resolve the credential store for a request. Local mode returns `undefined`
 * and keeps the global `AuthStorage` behavior. Once deployed web registers a
 * provider, missing tenant identity or unavailable tenant storage fails closed
 * through an empty store that also disables process-environment fallback.
 */
export function resolveCredentialStore(requestContext?: RequestContext): CredentialStore | undefined {
  if (!credentialStoreProvider) return undefined;
  const tenant = resolveTenantFromRequestContext(requestContext);
  if (!tenant) {
    const rawUser = requestContext?.get('user');
    logger.error('[MastraCode] Tenant credential resolution failed closed', {
      reason: rawUser === undefined ? 'missing-user-context' : 'credential-policy-unavailable',
      hasRequestContext: requestContext !== undefined,
    });
    return unavailableTenantCredentialStore;
  }
  const store = credentialStoreProvider(tenant);
  if (!store) {
    logger.error('[MastraCode] Tenant credential resolution failed closed', {
      reason: 'credential-store-unavailable',
      hasOrganization: tenant.orgId !== undefined,
      credentialScope: tenant.credentialScope,
      ownerResolved: tenant.credentialScope === 'factory' || tenant.userId !== undefined,
    });
    return unavailableTenantCredentialStore;
  }
  return store;
}
