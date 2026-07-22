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
import type { Context } from 'hono';

import type { RouteAuth } from '../../routes/route';
import type { StateSigner } from '../../state-signing';
import type { IntakeStorage } from '../../storage/domains/intake/base';
import type { IntegrationHooks } from '../base';
import type { LinearIntegration } from './integration';
import { LinearReauthRequiredError } from './integration';

type RouteContext = Context;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

/**
 * Non-secret diagnostic snapshot of every Linear feature gate, mirroring the
 * GitHub diagnostics shape. Only booleans — never values.
 */
export interface LinearFeatureDiagnostics {
  linearAppConfigured: boolean;
  factoryAuthEnabled: boolean;
  appDbConfigured: boolean;
}

export interface MountLinearRoutesOptions {
  /**
   * The integration instance providing OAuth + GraphQL access. Required for
   * everything beyond the disabled `status` route.
   */
  linear?: LinearIntegration;
  /** Host auth seam. Linear connections are org-owned, so the feature is inert without it. */
  auth: RouteAuth;
  /**
   * Absolute base URL of the web server (e.g. `http://localhost:4111`), used to
   * build the OAuth redirect URI when one isn't explicitly configured.
   */
  baseUrl?: string;
  /** Explicit OAuth callback URI; defaults to `<baseUrl>/auth/linear/callback`. */
  redirectUri?: string;
  /**
   * Shared OAuth `state` signer (created once per boot by the factory).
   * Required for the connect/callback flow; when absent, only the disabled
   * `status` route is served.
   */
  stateSigner?: StateSigner;
  /**
   * Cross-integration intake selection domain. Required for the issues route's
   * project filter; when absent, only the disabled `status` route is served.
   */
  intake?: IntakeStorage;
  hooks?: IntegrationHooks;
}

/**
 * Resolve the org-scoped tenant for a Linear request. The connection is
 * org-owned, so it requires both a signed-in user and an organization — same
 * tenancy rules as the GitHub routes.
 */
async function resolveOrgTenant(
  c: RouteContext,
  auth: RouteAuth,
): Promise<{ tenant: { orgId: string; userId: string } } | { response: Response }> {
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'Linear intake requires an organization. Personal accounts cannot connect Linear.',
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
export function buildLinearRoutes(options: MountLinearRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { linear, auth, stateSigner, intake } = options;
  const enabled = Boolean(linear) && auth.enabled();
  const diagnostics = (): LinearFeatureDiagnostics => ({
    linearAppConfigured: Boolean(linear),
    factoryAuthEnabled: auth.enabled(),
    appDbConfigured: true,
  });

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/linear/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!enabled || !linear || !stateSigner) {
          return c.json({
            enabled: false,
            connected: false,
            workspace: null,
            reason: 'missing_config',
            diagnostics: diagnostics(),
          });
        }
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);

        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            organizationRequired: true,
            connected: false,
            workspace: null,
            reason: 'organization_required',
            diagnostics: diagnostics(),
          });
        }

        const connection = await linear.loadConnection(tenant.orgId);
        return c.json({
          enabled: true,
          connected: Boolean(connection),
          workspace: connection ? { name: connection.workspaceName, urlKey: connection.workspaceUrlKey } : null,
          reason: connection ? 'ready' : 'not_connected',
          diagnostics: diagnostics(),
        });
      },
    }),
  );

  // Without the integration instance or a state signer the connect/callback
  // flow cannot talk to Linear or bind the OAuth round-trip to a tenant —
  // serve only the disabled `status` route (mirrors the feature gate).
  if (!enabled || !linear || !stateSigner || !intake) {
    return routes;
  }

  const redirectUri = options.redirectUri ?? `${(options.baseUrl ?? '').replace(/\/$/, '')}/auth/linear/callback`;

  // ── Connect: send the user to Linear's OAuth consent screen ─────────────
  routes.push(
    registerApiRoute('/auth/linear/connect', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const state = stateSigner.sign(resolved.tenant.orgId, resolved.tenant.userId);
        return c.redirect(linear.buildAuthorizeUrl(state, redirectUri));
      },
    }),
  );

  // ── Callback: exchange the code, persist the connection for the org ─────
  routes.push(
    registerApiRoute('/auth/linear/callback', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;
        const { orgId, userId } = resolved.tenant;

        // CSRF / cross-tenant linking protection: the signed state must belong
        // to the same logged-in user *and* their current org.
        const stateTenant = stateSigner.verify(c.req.query('state'));
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
          const tokens = await linear.exchangeOAuthCode(code, redirectUri);
          const workspace = await linear.fetchWorkspace(tokens.accessToken);
          await linear.upsertConnection({
            orgId,
            userId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope,
            workspaceName: workspace.name,
            workspaceUrlKey: workspace.urlKey,
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
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        const connection = await linear.loadConnection(resolved.tenant.orgId);
        if (!connection) {
          return c.json({ error: 'linear_not_connected', message: 'Connect Linear to list Linear projects.' }, 409);
        }

        try {
          const accessToken = await linear.getFreshAccessToken(connection);
          const projects = await linear.listProjects(accessToken);
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
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        const after = parseAfterCursor(c.req.query('after'));
        if (after === null) return c.json({ error: 'invalid_cursor' }, 400);
        const factoryProjectId = c.req.query('factoryProjectId');
        if (factoryProjectId && !UUID_RE.test(factoryProjectId)) {
          return c.json({ error: 'invalid_factory_project_id' }, 400);
        }

        const connection = await linear.loadConnection(resolved.tenant.orgId);
        if (!connection) {
          return c.json({ error: 'linear_not_connected', message: 'Connect Linear to see intake issues.' }, 409);
        }

        await intake.ensureReady();
        const config = await intake.getConfig({
          orgId: resolved.tenant.orgId,
          userId: resolved.tenant.userId,
          integrationIds: ['linear'],
        });
        const selection = config.linear!;
        if (!selection.enabled) {
          return c.json({ error: 'linear_intake_disabled', message: 'Linear intake is turned off in Settings.' }, 404);
        }

        // No projects selected means nothing is synced — don't fan out to Linear.
        const projectIds = selection.sourceIds ?? [];
        if (projectIds.length === 0) {
          return c.json({ issues: [], nextCursor: null });
        }

        try {
          const accessToken = await linear.getFreshAccessToken(connection);
          const { issues, nextCursor } = await linear.intake.listIssues({
            connection: { type: 'oauth', accessToken },
            sourceIds: projectIds,
            cursor: after,
          });
          const issuePayload = issues.map(issue => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
            state: issue.state ?? '',
            stateType: issue.stateType ?? '',
            priorityLabel: issue.priority ?? '',
            assignee: issue.assignee,
            team: issue.source,
            labels: issue.labels,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
          }));
          if (factoryProjectId && options.hooks?.ingestLinearIssues) {
            await options.hooks.ingestLinearIssues({
              orgId: resolved.tenant.orgId,
              userId: resolved.tenant.userId,
              factoryProjectId,
              issues: issuePayload,
            });
          }
          return c.json({ issues: issuePayload, nextCursor });
        } catch (err) {
          return linearFetchError(loose(c), err);
        }
      },
    }),
  );

  return routes;
}
