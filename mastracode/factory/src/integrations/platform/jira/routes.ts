/**
 * Mastra `apiRoutes` for the Jira intake feature.
 *
 * Registered alongside the other `/web/*` routes, behind the host auth gate.
 * Jira connections are owned by the caller's Mastra Platform organization;
 * provider requests stay server-side and flow through the integrations v2
 * proxy. Every route re-resolves the authenticated user and scopes intake
 * selections by the caller's org.
 *
 * When the feature is disabled (no auth, or no intake storage),
 * `buildPlatformJiraRoutes` returns only `GET /web/jira/status`, which reports
 * `enabled:false` so the SPA can cleanly hide all Jira UI.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { RouteAuth } from '../../../routes/route.js';
import type { IntakeStorage } from '../../../storage/domains/intake/base.js';
import { JiraApiError } from '../../jira/api.js';
import type { PlatformJiraIntegration } from './integration.js';

type RouteContext = Context;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

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
  jira?: PlatformJiraIntegration;
  /** Host auth seam. Intake selections are org-owned, so the feature is inert without it. */
  auth: RouteAuth;
  /**
   * Cross-integration intake selection domain. Required for the issues route's
   * project filter; when absent, only the disabled `status` route is served.
   */
  intake?: IntakeStorage;
  /** Whether the host configured the application database backing intake state. */
  appDbConfigured: boolean;
}

/**
 * Narrow the caller's selected Jira projects to the ones that feed this
 * Factory project.
 *
 * A Jira issue carries no Factory project of its own, so without a binding
 * every board view would show every selected project's issues on whichever
 * Factory happened to be on screen. Only sources explicitly bound to a board
 * of this Factory pass — nothing is routed implicitly. Mirrors the Linear
 * routes' scoping semantics locally — the generic binding storage is
 * provider-neutral.
 */
async function scopeSourceIdsToProject({
  intake,
  orgId,
  factoryProjectId,
  selectedIds,
}: {
  intake: IntakeStorage;
  orgId: string;
  factoryProjectId: string;
  selectedIds: string[];
}): Promise<Record<string, string>> {
  const selected = new Set(selectedIds);
  const intakeBoards: Record<string, string> = {};
  for (const binding of await intake.listBindings({ orgId, integrationId: 'jira' })) {
    if (binding.factoryProjectId === factoryProjectId && binding.board && selected.has(binding.sourceId)) {
      intakeBoards[binding.sourceId] = binding.board;
    }
  }
  return intakeBoards;
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
        message: 'Jira rejected the connected account. Reconnect it in Mastra Platform.',
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
export function buildPlatformJiraRoutes(options: MountJiraRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { jira, auth, intake } = options;
  const enabled = Boolean(jira) && auth.enabled();
  const diagnostics = (): JiraFeatureDiagnostics => ({
    jiraConfigured: Boolean(jira),
    factoryAuthEnabled: auth.enabled(),
    appDbConfigured: options.appDbConfigured,
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
            mode: 'platform',
            site: null,
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
            configured: false,
            mode: 'platform',
            organizationRequired: true,
            site: null,
            sites: [],
            connections: [],
            reason: 'organization_required',
            diagnostics: diagnostics(),
          });
        }

        try {
          const connections = await jira.listConnections();
          const active = connections.filter(connection => connection.status === 'active');
          const sites = active.flatMap(connection => (connection.accountLabel ? [connection.accountLabel] : []));
          return c.json({
            enabled: true,
            configured: active.length > 0,
            mode: 'platform',
            site: sites.length === 1 ? sites[0] : null,
            sites,
            connections,
            reason: active.length > 0 ? 'ready' : 'not_connected',
            diagnostics: diagnostics(),
          });
        } catch (err) {
          return jiraFetchError(loose(c), err);
        }
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
              connectionId: typeof source.metadata?.connectionId === 'string' ? source.metadata.connectionId : null,
              site: typeof source.metadata?.site === 'string' ? source.metadata.site : null,
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
        const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['jira'] });
        const selection = config.jira!;
        if (!selection.enabled) {
          return c.json({ error: 'jira_intake_disabled', message: 'Jira intake is turned off in Settings.' }, 404);
        }

        // No projects selected means nothing is synced — don't fan out to Jira.
        const selectedIds = selection.sourceIds ?? [];
        // A board request only ever sees the projects routed to a board of
        // that Factory project; unscoped listing stays available to callers
        // that don't view a specific board.
        const intakeBoards = factoryProjectId
          ? await scopeSourceIdsToProject({
              intake,
              orgId: resolved.tenant.orgId,
              factoryProjectId,
              selectedIds,
            })
          : null;
        const projectIds = intakeBoards ? Object.keys(intakeBoards) : selectedIds;
        if (projectIds.length === 0) {
          return c.json({ issues: [], nextCursor: null });
        }

        try {
          const { issues, nextCursor } = await jira.listActiveIssues(after, projectIds);
          return c.json({
            issues: issues.map(issue => ({
              id: issue.externalId,
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
              author: issue.author,
              state: issue.state ?? '',
              stateType: issue.stateType ?? '',
              priorityLabel: issue.priority ?? '',
              assignee: issue.assignee,
              project: issue.source,
              site: issue.site,
              labels: issue.labels,
              createdAt: issue.createdAt,
              updatedAt: issue.updatedAt,
              sourceId: issue.sourceId || null,
            })),
            nextCursor,
          });
        } catch (err) {
          return jiraFetchError(loose(c), err);
        }
      },
    }),
  );

  routes.push(
    registerApiRoute('/web/jira/issues/:identifier', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        const identifier = c.req.param('identifier');
        const factoryProjectId = c.req.query('factoryProjectId');
        const issueRef = c.req.query('issueRef');
        if (!ISSUE_KEY_RE.test(identifier)) return c.json({ error: 'invalid_issue_identifier' }, 400);
        if (!factoryProjectId || !UUID_RE.test(factoryProjectId)) {
          return c.json({ error: 'invalid_factory_project_id' }, 400);
        }
        if (!issueRef || issueRef.length > 2_048) return c.json({ error: 'invalid_issue_ref' }, 400);

        await intake.ensureReady();
        const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['jira'] });
        const selection = config.jira!;
        if (!selection.enabled) {
          return c.json({ error: 'jira_intake_disabled', message: 'Jira intake is turned off in Settings.' }, 404);
        }

        const intakeBoards = await scopeSourceIdsToProject({
          intake,
          orgId: resolved.tenant.orgId,
          factoryProjectId,
          selectedIds: selection.sourceIds ?? [],
        });
        const dispatch = await jira.intake.resolveIntakeDispatch?.({
          orgId: resolved.tenant.orgId,
          externalSource: { type: 'issue', externalId: issueRef },
        });
        if (!dispatch?.sourceId || !(dispatch.sourceId in intakeBoards)) {
          return c.json({ error: 'issue_not_found' }, 404);
        }

        try {
          const issue = await jira.intake.getIssue(dispatch);
          if (!issue || issue.identifier.toUpperCase() !== identifier.toUpperCase()) {
            return c.json({ error: 'issue_not_found' }, 404);
          }
          return c.json({
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
            description: issue.description,
          });
        } catch (err) {
          return jiraFetchError(loose(c), err);
        }
      },
    }),
  );

  return routes;
}
