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

import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type {
  FactoryStartCoordinator,
  FactoryStartPreparedResult,
  FactoryStartRequest,
} from '../rules/start-coordinator.js';
import { FactoryStartTransitionError } from '../rules/start-coordinator.js';
import { roleForStage } from '../rules/transition-service.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { WorkItemSource } from '../rules/types.js';
import { isFactoryRuleStage } from '../rules/types.js';
import type { LiveSessions } from '../session/live-sessions.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base.js';
import type {
  CreateWorkItemInput,
  FactoryDeferredDecisionRecord,
  FactoryDispatchStatus,
  UpdateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  FACTORY_RULE_MATERIALIZATION_KEY,
  WorkItemRelationError,
} from '../storage/domains/work-items/base.js';
import { computeFactoryMetrics, parseMetricsRange } from '../storage/domains/work-items/metrics.js';
import { buildAttentionRoutes, factoryDecisionType } from './attention.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';
import { buildSupervisorRoutes } from './supervisor.js';

export interface WorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Work-items domain backing the kanban board. */
  workItems: WorkItemsStorage;
  /** Comments domain — backs the mention attention provider. */
  comments: WorkItemCommentsStorage;
  /** Per-project queue-health threshold config. */
  queueHealth: QueueHealthStorage;
  /** Governed stage-transition service. Stage moves 503 when absent. */
  transitionService?: Pick<FactoryTransitionService, 'transition' | 'ruleSetVersion'>;
  /** Coordinator that binds a Factory run before dispatching its kickoff. */
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
  /** Materialized sessions, read to report which of the listed cards are being worked. */
  liveSessions: Pick<LiveSessions, 'isRunning'>;
}

/** The card as clients see it, without the dispatcher's internal bookkeeping. */
function toWireWorkItem(item: WorkItemRow): WorkItemRow {
  if (
    !item.metadata ||
    (!(FACTORY_RULE_MATERIALIZATION_KEY in item.metadata) &&
      !(FACTORY_PULL_REQUEST_RECONCILIATION_KEY in item.metadata))
  ) {
    return item;
  }
  return { ...item, metadata: publicWorkItemMetadata(item.metadata) ?? {} };
}

/** Session ids of the listed cards whose agent run is in flight. */
function runningSessionIds(items: WorkItemRow[], liveSessions: Pick<LiveSessions, 'isRunning'>): string[] {
  const running = new Set<string>();
  for (const item of items) {
    for (const { sessionId } of Object.values(item.sessions)) {
      if (liveSessions.isRunning(sessionId)) running.add(sessionId);
    }
  }
  return [...running];
}

function loose(c: unknown): Context {
  return c as Context;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicWorkItemMetadata(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (value === null) return null;
  const {
    [FACTORY_RULE_MATERIALIZATION_KEY]: _materialization,
    [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: _reconciliation,
    ...metadata
  } = value;
  return metadata;
}

/** Validate an untrusted create body. Unknown keys are dropped. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemCreate.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Validate an untrusted patch body. Unknown keys are dropped. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemUpdate.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
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

function parseTransitionBody(
  body: unknown,
): Omit<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId' | 'actor'> | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemTransition.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function parseStartBody(
  body: unknown,
  tenant: { orgId: string; userId: string },
  factoryProjectId: string,
): FactoryStartRequest | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemStart.bodySchema.safeParse(body);
  return parsed.success ? { ...tenant, factoryProjectId, ...parsed.data } : null;
}

const DECISION_STATUSES = new Set<FactoryDispatchStatus>([
  'pending',
  'proposed',
  'dismissed',
  'superseded',
  'leased',
  'retry',
  'succeeded',
  'failed',
]);
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

/** A proposed transition names the seat its lane addresses, so the card can label what approving starts. */
function summaryRole(decision: Record<string, unknown>): string | null {
  if (typeof decision.role === 'string') return decision.role.slice(0, 32);
  if (decision.type !== 'transition') return null;
  const board = decision.board;
  const stage = decision.stage;
  if ((board !== 'work' && board !== 'review') || !isFactoryRuleStage(stage)) return null;
  return roleForStage(board, stage);
}

/** A linked-card decision names where the card is synced from, so the UI can say "GitHub" rather than "a linked card". */
function summarySource(decision: Record<string, unknown>): WorkItemSource | null {
  if (decision.type !== 'upsertLinkedWorkItem') return null;
  const source = decision.source;
  return source === 'github-issue' || source === 'github-pr' || source === 'linear-issue' || source === 'manual'
    ? source
    : null;
}

function decisionSummary(decision: FactoryDeferredDecisionRecord) {
  return {
    id: decision.id,
    evaluationId: decision.evaluationId,
    workItemId: decision.workItemId,
    type: factoryDecisionType(decision),
    role: summaryRole(decision.decision),
    source: summarySource(decision.decision),
    status: decision.status,
    attempts: decision.attempts,
    failureOccurrence: decision.failureOccurrence,
    failureCode: decision.failureCode,
    canRetry: factoryDispatchFailureMetadata(decision.failureCode).canRetry,
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
  ): Promise<
    { orgId: string; userId: string; factoryProjectId: string; defaultModelId: string | null } | { response: Response }
  > {
    const tenant = await this.#resolveTenant(c);
    if ('response' in tenant) return tenant;

    const parsedPath = FACTORY_ROUTE_CONTRACTS.projectGet.pathSchema.safeParse({ id: c.req.param('id') });
    if (!parsedPath.success) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    const projectId = parsedPath.data.id;
    const { projects } = this.deps;
    await projects.ensureReady();
    const project = await projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    return { ...tenant, factoryProjectId: projectId, defaultModelId: project.defaultModelId };
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
            sessionId: session?.sessionId,
          },
        },
      });
    }
  }

  /** Releasing a parked run and dropping it: same request, opposite outcomes, both audited as consent. */
  #proposalRoute({
    verb,
    settle,
  }: {
    verb: 'approve' | 'dismiss';
    settle: (
      orgId: string,
      factoryProjectId: string,
      decisionId: string,
      now: Date,
      userId: string,
    ) => Promise<FactoryDeferredDecisionRecord | null>;
  }): ApiRoute {
    const { audit, workItems } = this.deps;
    const contract =
      verb === 'approve' ? FACTORY_ROUTE_CONTRACTS.decisionApprove : FACTORY_ROUTE_CONTRACTS.decisionDismiss;
    return registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await this.#resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const parsedPath = contract.pathSchema.safeParse({
          id: resolved.factoryProjectId,
          decisionId: context.req.param('decisionId'),
        });
        if (!parsedPath.success) return c.json({ error: 'invalid_decision_id' }, 422);
        const { decisionId } = parsedPath.data;
        await workItems.ensureReady();
        const now = new Date();
        const decision = await settle(resolved.orgId, resolved.factoryProjectId, decisionId, now, resolved.userId);
        if (!decision) return c.json({ error: 'decision_not_proposed' }, 409);
        // Releasing a proposal is a person taking the item on. Approval arms the
        // item's autonomy inside the same storage transaction (see
        // approveDeferredDecision), so follow-up runs no longer wait for approval.
        await audit.emit({
          context,
          input: {
            action: verb === 'approve' ? 'factory.run.approved' : 'factory.run.dismissed',
            factoryProjectId: resolved.factoryProjectId,
            targets: decision.workItemId
              ? [{ type: 'work_item', id: decision.workItemId }]
              : [{ type: 'rule_decision', id: decision.id }],
            metadata: { decisionId: decision.id, effect: factoryDecisionType(decision) },
          },
        });
        return c.json({ decision: decisionSummary(decision) });
      },
    });
  }

  /** Build the Factory work-item routes as Mastra `apiRoutes`. */
  routes(): ApiRoute[] {
    const { audit, workItems, queueHealth, transitionService, startCoordinator, liveSessions } = this.deps;
    return [
      // ── List the org's work items for a project, and which are being worked ─
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemList.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemList.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({
            workItems: items.map(toWireWorkItem),
            runningSessionIds: runningSessionIds(items, liveSessions),
          });
        },
      }),

      // ── Flow metrics aggregated over the project's work items ───────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.metricsGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.metricsGet.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const query = FACTORY_ROUTE_CONTRACTS.metricsGet.querySchema.safeParse({
            from: context.req.query('from'),
            to: context.req.query('to'),
          });
          if (!query.success) return c.json({ error: 'invalid_metrics_range' }, 400);
          const { windowStart, windowEnd } = parseMetricsRange(query.data.from, query.data.to, new Date());
          await workItems.ensureReady();
          const items = await workItems.list({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({ metrics: computeFactoryMetrics(items, { windowStart, windowEnd }) });
        },
      }),

      // ── Per-project queue-health age-threshold config (seconds) ─────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.healthThresholdsGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.healthThresholdsGet.method,
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
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.decisionList.path, {
        method: FACTORY_ROUTE_CONTRACTS.decisionList.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;

          const query = FACTORY_ROUTE_CONTRACTS.decisionList.querySchema.safeParse({
            statuses: context.req.query('statuses'),
            before: context.req.query('before'),
            limit: context.req.query('limit'),
          });
          if (!query.success) return c.json({ error: 'invalid_decision_query' }, 400);
          const before = parseDecisionCursor(query.data.before);
          if (query.data.before && !before) return c.json({ error: 'invalid_cursor' }, 400);
          await workItems.ensureReady();
          const page = await workItems.listDeferredDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: parseDecisionStatuses(query.data.statuses),
            before,
            limit: parseDecisionLimit(query.data.limit),
          });
          const last = page.decisions.at(-1);
          return c.json({
            decisions: page.decisions.map(decisionSummary),
            ...(page.hasMore && last ? { nextCursor: encodeDecisionCursor(last) } : {}),
          });
        },
      }),

      ...buildAttentionRoutes({
        workItems,
        comments: this.deps.comments,
        resolveProject: context => this.#resolveProject(loose(context)),
      }),

      ...buildSupervisorRoutes({
        workItems,
        resolveProject: context => this.#resolveProject(loose(context)),
      }),

      this.#proposalRoute({ verb: 'approve', settle: workItems.approveDeferredDecision.bind(workItems) }),
      this.#proposalRoute({ verb: 'dismiss', settle: workItems.dismissDeferredDecision.bind(workItems) }),

      registerApiRoute(FACTORY_ROUTE_CONTRACTS.decisionRetry.path, {
        method: FACTORY_ROUTE_CONTRACTS.decisionRetry.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.decisionRetry.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            decisionId: context.req.param('decisionId'),
          });
          if (!parsedPath.success) return c.json({ error: 'invalid_decision_id' }, 422);
          const { decisionId } = parsedPath.data;
          await workItems.ensureReady();
          const current = await workItems.getDeferredDecision(resolved.orgId, resolved.factoryProjectId, decisionId);
          if (
            !current ||
            current.status !== 'failed' ||
            !factoryDispatchFailureMetadata(current.failureCode).canRetry
          ) {
            return c.json({ error: 'decision_not_retryable' }, 409);
          }
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
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemCreate.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemCreate.method,
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
            return c.json({ workItem: toWireWorkItem(item) });
          } catch (error) {
            if (error instanceof WorkItemRelationError) {
              return c.json({ error: error.code, message: error.message }, 400);
            }
            throw error;
          }
        },
      }),

      // ── Authoritative stage transition ──────────────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemTransition.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemTransition.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const context = loose(c);
          const parsedPath = FACTORY_ROUTE_CONTRACTS.workItemTransition.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            workItemId: context.req.param('workItemId'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          const { workItemId } = parsedPath.data;
          const parsed = parseTransitionBody(await readJson(context));
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
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemStart.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemStart.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          if (!startCoordinator) {
            return c.json({ error: 'factory_start_unavailable' }, 503);
          }
          const input = parseStartBody(await readJson(loose(c)), resolved, resolved.factoryProjectId);
          if (!input) return c.json({ error: 'invalid_factory_start' }, 400);
          input.requestContext = loose(c).get('requestContext');
          input.defaultModelId = resolved.defaultModelId ?? undefined;
          // This route is only reached by a person pressing a run action, so
          // reaching it is the commitment the approval gate is asking for.
          // Arming rides inside prepareRunStart's transaction so a crash can't
          // start the run while leaving its follow-up work waiting on approval.
          input.armAutonomy = true;
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
                sessionId: prepared.sessionId,
                bindingId: prepared.bindingId,
              },
            },
          });
          return c.json({ prepared }, 202);
        },
      }),

      // ── Patch non-stage metadata / sessions / title ──────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemUpdate.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemUpdate.method,
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          const context = loose(c);
          const parsedPath = FACTORY_ROUTE_CONTRACTS.workItemUpdate.pathSchema.safeParse({
            id: context.req.param('id'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          const { id } = parsedPath.data;

          const body = await readJson(context);
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
            return c.json({ workItem: toWireWorkItem(updated.item) });
          } catch (error) {
            if (error instanceof WorkItemRelationError) {
              return c.json({ error: error.code, message: error.message }, 400);
            }
            throw error;
          }
        },
      }),

      // ── Remove a work item ───────────────────────────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemDelete.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemDelete.method,
        requiresAuth: false,
        handler: async c => {
          const tenant = await this.#resolveTenant(loose(c));
          if ('response' in tenant) return tenant.response;

          const context = loose(c);
          const parsedPath = FACTORY_ROUTE_CONTRACTS.workItemDelete.pathSchema.safeParse({
            id: context.req.param('id'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          const { id } = parsedPath.data;

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
