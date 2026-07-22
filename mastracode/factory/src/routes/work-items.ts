/**
 * Mastra `apiRoutes` for Factory work items (the kanban board).
 *
 * Registered alongside the other `/web/*` routes behind the host auth gate.
 * The board is org-wide: every route re-resolves the caller's `(orgId, userId)`
 * tenant and scopes reads/writes by `orgId`, so any org member sees and moves
 * the same cards while `created_by` / stage history record who acted.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type {
  FactoryStartCoordinator,
  FactoryStartPreparedResult,
  FactoryStartRequest,
} from '../rules/start-coordinator';
import { FactoryStartTransitionError } from '../rules/start-coordinator';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service';
import type { FactoryRuleBoard, FactoryRuleStage } from '../rules/types';
import { FACTORY_RULE_BOARDS, FACTORY_RULE_STAGES } from '../rules/types';
import type { AuditEmitter } from '../storage/domains/audit/domain';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base';
import type {
  CreateWorkItemInput,
  ExternalWorkItemSource,
  FactoryDeferredDecisionRecord,
  FactoryDispatchStatus,
  UpdateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemStage,
  WorkItemsStorage,
} from '../storage/domains/work-items/base';
import { WorkItemRelationError } from '../storage/domains/work-items/base';
import { clampMetricsWindow, computeFactoryMetrics } from '../storage/domains/work-items/metrics';
import type { RouteDependencies } from './route';
import { Route } from './route';

export interface WorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Work-items domain backing the kanban board. */
  workItems: WorkItemsStorage;
  /** Per-project queue-health threshold config. */
  queueHealth: QueueHealthStorage;
  /** Governed stage-transition service. Stage moves 503 when absent. */
  transitionService?: Pick<FactoryTransitionService, 'transition' | 'ruleSetVersion'>;
  /** Coordinator that binds a Factory run before dispatching its kickoff. */
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
}

function loose(c: unknown): Context {
  return c as Context;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_STAGES = 16;
const MAX_STAGE_LENGTH = 64;
const MAX_METADATA_BYTES = 16 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStages(value: unknown): value is WorkItemStage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_STAGES &&
    value.every(
      stage => typeof stage === 'string' && stage.length <= MAX_STAGE_LENGTH && /^[a-z0-9][a-z0-9_-]*$/i.test(stage),
    ) &&
    new Set(value).size === value.length
  );
}

function validMetadata(value: unknown): value is Record<string, unknown> | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  try {
    return JSON.stringify(value).length <= MAX_METADATA_BYTES;
  } catch {
    return false;
  }
}

function parseExternalSource(value: unknown): ExternalWorkItemSource | null | undefined {
  if (value === undefined || value === null) return value;
  if (!isRecord(value)) return undefined;
  const { integrationId, type, externalId, url } = value;
  if (typeof integrationId !== 'string' || integrationId.length === 0 || integrationId.length > 128) return undefined;
  if (typeof type !== 'string' || type.length === 0 || type.length > 128) return undefined;
  if (typeof externalId !== 'string' || externalId.length === 0 || externalId.length > 512) return undefined;
  if (url !== undefined && (typeof url !== 'string' || url.length > 2048)) return undefined;
  return { integrationId, type, externalId, ...(url !== undefined ? { url } : {}) };
}

function parseParentWorkItemId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) return undefined;
  return value;
}

function parseSessions(value: unknown): Record<string, WorkItemSessionInput> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, WorkItemSessionInput> = {};
  for (const [role, session] of Object.entries(value)) {
    if (!role || role.length > 64 || !isRecord(session)) return undefined;
    const { projectPath, branch, threadId } = session;
    if (typeof projectPath !== 'string' || projectPath.length === 0 || projectPath.length > 2048) return undefined;
    if (typeof branch !== 'string' || branch.length === 0 || branch.length > 512) return undefined;
    if (typeof threadId !== 'string' || threadId.length === 0 || threadId.length > 512) return undefined;
    out[role] = { projectPath, branch, threadId };
  }
  return out;
}

/** Validate an untrusted create body. Unknown keys are dropped. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { externalSource, title, stages, sessions, metadata } = body;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 500) return null;

  const hasParentWorkItemId = 'parentWorkItemId' in body;
  const parentWorkItemId = hasParentWorkItemId ? parseParentWorkItemId(body.parentWorkItemId) : undefined;
  if (hasParentWorkItemId && parentWorkItemId === undefined) return null;
  const parsedSource = parseExternalSource(externalSource);
  if (externalSource !== undefined && parsedSource === undefined) return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    title: title.trim(),
    ...(parsedSource !== undefined ? { externalSource: parsedSource } : {}),
    ...(hasParentWorkItemId ? { parentWorkItemId: parentWorkItemId ?? null } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** Validate an untrusted patch body. Unknown keys are dropped. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { title, stages, sessions, metadata } = body;
  const hasParentWorkItemId = 'parentWorkItemId' in body;
  if (
    title === undefined &&
    stages === undefined &&
    sessions === undefined &&
    metadata === undefined &&
    !hasParentWorkItemId
  )
    return null;
  const parentWorkItemId = hasParentWorkItemId ? parseParentWorkItemId(body.parentWorkItemId) : undefined;
  if (hasParentWorkItemId && parentWorkItemId === undefined) return null;
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 500))
    return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    ...(hasParentWorkItemId ? { parentWorkItemId: parentWorkItemId ?? null } : {}),
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
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

function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : undefined;
}

function parseTransitionBody(
  body: unknown,
): Omit<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId' | 'actor'> | null {
  if (!isRecord(body)) return null;
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
  if (!isRecord(body) || !isRecord(body.workItem)) return null;
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
  const threadTags = isRecord(body.threadTags)
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

export class WorkItemRoutes extends Route<WorkItemRoutesDeps> {
  /** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The Factory board requires an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  /**
   * Resolve the tenant AND the org-owned project from the `:id` param. Work
   * items hang off a project, so listing/creating requires the project to
   * exist in the caller's org.
   */
  async #resolveProject(
    c: Context,
  ): Promise<{ orgId: string; userId: string; factoryProjectId: string } | { response: Response }> {
    const tenant = await this.#resolveTenant(c);
    if ('response' in tenant) return tenant;

    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    const { projects } = this.deps;
    await projects.ensureReady();
    const project = await projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    return { ...tenant, factoryProjectId: projectId };
  }

  /**
   * Emit the audit events a successful work-item PATCH implies: always
   * `updated`, plus `stage_moved` when the stages actually changed and one
   * `run.started` per session role the patch introduced.
   */
  async #auditWorkItemPatch({
    context,
    item,
    previous,
    patch,
  }: {
    context: Context;
    item: WorkItemRow;
    previous: WorkItemPriorState;
    patch: Record<string, unknown>;
  }): Promise<void> {
    const { audit } = this.deps;
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
  routes(): ApiRoute[] {
    const { audit, workItems, queueHealth, transitionService, startCoordinator } = this.deps;
    return [
      // ── List the org's work items for a project ─────────────────────────────
      registerApiRoute('/web/factory/projects/:id/work-items', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({ workItems: items });
        },
      }),

      // ── Flow metrics aggregated over the project's work items ───────────────
      registerApiRoute('/web/factory/projects/:id/metrics', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const days = clampMetricsWindow(loose(c).req.query('days'));
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({ metrics: computeFactoryMetrics({ items, days, now: new Date() }) });
        },
      }),

      // ── Per-project queue-health age-threshold config (seconds) ─────────────
      registerApiRoute('/web/factory/projects/:id/health/thresholds', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          await queueHealth.ensureReady();
          const stored = await queueHealth.getConfig(resolved.orgId, resolved.factoryProjectId);
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
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;

          const cursorRaw = context.req.query('before');
          const before = parseDecisionCursor(cursorRaw);
          if (cursorRaw && !before) return c.json({ error: 'invalid_cursor' }, 400);
          await workItems.ensureReady();
          const page = await workItems.listDeferredDecisionPage({
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
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const decisionId = context.req.param('decisionId');
          if (!decisionId || !UUID_RE.test(decisionId)) return c.json({ error: 'invalid_decision_id' }, 422);
          await workItems.ensureReady();
          const decision = await workItems.retryDeferredDecision(
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
          const resolved = await this.#resolveProject(loose(c));
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

          await workItems.ensureReady();
          try {
            const result = await workItems.upsert({
              orgId: resolved.orgId,
              userId: resolved.userId,
              factoryProjectId: resolved.factoryProjectId,
              input,
              reuseMode: 'non-stage',
            });
            let item = result.item;
            if (result.created) {
              if (!transitionService) {
                await workItems.delete({ orgId: resolved.orgId, id: item.id });
                return c.json({ error: 'factory_transitions_unavailable' }, 503);
              }
              const entered = await transitionService.transition({
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
                await workItems.delete({ orgId: resolved.orgId, id: item.id });
                return c.json({ status: 'rejected', code: entered.code, reason: entered.reason }, 422);
              }
              item = (await workItems.getForProject(resolved.orgId, resolved.factoryProjectId, item.id)) ?? item;
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
              // Source-key reuse: the POST updated an existing card, so audit it
              // as an update (plus stage/run events) instead of a false creation.
              const { stages: _stages, sessions: _sessions, ...boundedPatch } = input;
              await this.#auditWorkItemPatch({
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
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const workItemId = loose(c).req.param('workItemId');
          if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);
          const parsed = parseTransitionBody(await readJson(loose(c)));
          if (!parsed) return c.json({ error: 'invalid_transition_request' }, 400);
          if (!transitionService) {
            return c.json({ error: 'factory_transition_unavailable' }, 503);
          }
          await workItems.ensureReady();
          const result = await transitionService.transition({
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
                result.status === 'accepted'
                  ? 'factory.work_item.stage_moved'
                  : 'factory.work_item.transition_rejected',
              factoryProjectId: resolved.factoryProjectId,
              targets: [{ type: 'work_item', id: workItemId }],
              metadata: {
                transitionId: result.transitionId,
                ingressType: parsed.ingress.type,
                ruleSetVersion: transitionService.ruleSetVersion,
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
          const resolved = await this.#resolveProject(loose(c));
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
          await workItems.ensureReady();
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
          const tenant = await this.#resolveTenant(loose(c));
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

          await workItems.ensureReady();
          try {
            const updated = await workItems.update({ orgId: tenant.orgId, id, userId: tenant.userId, patch });
            if (!updated) return c.json({ error: 'Work item not found' }, 404);
            await this.#auditWorkItemPatch({
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
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          const id = loose(c).req.param('id');
          if (!id || !UUID_RE.test(id)) return c.json({ error: 'Work item not found' }, 404);

          await workItems.ensureReady();
          const deleted = await workItems.delete({ orgId: tenant.orgId, id });
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
}
