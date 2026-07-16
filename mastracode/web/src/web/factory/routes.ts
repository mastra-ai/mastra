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

import type { AuditEmitter } from '../audit/domain';
import { ensureWebAuthUser, webAuthTenant } from '../auth';
import { getFactoryStorage } from '../runtime-config';
import { getFactoryProjectsStorage, getQueueHealthStorage } from '../storage/domains';
import { clampMetricsWindow, computeFactoryMetrics } from './metrics';
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
  WorkItemRelationError,
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
 * Resolve the tenant AND the org-owned project from the `:id` param. Work
 * items hang off a project, so listing/creating requires the project to exist
 * in the caller's org.
 */
async function resolveProject(
  c: Context,
): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
  const tenant = await resolveTenant(c);
  if ('response' in tenant) return tenant;

  const projectId = c.req.param('id');
  if (!projectId || !UUID_RE.test(projectId)) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('projects');
  const project = await getFactoryProjectsStorage().get({ orgId: tenant.orgId, id: projectId });
  if (!project) {
    return { response: c.json({ error: 'Project not found' }, 404) };
  }
  return { ...tenant, factoryProjectId: projectId };
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
async function auditWorkItemPatch({
  audit,
  context,
  item,
  previous,
  patch,
}: {
  audit: AuditEmitter;
  context: Context;
  item: WorkItemRow;
  previous: WorkItemPriorState;
  patch: Record<string, unknown>;
}): Promise<void> {
  const target = { type: 'work_item', id: item.id, name: item.title };
  await audit.emit({
    context,
    input: {
      action: 'factory.work_item.updated',
      factoryProjectId: item.factoryProjectId,
      targets: [target],
      metadata: { fields: patchedFields(patch) },
    },
  });

  const stagesChanged =
    patch.stages !== undefined &&
    (previous.stages.length !== item.stages.length || previous.stages.some((s, i) => s !== item.stages[i]));
  if (stagesChanged) {
    await audit.emit({
      context,
      input: {
        action: 'factory.work_item.stage_moved',
        factoryProjectId: item.factoryProjectId,
        targets: [target],
        metadata: { from: previous.stages, to: item.stages },
      },
    });
  }

  const newRoles = Object.keys(item.sessions).filter(role => !previous.sessionRoles.includes(role));
  for (const role of newRoles) {
    const session = item.sessions[role];
    await audit.emit({
      context,
      input: {
        action: 'factory.run.started',
        factoryProjectId: item.factoryProjectId,
        targets: [target],
        metadata: {
          role,
          branch: session?.branch,
          threadId: session?.threadId,
          projectPath: session?.projectPath,
        },
      },
    });
  }
}

/** Build the Factory work-item routes as Mastra `apiRoutes`. */
export function buildFactoryRoutes({ audit }: { audit: AuditEmitter }): ApiRoute[] {
  return [
    // ── List the org's work items for a project ─────────────────────────────
    registerApiRoute('/web/factory/projects/:id/work-items', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;
        const items = await listWorkItems({ orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId });
        return c.json({ workItems: items });
      },
    }),

    // ── Flow metrics aggregated over the project's work items ───────────────
    registerApiRoute('/web/factory/projects/:id/metrics', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;
        const days = clampMetricsWindow(loose(c).req.query('days'));
        const items = await listWorkItems({ orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId });
        return c.json({ metrics: computeFactoryMetrics(items, { days, now: new Date() }) });
      },
    }),

    // ── Per-project queue-health age-threshold config (seconds) ─────────────
    registerApiRoute('/web/factory/projects/:id/health/thresholds', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;
        const factoryStorage = getFactoryStorage();
        await factoryStorage.ensureDomainReady('queue-health');
        const stored = await getQueueHealthStorage().getConfig(resolved.orgId, resolved.factoryProjectId);
        // Validate at the read choke point: `getConfig` round-trips a stored
        // JSONB row, and only `saveConfig` validates on write — a corrupted or
        // hand-edited row (empty / non-ascending) would otherwise flow to the
        // chart and invert bucket colors. Fall back to the default on invalid.
        return c.json({ thresholds: thresholdsOrDefault(stored) });
      },
    }),

    // ── Create (upsert on sourceKey) a work item ─────────────────────────────
    registerApiRoute('/web/factory/projects/:id/work-items', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;

        const body = await readJson(loose(c));
        if (body === undefined) return c.json({ error: 'Invalid JSON body' }, 400);
        const input = parseCreateWorkItem(body);
        if (!input) return c.json({ error: 'invalid_work_item' }, 400);

        try {
          const result = await upsertWorkItem({
            orgId: resolved.orgId,
            userId: resolved.userId,
            factoryProjectId: resolved.factoryProjectId,
            input,
          });
          const item = result.item;
          if (result.created) {
            await audit.emit({
              context: loose(c),
              input: {
                action: 'factory.work_item.created',
                factoryProjectId: resolved.factoryProjectId,
                targets: [{ type: 'work_item', id: item.id, name: item.title }],
                metadata: { externalSource: item.externalSource, stages: item.stages },
              },
            });
          } else {
            await auditWorkItemPatch({
              audit,
              context: loose(c),
              item,
              previous: result.previous,
              patch: input as unknown as Record<string, unknown>,
            });
          }
          return c.json({ workItem: item });
        } catch (error) {
          if (error instanceof WorkItemRelationError) {
            return c.json({ error: error.code, message: error.message }, 400);
          }
          throw error;
        }
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

        try {
          const updated = await updateWorkItem({ orgId: tenant.orgId, id, userId: tenant.userId, patch });
          if (!updated) return c.json({ error: 'Work item not found' }, 404);
          await auditWorkItemPatch({
            audit,
            context: loose(c),
            item: updated.item,
            previous: updated.previous,
            patch: patch as Record<string, unknown>,
          });
          return c.json({ workItem: updated.item });
        } catch (error) {
          if (error instanceof WorkItemRelationError) {
            return c.json({ error: error.code, message: error.message }, 400);
          }
          throw error;
        }
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

        const deleted = await deleteWorkItem({ orgId: tenant.orgId, id });
        if (!deleted) return c.json({ error: 'Work item not found' }, 404);
        await audit.emit({
          context: loose(c),
          input: {
            action: 'factory.work_item.deleted',
            factoryProjectId: deleted.factoryProjectId,
            targets: [{ type: 'work_item', id: deleted.id, name: deleted.title }],
          },
        });
        return c.json({ ok: true });
      },
    }),
  ];
}
