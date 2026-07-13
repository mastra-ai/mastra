/**
 * Mastra `apiRoutes` for the Linear intake feature.
 *
 * Registered alongside the other `/web/*` routes, behind the WorkOS auth gate.
 * Mirrors the GitHub module: every route re-resolves the authenticated user
 * from the request cookie and scopes all rows by the caller's WorkOS org, so an
 * org can only ever see its own Linear connection and issues.
 *
 * When the feature is disabled (`isLinearFeatureEnabled()` false),
 * `buildLinearRoutes` returns only `GET /web/linear/status`, which reports
 * `enabled:false` so the SPA can cleanly hide all Linear UI.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';

import { ensureWebAuthUser, webAuthTenant } from '../auth';
import type { WebAuthTenant } from '../auth';
import { signState, verifyState } from '../github/config';
import { getAppDb } from '../github/db';
import {
  buildLinearAuthorizeUrl,
  exchangeLinearOAuthCode,
  fetchLinearWorkspace,
  listActiveLinearIssues,
  listLinearProjects,
  refreshLinearAccessToken,
} from './client';
import type { LinearTokenSet } from './client';
import { getIntakeConfig } from '../intake/store';
import { getLinearFeatureDiagnostics, isLinearFeatureEnabled } from './config';
import { linearConnections } from './schema';
import type { LinearConnectionRow } from './schema';

type RouteContext = Context;

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

export interface MountLinearRoutesOptions {
  /**
   * Absolute base URL of the web server (e.g. `http://localhost:4111`), used to
   * build the OAuth redirect URI when one isn't explicitly configured.
   */
  baseUrl?: string;
  /** Explicit OAuth callback URI; defaults to `<baseUrl>/auth/linear/callback`. */
  redirectUri?: string;
}

/**
 * Resolve the org-scoped tenant for a Linear request. The connection is
 * org-owned, so it requires both a signed-in user and a WorkOS organization —
 * same tenancy rules as the GitHub routes.
 */
async function resolveOrgTenant(
  c: RouteContext,
): Promise<{ tenant: WebAuthTenant & { orgId: string } } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'Linear intake requires a WorkOS organization. Personal accounts cannot connect Linear.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

/**
 * Validate an opaque Linear pagination cursor from the query string. Cursors
 * are server-issued (`pageInfo.endCursor`), so anything outside a conservative
 * charset/length is rejected rather than forwarded to Linear.
 */
function parseAfterCursor(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  if (raw.length > 512 || !/^[\w+/=.:-]+$/.test(raw)) return null;
  return raw;
}

/** Load the org's Linear connection, or `null` when not connected. */
async function loadConnection(orgId: string): Promise<LinearConnectionRow | null> {
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
class LinearReauthRequiredError extends Error {
  constructor() {
    super('Linear authorization expired. Reconnect Linear to keep syncing intake issues.');
  }
}

/** Persist a rotated token set on the org's connection row. */
async function persistTokens(orgId: string, tokens: LinearTokenSet): Promise<void> {
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
async function getFreshAccessToken(connection: LinearConnectionRow): Promise<string> {
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
      await persistTokens(connection.orgId, tokens);
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

/** Map a Linear read failure to the API response for the SPA. */
function linearFetchError(c: RouteContext, err: unknown) {
  if (err instanceof LinearReauthRequiredError || (err as { status?: number }).status === 401) {
    return c.json({ error: 'linear_reauth_required', message: new LinearReauthRequiredError().message }, 409);
  }
  return c.json({ error: 'linear_fetch_failed', message: err instanceof Error ? err.message : String(err) }, 502);
}

/**
 * Build the Linear routes as Mastra `apiRoutes`. When the feature is disabled,
 * returns only the `status` route so the SPA can detect the disabled state.
 */
export function buildLinearRoutes(options: MountLinearRoutesOptions = {}): ApiRoute[] {
  const routes: ApiRoute[] = [];

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/linear/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!isLinearFeatureEnabled()) {
          return c.json({
            enabled: false,
            connected: false,
            workspace: null,
            reason: 'missing_config',
            diagnostics: getLinearFeatureDiagnostics(),
          });
        }
        await ensureWebAuthUser(loose(c));
        const tenant = webAuthTenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);

        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            organizationRequired: true,
            connected: false,
            workspace: null,
            reason: 'organization_required',
            diagnostics: getLinearFeatureDiagnostics(),
          });
        }

        const connection = await loadConnection(tenant.orgId);
        return c.json({
          enabled: true,
          connected: Boolean(connection),
          workspace: connection ? { name: connection.workspaceName, urlKey: connection.workspaceUrlKey } : null,
          reason: connection ? 'ready' : 'not_connected',
          diagnostics: getLinearFeatureDiagnostics(),
        });
      },
    }),
  );

  if (!isLinearFeatureEnabled()) {
    return routes;
  }

  const redirectUri = options.redirectUri ?? `${(options.baseUrl ?? '').replace(/\/$/, '')}/auth/linear/callback`;

  // ── Connect: send the user to Linear's OAuth consent screen ─────────────
  routes.push(
    registerApiRoute('/auth/linear/connect', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;
        const state = signState(resolved.tenant.orgId, resolved.tenant.userId);
        return c.redirect(buildLinearAuthorizeUrl(state, redirectUri));
      },
    }),
  );

  // ── Callback: exchange the code, persist the connection for the org ─────
  routes.push(
    registerApiRoute('/auth/linear/callback', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;

        // CSRF / cross-tenant linking protection: the signed state must belong
        // to the same logged-in user *and* their current org.
        const stateTenant = verifyState(c.req.query('state'));
        if (!stateTenant || stateTenant.userId !== userId || stateTenant.orgId !== orgId) {
          console.warn('[Linear] OAuth callback rejected: state/tenant mismatch.');
          return c.redirect('/?linear=error');
        }

        const code = c.req.query('code');
        if (!code) {
          // User denied consent (or Linear returned an error).
          return c.redirect('/?linear=error');
        }

        try {
          const tokens = await exchangeLinearOAuthCode(code, redirectUri);
          const workspace = await fetchLinearWorkspace(tokens.accessToken);
          await getAppDb()
            .insert(linearConnections)
            .values({
              orgId,
              userId,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
              workspaceName: workspace.name,
              workspaceUrlKey: workspace.urlKey,
            })
            .onConflictDoUpdate({
              target: [linearConnections.orgId],
              set: {
                userId,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiresAt,
                workspaceName: workspace.name,
                workspaceUrlKey: workspace.urlKey,
                updatedAt: new Date(),
              },
            });
        } catch (error) {
          console.warn(`[Linear] OAuth callback failed to persist connection for org ${orgId}.`, error);
          return c.redirect('/?linear=error');
        }

        return c.redirect('/?linear=connected');
      },
    }),
  );

  // ── List the workspace's projects (Settings intake-source picker) ───────
  routes.push(
    registerApiRoute('/web/linear/projects', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;

        const connection = await loadConnection(resolved.tenant.orgId);
        if (!connection) {
          return c.json({ error: 'linear_not_connected', message: 'Connect Linear to list projects.' }, 409);
        }

        try {
          const accessToken = await getFreshAccessToken(connection);
          const projects = await listLinearProjects(accessToken);
          return c.json({ projects });
        } catch (err) {
          return linearFetchError(loose(c), err);
        }
      },
    }),
  );

  // ── List the workspace's active issues (cursor-paged) ───────────────────
  // Respects the caller's intake config: disabled Linear intake 404s the
  // source, and an explicit project selection narrows the issue filter.
  routes.push(
    registerApiRoute('/web/linear/issues', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c));
        if ('response' in resolved) return resolved.response;

        const after = parseAfterCursor(c.req.query('after'));
        if (after === null) return c.json({ error: 'invalid_cursor' }, 400);

        const connection = await loadConnection(resolved.tenant.orgId);
        if (!connection) {
          return c.json({ error: 'linear_not_connected', message: 'Connect Linear to see intake issues.' }, 409);
        }

        const config = await getIntakeConfig(resolved.tenant.orgId, resolved.tenant.userId);
        if (!config.linear.enabled) {
          return c.json({ error: 'linear_intake_disabled', message: 'Linear intake is turned off in Settings.' }, 404);
        }

        // No projects selected means nothing is synced — don't fan out to Linear.
        const projectIds = config.linear.projectIds ?? [];
        if (projectIds.length === 0) {
          return c.json({ issues: [], nextCursor: null });
        }

        try {
          const accessToken = await getFreshAccessToken(connection);
          const { issues, nextCursor } = await listActiveLinearIssues(accessToken, after, projectIds);
          return c.json({ issues, nextCursor });
        } catch (err) {
          return linearFetchError(loose(c), err);
        }
      },
    }),
  );

  return routes;
}
