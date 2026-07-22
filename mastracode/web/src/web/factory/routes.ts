/**
 * Mastra `apiRoutes` for Factory work items (the kanban board).
 *
 * Registered alongside the other `/web/*` routes behind the WorkOS auth gate.
 * The board is org-wide: every route re-resolves the caller's `(orgId, userId)`
 * tenant and scopes reads/writes by `orgId`, so any org member sees and moves
 * the same cards while `created_by` / stage history record who acted.
 */

import { Buffer } from 'node:buffer';

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { AuditEmitter } from '../audit/domain';
import { ensureWebAuthUser, webAuthTenant } from '../auth';
import type { FactoryIntegration } from '../factory-integration';
import { getFactoryStorage } from '../runtime-config';
import { getFactoryProjectsStorage, getQueueHealthStorage, getWorkItemsStorage } from '../storage/domains';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import type {
  FactoryDeferredDecisionRecord,
  FactoryDispatchStatus,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base';
import { clampMetricsWindow, computeFactoryMetrics } from './metrics';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base';
import { loadFactoryThreadTaskContext } from './thread-context';
import type { LinearTaskContextIntegration } from './thread-context';
import { FactoryStartCoordinator, FactoryStartTransitionError } from './rules/start-coordinator';
import type { FactoryStartPreparedResult, FactoryStartRequest } from './rules/start-coordinator';
import { FactoryTransitionService } from './rules/transition-service';
import type { FactoryTransitionRequest } from './rules/transition-service';
import { FACTORY_RULE_BOARDS, FACTORY_RULE_STAGES } from './rules/types';
import type { FactoryRuleBoard, FactoryRuleStage } from './rules/types';
import type { WorkItemPriorState } from './store';
import {
  deleteWorkItem,
  getWorkItem,
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

const DECISION_STATUSES = new Set<FactoryDispatchStatus>(['pending', 'leased', 'retry', 'succeeded', 'failed']);
const DEFAULT_DECISION_PAGE_SIZE = 25;
const MAX_DECISION_PAGE_SIZE = 50;

function parseDecisionStatuses(raw: string | undefined): FactoryDispatchStatus[] | undefined {
  if (!raw) return undefined;
  const statuses = [...new Set(raw.split(',').map(status => status.trim()))].filter(
    (status): status is FactoryDispatchStatus => DECISION_STATUSES.has(status as FactoryDispatchStatus),
  );
  return statuses.length > 0 ? statuses : undefined;
}

function parseDecisionLimit(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_DECISION_PAGE_SIZE;
  if (!Number.isFinite(parsed)) return DEFAULT_DECISION_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_DECISION_PAGE_SIZE, parsed));
}

function encodeDecisionCursor(decision: FactoryDeferredDecisionRecord): string {
  return Buffer.from(JSON.stringify([decision.createdAt.toISOString(), decision.id]), 'utf8').toString('base64url');
}

function parseDecisionCursor(raw: string | undefined): { createdAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== 'string' ||
      typeof decoded[1] !== 'string'
    ) {
      return undefined;
    }
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime()) || !UUID_RE.test(decoded[1])) return undefined;
    return { createdAt, id: decoded[1] };
  } catch {
    return undefined;
  }
}

function decisionSummary(decision: FactoryDeferredDecisionRecord) {
  const type = typeof decision.decision.type === 'string' ? decision.decision.type.slice(0, 64) : 'unknown';
  return {
    id: decision.id,
    evaluationId: decision.evaluationId,
    workItemId: decision.workItemId,
    type,
    status: decision.status,
    attempts: decision.attempts,
    lastError: decision.lastError?.slice(0, 512) ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
    completedAt: decision.completedAt?.toISOString() ?? null,
  };
}

export interface FactoryRoutesOptions {
  transitionService?: Pick<FactoryTransitionService, 'transition' | 'ruleSetVersion'>;
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
  decisionStorage?: Pick<WorkItemsStorage, 'listDeferredDecisionPage' | 'retryDeferredDecision'>;
  taskContext?: {
    sourceControlStorage?: SourceControlStorageHandle;
    githubIntegration?: FactoryIntegration;
    ensureGithubReady?: () => Promise<void>;
    linearIntegration?: LinearTaskContextIntegration;
    ensureLinearReady?: () => Promise<void>;
  };
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
  if (body.workItem.id !== undefined && (!id || !UUID_RE.test(id))) return null;
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
  decisionStorage,
  taskContext,
}: { audit: AuditEmitter } & FactoryRoutesOptions): ApiRoute[] {
  return [
    // ── Task context for one exact Factory session binding ─────────────────
    registerApiRoute('/web/factory/projects/:id/threads/:threadId/context', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const threadId = boundedText(context.req.param('threadId'), 512);
        const resourceId = boundedText(context.req.query('resourceId'), 256);
        const projectPath = boundedText(context.req.query('projectPath'), 2_048);
        if (!threadId || !resourceId || !projectPath) {
          return c.json(
            { error: 'invalid_session_address', message: 'The Factory session address is incomplete.' },
            400,
          );
        }
        const storage = getFactoryStorage();
        await storage.ensureDomainReady('work-items');
        const workItems = getWorkItemsStorage();
        const binding = await workItems.findRunBinding({
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          threadId,
          resourceId,
          projectPath,
        });
        if (!binding) return c.json({ context: null });
        const workItem = await workItems.getForProject(resolved.orgId, resolved.factoryProjectId, binding.workItemId);
        if (!workItem) throw new Error('Factory run binding references a missing work item.');
        const loaded = await loadFactoryThreadTaskContext({
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          workItem,
          ...taskContext,
        });
        return c.json({ context: loaded });
      },
    }),

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

    // ── Bounded durable rule-decision status ────────────────────────────────
    registerApiRoute('/web/factory/projects/:id/decisions', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await resolveProject(context);
        if ('response' in resolved) return resolved.response;
        if (!decisionStorage) return c.json({ error: 'factory_decisions_unavailable' }, 503);

        const cursorRaw = context.req.query('before');
        const before = parseDecisionCursor(cursorRaw);
        if (cursorRaw && !before) return c.json({ error: 'invalid_cursor' }, 400);
        const page = await decisionStorage.listDeferredDecisionPage({
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          statuses: parseDecisionStatuses(context.req.query('statuses')),
          before,
          limit: parseDecisionLimit(context.req.query('limit')),
        });
        const last = page.decisions.at(-1);
        return c.json({
          decisions: page.decisions.map(decisionSummary),
          ...(page.hasMore && last ? { nextCursor: encodeDecisionCursor(last) } : {}),
        });
      },
    }),

    registerApiRoute('/web/factory/projects/:id/decisions/:decisionId/retry', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await resolveProject(context);
        if ('response' in resolved) return resolved.response;
        if (!decisionStorage) return c.json({ error: 'factory_decisions_unavailable' }, 503);
        const decisionId = context.req.param('decisionId');
        if (!decisionId || !UUID_RE.test(decisionId)) return c.json({ error: 'invalid_decision_id' }, 422);
        const decision = await decisionStorage.retryDeferredDecision(
          resolved.orgId,
          resolved.factoryProjectId,
          decisionId,
          new Date(),
        );
        if (!decision) return c.json({ error: 'decision_not_retryable' }, 409);
        return c.json({ decision: decisionSummary(decision) });
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
          let item = result.item;
          if (result.created) {
            const service = transitionService ?? new FactoryTransitionService();
            const entered = await service.transition({
              orgId: resolved.orgId,
              factoryProjectId: resolved.factoryProjectId,
              workItemId: item.id,
              board: item.externalSource?.type === 'pull-request' ? 'review' : 'work',
              stage: 'intake',
              expectedRevision: item.revision,
              actor: { type: 'human', id: resolved.userId },
              ingress: { type: 'human', identity: `work-item:${item.id}:initial-entry` },
              cause: 'work_item_created',
              initialEntry: true,
            });
            if (entered.status === 'rejected') {
              await deleteWorkItem({ orgId: resolved.orgId, id: item.id });
              return c.json({ status: 'rejected', code: entered.code, reason: entered.reason }, 422);
            }
            item =
              (await getWorkItem({
                orgId: resolved.orgId,
                factoryProjectId: resolved.factoryProjectId,
                id: item.id,
              })) ?? item;
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
