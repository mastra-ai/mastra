/**
 * Org-scoped Linear connection loading and OAuth token lifecycle.
 *
 * Shared between the Linear API routes (intake UI) and the Linear agent tools
 * (issue context for factory runs). Both surfaces resolve the same org-owned
 * connection row and need the same proactive refresh + single-flight rotation
 * semantics, so the logic lives here rather than in either consumer.
 */

import type { LinearIntegration, LinearTokenSet } from './integration';
import { getLinearConnection, updateLinearTokens } from './storage';
import type { LinearConnectionRow } from './storage';

/** Load the org's Linear connection, or `null` when not connected. */
export function loadLinearConnection(orgId: string): Promise<LinearConnectionRow | null> {
  return getLinearConnection(orgId);
}

/** Refresh this many ms before the recorded expiry to absorb clock skew. */
const TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * In-flight refreshes keyed by org. Linear rotates refresh tokens, so two
 * concurrent refreshes with the same token would invalidate each other —
 * single-flight ensures one exchange per org and shares the result.
 */
const inflightRefreshes = new Map<string, Promise<string>>();

/** Thrown when the org's Linear authorization can no longer be renewed. */
export class LinearReauthRequiredError extends Error {
  constructor() {
    super('Linear authorization expired. Reconnect Linear to keep syncing intake issues.');
  }
}

/** Distinguishes an external token-refresh failure from internal connection storage failures. */
export class LinearProviderUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Linear token refresh failed.', { cause });
    this.name = 'LinearProviderUnavailableError';
  }
}

/** Persist a rotated token set on the org's connection row. */
export function persistLinearTokens(orgId: string, tokens: LinearTokenSet): Promise<void> {
  return updateLinearTokens(orgId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  });
}

/**
 * Whether the connection's token can post issue comments. Legacy rows without
 * a recorded scope were minted with `read` only, so they count as read-only
 * until the org reconnects Linear.
 */
export function canPostLinearComments(connection: LinearConnectionRow): boolean {
  const scopes = (connection.scope ?? '').split(/[\s,]+/).filter(Boolean);
  return scopes.some(scope => scope === 'comments:create' || scope === 'write' || scope === 'admin');
}

/**
 * Return a usable access token for the connection, proactively refreshing it
 * (through the integration's OAuth client) when the recorded expiry is past
 * (or imminent). Throws `LinearReauthRequiredError` when the token is expired
 * and cannot be refreshed — the org has to go through the OAuth flow again.
 */
export async function getFreshLinearAccessToken(
  linear: Pick<LinearIntegration, 'refreshAccessToken'>,
  connection: LinearConnectionRow,
): Promise<string> {
  const expired = connection.expiresAt !== null && connection.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now();
  if (!expired) return connection.accessToken;

  if (!connection.refreshToken) {
    // Legacy row from before refresh-token support: nothing to renew with.
    throw new LinearReauthRequiredError();
  }

  const existing = inflightRefreshes.get(connection.orgId);
  if (existing) return existing;

  // The caller may hold a stale row: another request could have refreshed and
  // rotated the refresh token since this row was loaded. Reload before
  // refreshing so we don't burn the rotated token and force a false reauth.
  const latest = await loadLinearConnection(connection.orgId);
  if (!latest) throw new LinearReauthRequiredError();

  const concurrent = inflightRefreshes.get(connection.orgId);
  if (concurrent) return concurrent;

  const latestExpired = latest.expiresAt !== null && latest.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now();
  if (!latestExpired) return latest.accessToken;
  if (!latest.refreshToken) throw new LinearReauthRequiredError();

  const refreshToken = latest.refreshToken;
  const refresh = (async () => {
    try {
      let tokens: LinearTokenSet;
      try {
        tokens = await linear.refreshAccessToken(refreshToken);
      } catch (err) {
        const status = (err as { status?: number }).status;
        // invalid_grant surfaces as 400/401: the refresh token was revoked or
        // already rotated away. Terminal for this connection.
        if (status === 400 || status === 401) throw new LinearReauthRequiredError();
        throw new LinearProviderUnavailableError(err);
      }
      await persistLinearTokens(connection.orgId, tokens);
      return tokens.accessToken;
    } finally {
      inflightRefreshes.delete(connection.orgId);
    }
  })();
  inflightRefreshes.set(connection.orgId, refresh);
  return refresh;
}
