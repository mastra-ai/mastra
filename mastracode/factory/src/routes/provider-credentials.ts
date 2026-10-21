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

import { factoryUserOrgId } from '../auth.js';
import { providerDisplayName } from '../provider-display-name.js';
import type {
  CredentialRecord,
  LoginSessionKind,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import type { RouteAuth } from './route.js';

/**
 * OAuth credentials are stored under the credential id, which differs from the
 * catalog provider id for OpenAI (`openai-codex`) and Kimi (`kimi-for-coding`).
 * Tenant rows use the same keying so one lookup serves both OAuth tokens and
 * API keys, and match what model resolution reads.
 */
export { getCredentialProviderId as getAuthProviderId } from '@mastra/code-sdk/providers/model-ids';

/**
 * Providers that support a browser-driven OAuth sign-in flow, keyed by
 * *catalog* provider id (what the routes and settings UI use). All flows need
 * no inbound connection to the server: Anthropic uses paste-code PKCE, the
 * rest use RFC 8628-style device codes. `subscription` names the plan the
 * sign-in bills, as shown under a reply and in the composer.
 */
export const WEB_OAUTH_PROVIDERS: Readonly<Record<string, { flow: LoginSessionKind; subscription: string }>> = {
  anthropic: { flow: 'paste-code', subscription: 'Claude Pro/Max' },
  openai: { flow: 'device-code', subscription: 'ChatGPT Plus/Pro' },
  'github-copilot': { flow: 'device-code', subscription: 'GitHub Copilot' },
  xai: { flow: 'device-code', subscription: 'SuperGrok/X Premium+' },
};

export function credentialLabel(provider: string, credentialType: CredentialRecord['credential']['type']) {
  return credentialType === 'api_key'
    ? `${providerDisplayName(provider)} API key`
    : WEB_OAUTH_PROVIDERS[provider]?.subscription;
}

export type CredentialContext =
  | { mode: 'local' }
  | { mode: 'tenant'; storage: ModelCredentialsStorage; orgId: string; userId: string };

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
  } catch (error) {
    // Callers degrade to "no credentials", so this log is the only trace of why.
    if (error !== lastReportedInitError) {
      lastReportedInitError = error;
      console.error('[factory] model credential storage is unavailable; providers will show as not set:', error);
    }
    return undefined;
  }
  return credentials;
}

let lastReportedInitError: unknown;

/**
 * Org key for tenant rows. Personal accounts get an org bootstrapped by the
 * auth adapter (`ensureOrg`); if one still isn't present, scope rows under a
 * per-user synthetic org so credentials never become server-global.
 */
export function tenantOrgId(tenant: { orgId?: string; userId: string }): string {
  return tenant.orgId ?? factoryUserOrgId({ id: tenant.userId }) ?? `user:${tenant.userId}`;
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
