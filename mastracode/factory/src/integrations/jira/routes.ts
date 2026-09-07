/**
 * Mastra `apiRoutes` for the Jira intake feature.
 *
 * Registered alongside the other `/web/*` routes, behind the host auth gate.
 * Mirrors the Linear module minus everything OAuth: there is no
 * connect/callback flow, no state signer, and no per-org connection storage —
 * Jira credentials are deployment-global constructor config on the
 * integration instance. Every route still re-resolves the authenticated user
 * from the request and scopes intake selections by the caller's org.
 *
 * When the feature is disabled (no auth, or no intake storage),
 * `buildJiraRoutes` returns only `GET /web/jira/status`, which reports
 * `enabled:false` so the SPA can cleanly hide all Jira UI.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { RouteAuth } from '../../routes/route.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import { JiraApiError } from './api.js';
import type { JiraIntegration } from './integration.js';

type RouteContext = Context;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

/**
 * Non-secret diagnostic snapshot of every Jira feature gate, mirroring the
 * Linear diagnostics shape. Only booleans — never values.
 */
export interface JiraFeatureDiagnostics {
  jiraConfigured: boolean;
  factoryAuthEnabled: boolean;
  appDbConfigured: boolean;
}

export interface MountJiraRoutesOptions {
  /**
   * The integration instance providing REST access. Required for everything
   * beyond the disabled `status` route.
   */
  jira?: JiraIntegration;
  /** Host auth seam. Intake selections are org-owned, so the feature is inert without it. */
  auth: RouteAuth;
  /**
   * Cross-integration intake selection domain. Required for the issues route's
   * project filter; when absent, only the disabled `status` route is served.
   */
  intake?: IntakeStorage;
  /**
   * Factory project domain, used to keep single-project installs working
   * without any source binding. When absent, unbound sources are treated as
   * belonging to no project.
   */
  projects?: { list(input: { orgId: string }): Promise<unknown[]> };
}

/**
 * Narrow the caller's selected Jira projects to the ones that feed this
 * Factory project.
 *
 * A Jira issue carries no Factory project of its own, so without a binding
 * every board view would show every selected project's issues on whichever
 * Factory happened to be on screen. Bound sources win; when the org has no
 * bindings at all we fall back to the full selection for single-project
 * installs, where "which project" is unambiguous. Mirrors the Linear routes'
 * scoping semantics locally — the generic binding storage is provider-neutral.
 */
async function scopeSourceIdsToProject({
  intake,
  projects,
  orgId,
  factoryProjectId,
  selectedIds,
}: {
  intake: IntakeStorage;
  projects: MountJiraRoutesOptions['projects'];
  orgId: string;
  factoryProjectId: string;
  selectedIds: string[];
}): Promise<string[]> {
  const bound = await intake.listBoundSourceIds({ orgId, integrationId: 'jira', factoryProjectId });
  if (bound.length > 0) {
    const boundSet = new Set(bound);
    return selectedIds.filter(id => boundSet.has(id));
  }
  const orgBindings = await intake.listBindings({ orgId, integrationId: 'jira' });
  if (orgBindings.length > 0) return [];
  if (!projects) return [];
  const all = await projects.list({ orgId });
  return all.length <= 1 ? selectedIds : [];
}

/**
 * Resolve the org-scoped tenant for a Jira request. Intake selections are
 * org-owned, so it requires both a signed-in user and an organization — same
 * tenancy rules as the Linear routes.
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
          message: 'Jira intake requires an organization. Personal accounts cannot use Jira intake.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

/**
 * Validate an opaque Jira pagination cursor from the query string. Cursors are
 * server-issued (`nextPageToken`), so anything outside a conservative
 * charset/length is rejected rather than forwarded to Jira.
 */
function parseAfterCursor(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  if (raw.length > 512 || !/^[\w+/=.:-]+$/.test(raw)) return null;
  return raw;
}

/** Map a Jira read failure to the API response for the SPA. */
function jiraFetchError(c: RouteContext, err: unknown) {
  if (err instanceof JiraApiError && err.code === 'jira_auth_failed') {
    return c.json(
      {
        error: 'jira_auth_failed',
        message: 'Jira rejected the configured credentials. Check JIRA_EMAIL and JIRA_API_TOKEN.',
      },
      409,
    );
  }
  return c.json({ error: 'jira_fetch_failed', message: err instanceof Error ? err.message : String(err) }, 502);
}

/**
 * Build the Jira routes as Mastra `apiRoutes`. When the feature is disabled,
 * returns only the `status` route so the SPA can detect the disabled state.
 */
export function buildJiraRoutes(options: MountJiraRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { jira, auth, intake } = options;
  const enabled = Boolean(jira) && auth.enabled();
  const diagnostics = (): JiraFeatureDiagnostics => ({
    jiraConfigured: Boolean(jira),
    factoryAuthEnabled: auth.enabled(),
    appDbConfigured: true,
  });

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/jira/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!enabled || !jira || !intake) {
          return c.json({
            enabled: false,
            configured: Boolean(jira),
            site: null,
            reason: 'missing_config',
            diagnostics: diagnostics(),
          });
        }
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);

        const site = new URL(jira.baseUrl).host;
        if (!tenant.orgId) {
          return c.json({
            enabled: true,
            configured: true,
            organizationRequired: true,
            site,
            reason: 'organization_required',
            diagnostics: diagnostics(),
          });
        }

        // Deployment-global credentials: configured means ready — there is no
        // per-org connection step like Linear's OAuth.
        return c.json({
          enabled: true,
          configured: true,
          site,
          reason: 'ready',
          diagnostics: diagnostics(),
        });
      },
    }),
  );

  // Without the integration instance or the intake domain the feature can't
  // serve org-scoped data — serve only the disabled `status` route.
  if (!enabled || !jira || !intake) {
    return routes;
  }

  // ── List the site's projects (Settings intake-source picker) ────────────
  routes.push(
    registerApiRoute('/web/jira/projects', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        try {
          const sources = await jira.intake.listSources(resolved.tenant);
          return c.json({
            projects: sources.map(source => ({
              id: source.id,
              name: source.name,
              key: typeof source.metadata?.key === 'string' ? source.metadata.key : null,
            })),
          });
        } catch (err) {
          return jiraFetchError(loose(c), err);
        }
      },
    }),
  );

  // ── List the site's active issues (cursor-paged) ────────────────────────
  // Respects the caller's intake config: disabled Jira intake 404s the
  // source, and an explicit project selection narrows the issue filter.
  routes.push(
    registerApiRoute('/web/jira/issues', {
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

        await intake.ensureReady();
        const config = await intake.getConfig({
          orgId: resolved.tenant.orgId,
          userId: resolved.tenant.userId,
          integrationIds: ['jira'],
        });
        const selection = config.jira!;
        if (!selection.enabled) {
          return c.json({ error: 'jira_intake_disabled', message: 'Jira intake is turned off in Settings.' }, 404);
        }

        // No projects selected means nothing is synced — don't fan out to Jira.
        const selectedIds = selection.sourceIds ?? [];
        // A board request only ever sees the sources bound (routed) to that
        // Factory project; unscoped listing stays available to callers that
        // don't view a specific board.
        const projectIds = factoryProjectId
          ? await scopeSourceIdsToProject({
              intake,
              projects: options.projects,
              orgId: resolved.tenant.orgId,
              factoryProjectId,
              selectedIds,
            })
          : selectedIds;
        if (projectIds.length === 0) {
          return c.json({ issues: [], nextCursor: null });
        }

        try {
          const { issues, nextCursor } = await jira.listActiveIssues(after, projectIds);
          return c.json({
            issues: issues.map(issue => ({
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
              state: issue.state ?? '',
              stateType: issue.stateType ?? '',
              priorityLabel: issue.priority ?? '',
              assignee: issue.assignee,
              project: issue.source,
              labels: issue.labels,
              createdAt: issue.createdAt,
              updatedAt: issue.updatedAt,
            })),
            nextCursor,
          });
        } catch (err) {
          return jiraFetchError(loose(c), err);
        }
      },
    }),
  );

  return routes;
}
