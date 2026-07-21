/**
 * Mastra `apiRoutes` for reading the Factory audit trail.
 *
 * Registered alongside the other `/web/*` routes behind the WorkOS auth gate,
 * and only when the Factory feature is ready (audit events hang off factory
 * mutations). Two endpoints:
 *
 *   - `GET /web/factory/repositories/:id/audit` — org+repository-scoped event list
 *     with keyset pagination (same tenant guards as the work-item routes).
 *   - `GET /web/audit/portal-link` — one-time WorkOS Admin Portal URL opening
 *     the `audit_logs` viewer; 404 when WorkOS auth isn't configured so the
 *     UI can hide the button.
 */

import { WorkOSAdminPortal } from '@mastra/auth-workos';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { ensureWebAuthUser, getWorkOSProvider, isWorkOSAuth, webAuthTenant } from '../auth';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import { listAuditEvents } from './store';

function loose(c: unknown): Context {
  return c as Context;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ACTION_FILTERS = 16;

/** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
async function resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        { error: 'organization_required', message: 'The audit trail requires a WorkOS organization.' },
        403,
      ),
    };
  }
  return { orgId: tenant.orgId, userId: tenant.userId };
}

/** Resolve the tenant AND the org-owned project from the `:id` param. */
async function resolveGithubRepository(
  c: Context,
  storage?: SourceControlStorageHandle,
): Promise<{ orgId: string; userId: string; projectId: string } | { response: Response }> {
  const tenant = await resolveTenant(c);
  if ('response' in tenant) return tenant;

  if (!storage) {
    return {
      response: c.json({ error: 'integration_unavailable', message: 'GitHub integration is unavailable.' }, 503),
    };
  }
  const projectId = c.req.param('id');
  if (!projectId || !UUID_RE.test(projectId)) {
    return { response: c.json({ error: 'Repository not found' }, 404) };
  }
  const project = await storage.projects.getOrg(tenant.orgId, projectId);
  if (!project) {
    return { response: c.json({ error: 'Repository not found' }, 404) };
  }
  return { ...tenant, projectId };
}

/** Parse the `actions` query param (comma-separated) into a bounded list. */
function parseActionsParam(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const actions = raw
    .split(',')
    .map(action => action.trim())
    .filter(Boolean)
    .slice(0, MAX_ACTION_FILTERS);
  return actions.length > 0 ? actions : undefined;
}

/** Parse the `limit` query param, leaving clamping to the store. */
function parseLimitParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const limit = Number.parseInt(raw, 10);
  return Number.isFinite(limit) ? limit : undefined;
}

export interface AuditRoutesDeps {
  /** Public origin used as the Admin Portal return URL base. */
  baseUrl: string;
  githubStorage?: SourceControlStorageHandle;
}

export function buildAuditRoutes(deps: AuditRoutesDeps): ApiRoute[] {
  const githubStorage = deps.githubStorage;
  return [
    registerApiRoute('/web/factory/repositories/:id/audit', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        const scope = await resolveGithubRepository(c, githubStorage);
        if ('response' in scope) return scope.response;

        const page = await listAuditEvents({
          orgId: scope.orgId,
          githubProjectId: scope.projectId,
          actions: parseActionsParam(c.req.query('actions')),
          actorId: c.req.query('actor') || undefined,
          before: c.req.query('before') || undefined,
          limit: parseLimitParam(c.req.query('limit')),
        });
        return c.json(page);
      },
    }),

    registerApiRoute('/web/audit/portal-link', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        if (!isWorkOSAuth()) {
          return c.json({ error: 'not_available' }, 404);
        }
        try {
          const portal = new WorkOSAdminPortal(getWorkOSProvider().getWorkOS(), {
            returnUrl: `${deps.baseUrl}/factory/audit`,
          });
          const url = await portal.getPortalLink(tenant.orgId, 'audit_logs');
          return c.json({ url });
        } catch (err) {
          console.warn('[Audit] Failed to generate WorkOS Admin Portal link', {
            error: err instanceof Error ? err.message : String(err),
          });
          return c.json({ error: 'portal_link_failed' }, 502);
        }
      },
    }),
  ];
}
