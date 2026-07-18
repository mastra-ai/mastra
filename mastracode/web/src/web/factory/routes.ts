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
import { FactoryStartCoordinator, FactoryStartTransitionError } from './rules/start-coordinator';
import type { FactoryStartPreparedResult, FactoryStartRequest } from './rules/start-coordinator';
import { FactoryTransitionService } from './rules/transition-service';
import type { FactoryTransitionRequest } from './rules/transition-service';
import { FACTORY_RULE_BOARDS, FACTORY_RULE_STAGES } from './rules/types';
import type { FactoryRuleBoard, FactoryRuleStage } from './rules/types';
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

interface FactoryRoutesOptions {
  transitionService?: Pick<FactoryTransitionService, 'transition' | 'ruleSetVersion'>;
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : undefined;
}

function parseTransitionBody(
  body: unknown,
): Omit<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId' | 'actor'> | null {
  if (!plainObject(body)) return null;
  const board = FACTORY_RULE_BOARDS.includes(body.board as FactoryRuleBoard)
    ? (body.board as FactoryRuleBoard)
    : undefined;
  const stage = FACTORY_RULE_STAGES.includes(body.stage as FactoryRuleStage)
    ? (body.stage as FactoryRuleStage)
    : undefined;
  const requestId = boundedText(body.requestId, 256);
  const cause = boundedText(body.cause, 256);
  if (
    !board ||
    !stage ||
    !requestId ||
    !UUID_RE.test(requestId) ||
    !cause ||
    !Number.isInteger(body.expectedRevision) ||
    Number(body.expectedRevision) < 1
  ) {
    return null;
  }
  return {
    board,
    stage,
    expectedRevision: Number(body.expectedRevision),
    ingress: { type: 'human', identity: requestId },
    cause,
  };
}

function parseStartBody(
  body: unknown,
  tenant: { orgId: string; userId: string },
  factoryProjectId: string,
): FactoryStartRequest | null {
  if (!plainObject(body) || !plainObject(body.workItem)) return null;
  const input = parseCreateWorkItem(body.workItem.input);
  const resourceId = boundedText(body.resourceId, 256);
  const projectPath = boundedText(body.projectPath, 2_048);
  const branch = boundedText(body.branch, 256);
  const threadTitle = boundedText(body.threadTitle, 512);
  const kickoffKey = boundedText(body.kickoffKey, 256);
  const destinationStage = FACTORY_RULE_STAGES.includes(body.destinationStage as FactoryRuleStage)
    ? (body.destinationStage as FactoryRuleStage)
    : undefined;
  const role = boundedText(body.workItem.role, 32);
  const id = body.workItem.id === undefined ? undefined : boundedText(body.workItem.id, 64);
  const kickoffMessage = body.kickoffMessage === null ? null : boundedText(body.kickoffMessage, 16_384);
  if (
    !input ||
    !resourceId ||
    !projectPath ||
    !branch ||
    !threadTitle ||
    !kickoffKey ||
    !UUID_RE.test(kickoffKey) ||
    !destinationStage ||
    !role ||
    kickoffMessage === undefined
  ) {
    return null;
  }
  if (id && !UUID_RE.test(id)) return null;
  const threadTags = plainObject(body.threadTags)
    ? Object.fromEntries(
        Object.entries(body.threadTags)
          .filter(
            (entry): entry is [string, string] =>
              boundedText(entry[0], 64) !== undefined && boundedText(entry[1], 256) !== undefined,
          )
          .map(([key, value]) => [key, value.trim()]),
      )
    : undefined;
  return {
    ...tenant,
    factoryProjectId,
    resourceId,
    projectPath,
    branch,
    threadTitle,
    threadTags,
    kickoffKey,
    kickoffMessage,
    destinationStage,
    workItem: { id, role, input },
  };
}

/** Build the Factory work-item routes as Mastra `apiRoutes`. */
export function buildFactoryRoutes({
  audit,
  transitionService,
  startCoordinator,
}: { audit: AuditEmitter } & FactoryRoutesOptions): ApiRoute[] {
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
        if ((input.stages ?? ['intake']).length !== 1 || (input.stages ?? ['intake'])[0] !== 'intake') {
          return c.json(
            { error: 'governed_transition_required', message: 'New work items must enter through Factory intake.' },
            409,
          );
        }

        try {
          const result = await upsertWorkItem({
            orgId: resolved.orgId,
            userId: resolved.userId,
            factoryProjectId: resolved.factoryProjectId,
            input,
            reuseMode: 'non-stage',
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
            const { stages: _stages, sessions: _sessions, ...boundedPatch } = input;
            await auditWorkItemPatch({
              audit,
              context: loose(c),
              item,
              previous: result.previous,
              patch: boundedPatch as unknown as Record<string, unknown>,
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

    // ── Authoritative stage transition ──────────────────────────────────────
    registerApiRoute('/web/factory/projects/:id/work-items/:workItemId/transition', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;
        const workItemId = loose(c).req.param('workItemId');
        if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);
        const parsed = parseTransitionBody(await readJson(loose(c)));
        if (!parsed) return c.json({ error: 'invalid_transition_request' }, 400);
        const service = transitionService ?? new FactoryTransitionService();
        const result = await service.transition({
          ...parsed,
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          workItemId,
          actor: { type: 'human', id: resolved.userId },
          ingress: {
            ...parsed.ingress,
            identity: `human:${resolved.userId}:${parsed.ingress.identity}`,
          },
        });
        await audit.emit({
          context: loose(c),
          input: {
            action:
              result.status === 'accepted' ? 'factory.work_item.stage_moved' : 'factory.work_item.transition_rejected',
            factoryProjectId: resolved.factoryProjectId,
            targets: [{ type: 'work_item', id: workItemId }],
            metadata: {
              transitionId: result.transitionId,
              ingressType: parsed.ingress.type,
              ruleSetVersion: service.ruleSetVersion,
              ...(result.status === 'accepted'
                ? { to: result.stage, revision: result.revision }
                : { code: result.code, reason: result.reason }),
            },
          },
        });
        if (result.status === 'accepted') return c.json({ result });
        return c.json({ result }, result.code === 'stale' ? 409 : 422);
      },
    }),

    // ── Bind a Factory run before dispatching its kickoff ────────────────────
    registerApiRoute('/web/factory/projects/:id/runs/start', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const resolved = await resolveProject(loose(c));
        if ('response' in resolved) return resolved.response;
        if (!startCoordinator) {
          return c.json({ error: 'factory_start_unavailable' }, 503);
        }
        const input = parseStartBody(await readJson(loose(c)), resolved, resolved.factoryProjectId);
        if (!input) return c.json({ error: 'invalid_factory_start' }, 400);
        if (
          !input.workItem.id &&
          ((input.workItem.input.stages ?? ['intake']).length !== 1 ||
            (input.workItem.input.stages ?? ['intake'])[0] !== 'intake')
        ) {
          return c.json(
            { error: 'governed_transition_required', message: 'Create the work item in Intake before starting it.' },
            409,
          );
        }
        let prepared: FactoryStartPreparedResult;
        try {
          prepared = await startCoordinator.prepare(input);
        } catch (error) {
          if (error instanceof FactoryStartTransitionError) {
            return c.json({ result: error.result }, error.result.code === 'stale' ? 409 : 422);
          }
          throw error;
        }
        await audit.emit({
          context: loose(c),
          input: {
            action: 'factory.run.started',
            factoryProjectId: resolved.factoryProjectId,
            targets: [{ type: 'work_item', id: prepared.workItemId }],
            metadata: {
              role: input.workItem.role,
              branch: prepared.branch,
              threadId: prepared.threadId,
              projectPath: prepared.projectPath,
              bindingId: prepared.bindingId,
            },
          },
        });
        return c.json({ prepared }, 202);
      },
    }),

    // ── Patch non-stage metadata / sessions / title ──────────────────────────
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
        if (patch.stages !== undefined) {
          return c.json(
            { error: 'governed_transition_required', message: 'Use the Factory transition endpoint to move stages.' },
            409,
          );
        }

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
