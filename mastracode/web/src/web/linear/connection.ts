/**
 * Org-scoped Linear connection loading and OAuth token lifecycle.
 *
 * Shared between the Linear API routes (intake UI) and the Linear agent tools
 * (issue context for factory runs). Both surfaces resolve the same org-owned
 * connection row and need the same proactive refresh + single-flight rotation
 * semantics, so the logic lives here rather than in either consumer.
 */

import { eq } from 'drizzle-orm';

import { getAppDb } from '../github/db';
import { refreshLinearAccessToken } from './client';
import type { LinearTokenSet } from './client';
import { linearConnections } from './schema';
import type { LinearConnectionRow } from './schema';

/** Load the org's Linear connection, or `null` when not connected. */
export async function loadLinearConnection(orgId: string): Promise<LinearConnectionRow | null> {
  const [row] = await getAppDb().select().from(linearConnections).where(eq(linearConnections.orgId, orgId));
  return row ?? null;
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

/** Persist a rotated token set on the org's connection row. */
export async function persistLinearTokens(orgId: string, tokens: LinearTokenSet): Promise<void> {
  await getAppDb()
    .update(linearConnections)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(linearConnections.orgId, orgId));
}

/**
 * Return a usable access token for the connection, proactively refreshing it
 * when the recorded expiry is past (or imminent). Throws
 * `LinearReauthRequiredError` when the token is expired and cannot be
 * refreshed — the org has to go through the OAuth flow again.
 */
export async function getFreshLinearAccessToken(connection: LinearConnectionRow): Promise<string> {
  const expired = connection.expiresAt !== null && connection.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now();
  if (!expired) return connection.accessToken;

  if (!connection.refreshToken) {
    // Legacy row from before refresh-token support: nothing to renew with.
    throw new LinearReauthRequiredError();
  }

  const existing = inflightRefreshes.get(connection.orgId);
  if (existing) return existing;

  const refreshToken = connection.refreshToken;
  const refresh = (async () => {
    try {
      const tokens = await refreshLinearAccessToken(refreshToken);
      await persistLinearTokens(connection.orgId, tokens);
      return tokens.accessToken;
    } catch (err) {
      const status = (err as { status?: number }).status;
      // invalid_grant surfaces as 400/401: the refresh token was revoked or
      // already rotated away. Terminal for this connection.
      if (status === 400 || status === 401) throw new LinearReauthRequiredError();
      throw err;
    } finally {
      inflightRefreshes.delete(connection.orgId);
    }
  })();
  inflightRefreshes.set(connection.orgId, refresh);
  return refresh;
}
