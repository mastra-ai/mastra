/**
 * Mastra `apiRoutes` for Factory work items (the kanban board).
 *
 * Registered alongside the other `/web/*` routes behind the WorkOS auth gate.
 * The board is org-wide: every route re-resolves the caller's `(orgId, userId)`
 * tenant and scopes reads/writes by `orgId`, so any org member sees and moves
 * the same cards while `created_by` / stage history record who acted.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { emitAudit } from '../audit/audit';
import { ensureWebAuthUser, webAuthTenant } from '../auth';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import { clampMetricsWindow, computeFactoryMetrics } from './metrics';
import { getFactoryStorage } from '../runtime-config';
import { getQueueHealthStorage } from '../storage/domains';
import type { WorkItemRow } from '../storage/domains/work-items/base';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base';
import type { WorkItemPriorState } from './store';
import {
  deleteWorkItem,
  listWorkItems,
  parseCreateWorkItem,
  parseUpdateWorkItem,
  updateWorkItem,
  upsertWorkItem,
} from './store';

function loose(c: unknown): Context {
  return c as Context;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
async function resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
  await ensureWebAuthUser(c);
  const tenant = webAuthTenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        { error: 'organization_required', message: 'The Factory board requires a WorkOS organization.' },
        403,
      ),
    };
  }
  return { orgId: tenant.orgId, userId: tenant.userId };
}

/**
 * Resolve the tenant AND the org-owned connected repository from the `:id` param.
 * Work items hang off a repository, so listing/creating requires the repository to exist
 * in the caller's org.
 */
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

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** Fields a PATCH touched, for the bounded `updated` event summary. */
function patchedFields(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(key => patch[key] !== undefined);
}

/**
 * Emit the audit events a successful work-item PATCH implies: always
 * `updated`, plus `stage_moved` when the stages actually changed and one
 * `run.started` per session role the patch introduced.
 */
async function auditWorkItemPatch(
  c: Context,
  item: WorkItemRow,
  previous: WorkItemPriorState,
  patch: Record<string, unknown>,
): Promise<void> {
  const target = { type: 'work_item', id: item.id, name: item.title };
  await emitAudit(c, {
    action: 'factory.work_item.updated',
    projectId: item.githubProjectId,
    targets: [target],
    metadata: { fields: patchedFields(patch) },
  });

  const stagesChanged =
    patch.stages !== undefined &&
    (previous.stages.length !== item.stages.length || previous.stages.some((s, i) => s !== item.stages[i]));
  if (stagesChanged) {
    await emitAudit(c, {
      action: 'factory.work_item.stage_moved',
      projectId: item.githubProjectId,
      targets: [target],
      metadata: { from: previous.stages, to: item.stages },
    });
  }

  const newRoles = Object.keys(item.sessions).filter(role => !previous.sessionRoles.includes(role));
  for (const role of newRoles) {
    const session = item.sessions[role];
    await emitAudit(c, {
      action: 'factory.run.started',
      projectId: item.githubProjectId,
      targets: [target],
      metadata: {
        role,
        branch: session?.branch,
        threadId: session?.threadId,
        projectPath: session?.projectPath,
      },
    });
  }
}

/** Build the Factory work-item routes as Mastra `apiRoutes`. */
export function buildFactoryRoutes(storage?: SourceControlStorageHandle): ApiRoute[] {
  return [
    // ── List the org's work items for a repository ─────────────────────────
    registerApiRoute('/web/factory/repositories/:id/work-items', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveGithubRepository(loose(c), storage);
        if ('response' in resolved) return resolved.response;
        const items = await listWorkItems(resolved.orgId, resolved.projectId);
        return c.json({ workItems: items });
      },
    }),

    // ── Flow metrics aggregated over the repository's work items ─────────────
    registerApiRoute('/web/factory/repositories/:id/metrics', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveGithubRepository(loose(c), storage);
        if ('response' in resolved) return resolved.response;
        const days = clampMetricsWindow(loose(c).req.query('days'));
        const items = await listWorkItems(resolved.orgId, resolved.projectId);
        return c.json({ metrics: computeFactoryMetrics(items, { days, now: new Date() }) });
      },
    }),

    // ── Per-project queue-health age-threshold config (seconds) ─────────────
    registerApiRoute('/web/factory/repositories/:id/health/thresholds', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveGithubRepository(loose(c), storage);
        if ('response' in resolved) return resolved.response;
        const factoryStorage = getFactoryStorage();
        await factoryStorage.ensureDomainReady('queue-health');
        const stored = await getQueueHealthStorage().getConfig(resolved.orgId, resolved.projectId);
        // Validate at the read choke point: `getConfig` round-trips a stored
        // JSONB row, and only `saveConfig` validates on write — a corrupted or
        // hand-edited row (empty / non-ascending) would otherwise flow to the
        // chart and invert bucket colors. Fall back to the default on invalid.
        return c.json({ thresholds: thresholdsOrDefault(stored) });
      },
    }),

    // ── Create (upsert on sourceKey) a work item ─────────────────────────────
    registerApiRoute('/web/factory/repositories/:id/work-items', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveGithubRepository(loose(c), storage);
        if ('response' in resolved) return resolved.response;

        const body = await readJson(loose(c));
        if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
        const input = parseCreateWorkItem(body);
        if (!input) return c.json({ error: 'invalid_work_item' }, 400);

        const result = await upsertWorkItem({
          orgId: resolved.orgId,
          userId: resolved.userId,
          githubProjectId: resolved.projectId,
          input,
        });
        const item = result.item;
        if (result.created) {
          await emitAudit(loose(c), {
            action: 'factory.work_item.created',
            projectId: resolved.projectId,
            targets: [{ type: 'work_item', id: item.id, name: item.title }],
            metadata: { source: item.source, sourceKey: item.sourceKey, stages: item.stages },
          });
        } else {
          // Source-key reuse: the POST updated an existing card, so audit it
          // as an update (plus stage/run events) instead of a false creation.
          await auditWorkItemPatch(loose(c), item, result.previous, input as unknown as Record<string, unknown>);
        }
        return c.json({ workItem: item });
      },
    }),

    // ── Patch stages / sessions / metadata / title ───────────────────────────
    registerApiRoute('/web/factory/work-items/:id', {
      method: 'PATCH',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;

        const id = loose(c).req.param('id');
        if (!id || !UUID_RE.test(id)) return c.json({ error: 'Work item not found' }, 404);

        const body = await readJson(loose(c));
        if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
        const patch = parseUpdateWorkItem(body);
        if (!patch) return c.json({ error: 'invalid_work_item_patch' }, 400);

        const updated = await updateWorkItem(tenant.orgId, id, tenant.userId, patch);
        if (!updated) return c.json({ error: 'Work item not found' }, 404);
        await auditWorkItemPatch(loose(c), updated.item, updated.previous, patch as Record<string, unknown>);
        return c.json({ workItem: updated.item });
      },
    }),

    // ── Remove a work item ───────────────────────────────────────────────────
    registerApiRoute('/web/factory/work-items/:id', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        const tenant = await resolveTenant(loose(c));
        if ('response' in tenant) return tenant.response;

        const id = loose(c).req.param('id');
        if (!id || !UUID_RE.test(id)) return c.json({ error: 'Work item not found' }, 404);

        const deleted = await deleteWorkItem(tenant.orgId, id);
        if (!deleted) return c.json({ error: 'Work item not found' }, 404);
        await emitAudit(loose(c), {
          action: 'factory.work_item.deleted',
          projectId: deleted.githubProjectId,
          targets: [{ type: 'work_item', id: deleted.id, name: deleted.title }],
        });
        return c.json({ ok: true });
      },
    }),
  ];
}
