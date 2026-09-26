/**
 * Mastra `apiRoutes` for the incident.io intake feature.
 *
 * Registered alongside the other `/web/*` routes, behind the host auth gate.
 * Mirrors the Jira module: no connect/callback flow here — credentials are
 * either deployment-global constructor config (direct) or Platform-managed
 * connections discovered at runtime. Every route re-resolves the
 * authenticated user from the request and scopes intake selections by the
 * caller's org.
 *
 * When the feature is disabled (no auth, or no intake storage),
 * `buildIncidentioRoutes` returns only `GET /web/incidentio/status`, which
 * reports `enabled:false` so the SPA can cleanly hide all incident.io UI.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { Intake } from '../../capabilities/intake.js';
import type { RouteAuth } from '../../routes/route.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import { IncidentioApiError } from './api.js';
import type { IncidentioRulesIngress } from './rules.js';

type RouteContext = Context;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_REF_RE = /^incidentio:(?:follow-up|incident):[\w-]+$/;
const FOLLOW_UP_PREFIX = 'incidentio:follow-up:';

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

/**
 * Non-secret diagnostic snapshot of every incident.io feature gate, mirroring
 * the Jira diagnostics shape. Only booleans — never values.
 */
export interface IncidentioFeatureDiagnostics {
  incidentioConfigured: boolean;
  factoryAuthEnabled: boolean;
}

export interface MountIncidentioRoutesOptions {
  /**
   * The integration's intake capability providing incident.io access. Required
   * for everything beyond the disabled `status` route.
   */
  incidentio?: { intake: Intake; id: string };
  /**
   * Credential mode reported on the status route so the SPA can tell a
   * deployment-configured API key apart from Platform-managed connections.
   */
  mode?: 'api-key' | 'platform';
  /** Host auth seam. Intake selections are org-owned, so the feature is inert without it. */
  auth: RouteAuth;
  /**
   * Cross-integration intake selection domain. Required for the issues route's
   * project filter; when absent, only the disabled `status` route is served.
   */
  intake?: IntakeStorage;
  /**
   * Factory rules ingress for observed follow-ups. When present, a
   * board-scoped listing also materializes new cards through the incident.io
   * event rules — the same automatic intake Linear and Jira have.
   */
  ingestFactoryIssues?: (input: IncidentioRulesIngress) => Promise<unknown>;
}

/**
 * Narrow the caller's selected incident.io sources to the ones that feed this
 * Factory project. Routing is explicit: a source feeds this Factory only when
 * its binding names both the Factory project and a board. Mirrors the Jira
 * routes' scoping semantics — the generic binding storage is provider-neutral.
 * Shared with the agent tools, which enforce the same source-level
 * authorization before fetching item details.
 */
export async function scopeSourceIdsToProject({
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
  for (const binding of await intake.listBindings({ orgId, integrationId: 'incidentio' })) {
    if (binding.factoryProjectId === factoryProjectId && binding.board && selected.has(binding.sourceId)) {
      intakeBoards[binding.sourceId] = binding.board;
    }
  }
  return intakeBoards;
}

/**
 * Resolve the org-scoped tenant for an incident.io request. Intake selections
 * are org-owned, so it requires both a signed-in user and an organization.
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
          message: 'incident.io intake requires an organization. Personal accounts cannot use incident.io intake.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

/**
 * Validate an opaque pagination cursor from the query string. Cursors are
 * server-issued base64url blobs, so anything outside a conservative
 * charset/length is rejected rather than decoded.
 */
function parseAfterCursor(raw: string | undefined): string | undefined | null {
  if (raw === undefined || raw === '') return undefined;
  if (raw.length > 2_048 || !/^[\w+/=.:-]+$/.test(raw)) return null;
  return raw;
}

/** Map an incident.io read failure to the API response for the SPA. */
function incidentioFetchError(c: RouteContext, err: unknown) {
  if (err instanceof IncidentioApiError && (err.status === 401 || err.status === 403)) {
    return c.json(
      {
        error: 'incidentio_auth_failed',
        message: 'incident.io rejected the configured credentials. Reconnect the incident.io account.',
      },
      409,
    );
  }
  return c.json({ error: 'incidentio_fetch_failed', message: err instanceof Error ? err.message : String(err) }, 502);
}

interface IncidentioIssuePayload {
  id: string;
  identifier: string;
  title: string;
  url: string;
  author: string | null;
  state: string;
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  incident: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
}

/**
 * Build the incident.io routes as Mastra `apiRoutes`. When the feature is
 * disabled, returns only the `status` route so the SPA can detect the
 * disabled state.
 */
export function buildIncidentioRoutes(options: MountIncidentioRoutesOptions): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const { incidentio, auth, intake, mode } = options;
  const enabled = Boolean(incidentio) && auth.enabled();
  const modeField = mode ? { mode } : {};
  const diagnostics = (): IncidentioFeatureDiagnostics => ({
    incidentioConfigured: Boolean(incidentio),
    factoryAuthEnabled: auth.enabled(),
  });

  // The status route is always registered so the SPA can detect the disabled state.
  routes.push(
    registerApiRoute('/web/incidentio/status', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!enabled || !incidentio || !intake) {
          return c.json({
            enabled: false,
            configured: Boolean(incidentio),
            ...modeField,
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
            configured: true,
            ...modeField,
            organizationRequired: true,
            reason: 'organization_required',
            diagnostics: diagnostics(),
          });
        }
        return c.json({ enabled: true, configured: true, ...modeField, reason: 'ready', diagnostics: diagnostics() });
      },
    }),
  );

  // Without the integration instance or the intake domain the feature can't
  // serve org-scoped data — serve only the disabled `status` route.
  if (!enabled || !incidentio || !intake) {
    return routes;
  }

  // ── List bound follow-ups (cursor-paged) ────────────────────────────────
  // Respects the caller's intake config: disabled incident.io intake 404s,
  // and only sources routed to the requested Factory project are listed.
  // Incidents never appear here — only follow-ups feed intake.
  routes.push(
    registerApiRoute('/web/incidentio/issues', {
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
        const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['incidentio'] });
        const selection = config.incidentio!;
        if (!selection.enabled) {
          return c.json(
            { error: 'incidentio_intake_disabled', message: 'incident.io intake is turned off in Settings.' },
            404,
          );
        }

        const selectedIds = selection.sourceIds ?? [];
        const intakeBoards = factoryProjectId
          ? await scopeSourceIdsToProject({
              intake,
              orgId: resolved.tenant.orgId,
              factoryProjectId,
              selectedIds,
            })
          : null;
        const sourceIds = intakeBoards ? Object.keys(intakeBoards) : selectedIds;
        if (sourceIds.length === 0) {
          return c.json({ issues: [], nextCursor: null });
        }

        try {
          const page = await incidentio.intake.listItems({
            orgId: resolved.tenant.orgId,
            userId: resolved.tenant.userId,
            sourceIds,
            ...(after ? { cursor: after } : {}),
          });
          const issuePayload: IncidentioIssuePayload[] = [];
          for (const item of page.items) {
            const externalId = item.source.externalId;
            // Incidents stay out of intake even when a stale binding selects
            // the incidents source — only follow-ups are served.
            if (!externalId.startsWith(FOLLOW_UP_PREFIX)) continue;
            const metadata = item.metadata ?? {};
            const identifier = typeof metadata.identifier === 'string' ? metadata.identifier : externalId;
            const titlePrefix = `${identifier}: `;
            issuePayload.push({
              id: externalId,
              identifier,
              title: item.title.startsWith(titlePrefix) ? item.title.slice(titlePrefix.length) : item.title,
              url: item.source.url ?? '',
              author: typeof metadata.author === 'string' ? metadata.author : null,
              state: item.status ?? '',
              stateType: typeof metadata.stateType === 'string' ? metadata.stateType : '',
              priorityLabel: typeof metadata.priority === 'string' ? metadata.priority : '',
              assignee: item.assignee ?? null,
              incident: typeof metadata.incidentioIncidentId === 'string' ? metadata.incidentioIncidentId : null,
              labels: item.labels ?? [],
              createdAt: item.createdAt ?? '',
              updatedAt: item.updatedAt ?? '',
              sourceId: item.sourceId || null,
            });
          }
          if (factoryProjectId && intakeBoards && options.ingestFactoryIssues) {
            await options.ingestFactoryIssues({
              orgId: resolved.tenant.orgId,
              userId: resolved.tenant.userId,
              factoryProjectId,
              issues: issuePayload,
              intakeBoards,
            });
          }
          return c.json({ issues: issuePayload, nextCursor: page.nextCursor });
        } catch (err) {
          return incidentioFetchError(loose(c), err);
        }
      },
    }),
  );

  // ── Follow-up detail (description for the card panel) ───────────────────
  routes.push(
    registerApiRoute('/web/incidentio/issues/detail', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveOrgTenant(loose(c), auth);
        if ('response' in resolved) return resolved.response;

        const factoryProjectId = c.req.query('factoryProjectId');
        const issueRef = c.req.query('issueRef');
        if (!factoryProjectId || !UUID_RE.test(factoryProjectId)) {
          return c.json({ error: 'invalid_factory_project_id' }, 400);
        }
        if (!issueRef || issueRef.length > 2_048 || !ITEM_REF_RE.test(issueRef)) {
          return c.json({ error: 'invalid_issue_ref' }, 400);
        }

        await intake.ensureReady();
        const config = await intake.getConfig({ orgId: resolved.tenant.orgId, integrationIds: ['incidentio'] });
        const selection = config.incidentio!;
        if (!selection.enabled) {
          return c.json(
            { error: 'incidentio_intake_disabled', message: 'incident.io intake is turned off in Settings.' },
            404,
          );
        }
        const intakeBoards = await scopeSourceIdsToProject({
          intake,
          orgId: resolved.tenant.orgId,
          factoryProjectId,
          selectedIds: selection.sourceIds ?? [],
        });
        if (Object.keys(intakeBoards).length === 0) return c.json({ error: 'issue_not_found' }, 404);

        try {
          // The item must resolve through a source routed to this Factory —
          // an item from an unbound source reads exactly like one that
          // doesn't exist (same stance as the Jira detail route).
          const dispatch = await incidentio.intake.resolveIntakeDispatch?.({
            orgId: resolved.tenant.orgId,
            externalSource: { type: 'issue', externalId: issueRef },
          });
          if (!dispatch || !dispatch.sourceId || !(dispatch.sourceId in intakeBoards)) {
            return c.json({ error: 'issue_not_found' }, 404);
          }
          const issue = await incidentio.intake.getIssue({
            connection: dispatch.connection,
            issueId: dispatch.issueId,
          });
          if (!issue) return c.json({ error: 'issue_not_found' }, 404);
          return c.json({
            issue: {
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
              description: issue.description ?? null,
            },
          });
        } catch (err) {
          return incidentioFetchError(loose(c), err);
        }
      },
    }),
  );

  return routes;
}
