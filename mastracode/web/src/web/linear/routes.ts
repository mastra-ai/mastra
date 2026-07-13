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
import { getIntakeConfig } from '../intake/store';
import {
  buildLinearAuthorizeUrl,
  exchangeLinearOAuthCode,
  fetchLinearWorkspace,
  listActiveLinearIssues,
  listLinearProjects,
} from './client';
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
          const accessToken = await exchangeLinearOAuthCode(code, redirectUri);
          const workspace = await fetchLinearWorkspace(accessToken);
          await getAppDb()
            .insert(linearConnections)
            .values({
              orgId,
              userId,
              accessToken,
              workspaceName: workspace.name,
              workspaceUrlKey: workspace.urlKey,
            })
            .onConflictDoUpdate({
              target: [linearConnections.orgId],
              set: {
                userId,
                accessToken,
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
          const projects = await listLinearProjects(connection.accessToken);
          return c.json({ projects });
        } catch (err) {
          return c.json(
            { error: 'linear_fetch_failed', message: err instanceof Error ? err.message : String(err) },
            502,
          );
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
          const { issues, nextCursor } = await listActiveLinearIssues(connection.accessToken, after, projectIds);
          return c.json({ issues, nextCursor });
        } catch (err) {
          return c.json(
            { error: 'linear_fetch_failed', message: err instanceof Error ? err.message : String(err) },
            502,
          );
        }
      },
    }),
  );

  return routes;
}
