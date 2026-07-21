/**
 * Per-request model-provider credential context.
 *
 * The provider config/OAuth routes serve two deployment shapes:
 *
 * - **Local** (no web auth adapter): credentials live in the server-global
 *   file-backed `AuthStorage` (`auth.json`) — unchanged TUI behavior.
 * - **Tenant** (auth adapter active): credentials live in the
 *   `model-credentials` factory storage domain, scoped per `(orgId, userId)`
 *   with optional org-wide rows (`userId` absent).
 *
 * `resolveCredentialContext` decides which shape a request is in: an
 * authenticated user always gets the tenant path; an unauthenticated request
 * is rejected when auth is enabled and falls back to local otherwise.
 */

import type { Context } from 'hono';

import type { CredentialRecord, LoginSessionKind, ModelCredentialsStorage } from '../storage/domains/credentials/base';
import type { RouteAuth } from './route';

/**
 * OAuth credentials are stored under the auth provider id, which differs from
 * the catalog provider id for OpenAI (stored as `openai-codex`). Tenant rows
 * use the same keying so one lookup serves both OAuth tokens and API keys.
 */
export function getAuthProviderId(provider: string): string {
  return provider === 'openai' ? 'openai-codex' : provider;
}

/**
 * Providers that support a browser-driven OAuth sign-in flow, keyed by
 * *catalog* provider id (what the routes and settings UI use). All flows need
 * no inbound connection to the server: Anthropic uses paste-code PKCE, the
 * rest use RFC 8628-style device codes.
 */
export const WEB_OAUTH_FLOW_KINDS: Readonly<Record<string, LoginSessionKind>> = {
  anthropic: 'paste-code',
  openai: 'device-code',
  'github-copilot': 'device-code',
  xai: 'device-code',
};

export type CredentialContext =
  { mode: 'local' } | { mode: 'tenant'; storage: ModelCredentialsStorage; orgId: string; userId: string };

/**
 * The tenant credentials domain, when registered and ready. `undefined` means
 * the factory never ran (no handle threaded in) or the domain's init failed
 * (fail-soft — callers report the feature unavailable instead of crashing).
 */
export async function getTenantCredentialsStorage(
  credentials: ModelCredentialsStorage | undefined,
): Promise<ModelCredentialsStorage | undefined> {
  if (!credentials) return undefined;
  try {
    await credentials.ensureReady();
  } catch {
    return undefined;
  }
  return credentials;
}

/**
 * Org key for tenant rows. Personal accounts get an org bootstrapped by the
 * auth adapter (`ensureOrg`); if one still isn't present, scope rows under a
 * per-user synthetic org so credentials never become server-global.
 */
export function tenantOrgId(tenant: { orgId?: string; userId: string }): string {
  return tenant.orgId ?? `user:${tenant.userId}`;
}

/**
 * Resolve the credential context for a request, or a ready-to-return error
 * response. Mutating credential routes call this and hard-fail (401/503)
 * when the tenant path is required but unavailable.
 */
export async function resolveCredentialContext({
  c,
  auth,
  credentials,
}: {
  c: Context;
  auth: RouteAuth;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  credentials?: ModelCredentialsStorage;
}): Promise<CredentialContext | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) {
    // When an auth provider is active, credential operations always require a
    // signed-in caller — otherwise one anonymous request could write keys for
    // everyone. Without a provider this is a single-user local server.
    if (auth.enabled()) return { response: c.json({ error: 'unauthorized' }, 401) };
    return { mode: 'local' };
  }
  const storage = await getTenantCredentialsStorage(credentials);
  if (!storage) {
    return {
      response: c.json(
        {
          error: 'credentials_unavailable',
          message: 'Tenant credential storage is unavailable — the app database is not configured or failed to start.',
        },
        503,
      ),
    };
  }
  return { mode: 'tenant', storage, orgId: tenantOrgId(tenant), userId: tenant.userId };
}

/**
 * List the caller's tenant credential records for provider listing, or
 * `undefined` in local mode (caller should fall back to `AuthStorage`).
 * Read-only and degradation-friendly: an authenticated caller with the domain
 * unavailable gets an empty list (sources show `env`/`none`) instead of a 503
 * so the settings page still renders.
 */
export async function listTenantCredentialsForRequest({
  c,
  auth,
  credentials,
}: {
  c: Context;
  auth: RouteAuth;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  credentials?: ModelCredentialsStorage;
}): Promise<CredentialRecord[] | undefined> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) return auth.enabled() ? [] : undefined;
  const storage = await getTenantCredentialsStorage(credentials);
  if (!storage) return [];
  return storage.listCredentials(tenantOrgId(tenant), tenant.userId);
}
