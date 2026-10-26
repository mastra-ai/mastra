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

import { FACTORY_AGENTS } from '../boards/agents.js';
import { unknownRunnerIssues } from '../boards/config.js';
import { createBoardRegistry } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { BoardResolver } from '../boards/resolver.js';
import { builtInRunners } from '../boards/runners.js';
import type { BoardRunnerRegistry } from '../boards/runners.js';
import { EXTERNAL_SOURCE_MISSING_KEY } from '../integrations/issue-reconciler.js';
import { decisionRetryable, overtakenDecisionIds } from '../rules/decision-applicability.js';
import type {
  FactoryStartCoordinator,
  FactoryStartPreparedResult,
  FactoryStartRequest,
} from '../rules/start-coordinator.js';
import { FactoryStartTransitionError, WorkItemRepositoryError } from '../rules/start-coordinator.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { WorkItemSource } from '../rules/types.js';
import type { LiveSessions } from '../session/live-sessions.js';
import { auditRequestOrigin } from '../storage/domains/audit/domain.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { BoardRevisionConflictError } from '../storage/domains/boards/base.js';
import type { BoardsStorage } from '../storage/domains/boards/base.js';
import { projectBoardConfigInputSchema } from '../storage/domains/boards/validation.js';
import type { ProjectBoardConfigInput } from '../storage/domains/boards/validation.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { EffectiveModelScope, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base.js';
import type {
  CreateWorkItemInput,
  FactoryDeferredDecisionRecord,
  UpdateWorkItemInput,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  FACTORY_RULE_MATERIALIZATION_KEY,
  WorkItemRelationError,
  WorkItemUpdateConflictError,
} from '../storage/domains/work-items/base.js';
import { computeFactoryMetrics, parseMetricsRange } from '../storage/domains/work-items/metrics.js';
import { createFactoryWorkItem } from '../work-items/create-work-item.js';
import { resolveFactoryProposal, retryFactoryDecision } from '../work-items/decision-actions.js';
import { buildAttentionRoutes, factoryDecisionType } from './attention.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface WorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Work-items domain backing the kanban board. */
  workItems: WorkItemsStorage;
  /** Boards installed for this Factory instance. */
  boardRegistry?: BoardRegistry;
  /** Each project's boards (stored + code); catalog, create and board moves use it when set. */
  boardResolver?: BoardResolver;
  /** Stored board definitions; the board settings routes read and write them when set. */
  boardDefinitions?: BoardsStorage;
  /** Boards offered (unsaved, revision 0) to a project that stores none yet. */
  boardDefaults?: ProjectBoardConfigInput;
  boardRunners?: BoardRunnerRegistry;
  /** Comments domain — backs the mention attention provider. */
  comments: WorkItemCommentsStorage;
  /** Per-project queue-health threshold config. */
  queueHealth: QueueHealthStorage;
  /** Governed stage-transition service. Stage moves 503 when absent. */
  transitionService?: Pick<FactoryTransitionService, 'transition' | 'configVersion'>;
  /** Coordinator that binds a Factory run before dispatching its kickoff. */
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
  /** Materialized sessions, read to report which of the listed cards are being worked or wait on someone. */
  liveSessions: Pick<LiveSessions, 'isRunning' | 'parked' | 'parkedIn'>;
}

/** The card as clients see it, without the dispatcher's internal bookkeeping. */
function toWireWorkItem(item: WorkItemRow): WorkItemRow {
  if (
    !item.metadata ||
    (!(FACTORY_RULE_MATERIALIZATION_KEY in item.metadata) &&
      !(FACTORY_PULL_REQUEST_RECONCILIATION_KEY in item.metadata) &&
      !(EXTERNAL_SOURCE_MISSING_KEY in item.metadata))
  ) {
    return item;
  }
  return { ...item, metadata: publicWorkItemMetadata(item.metadata) ?? {} };
}

/** Session ids of the listed cards that the predicate picks, each once. */
function sessionIdsWhere(items: WorkItemRow[], predicate: (sessionId: string) => boolean): string[] {
  const picked = new Set<string>();
  for (const item of items) {
    for (const { sessionId } of Object.values(item.sessions)) {
      if (predicate(sessionId)) picked.add(sessionId);
    }
  }
  return [...picked];
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
    [EXTERNAL_SOURCE_MISSING_KEY]: _externalSourceMissingAt,
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
  modelScope: EffectiveModelScope,
): FactoryStartRequest | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemStart.bodySchema.safeParse(body);
  return parsed.success ? { ...tenant, factoryProjectId, modelScope, ...parsed.data } : null;
}

function encodeDecisionCursor(decision: FactoryDeferredDecisionRecord): string {
  return Buffer.from(JSON.stringify([decision.createdAt.toISOString(), decision.id]), 'utf8').toString('base64url');
}

/** A proposed transition names the seat its lane addresses, so the card can label what approving starts. */
function summaryRole(boards: BoardRegistry, decision: Record<string, unknown>): string | null {
  if (typeof decision.role === 'string') return decision.role.slice(0, 32);
  if (decision.type !== 'transition') return null;
  const { board, stage } = decision;
  if (typeof board !== 'string' || typeof stage !== 'string') return null;
  return boards.get(board)?.roleForPhase(stage) ?? null;
}

/** A linked-card decision names where the card is synced from, so the UI can say "GitHub" rather than "a linked card". */
function summarySource(decision: Record<string, unknown>): WorkItemSource | null {
  if (decision.type !== 'upsertLinkedWorkItem') return null;
  const source = decision.source;
  return source === 'github-issue' ||
    source === 'github-pr' ||
    source === 'gitlab-issue' ||
    source === 'gitlab-pr' ||
    source === 'linear-issue' ||
    source === 'manual'
    ? source
    : null;
}

function decisionSummary(boards: BoardRegistry, decision: FactoryDeferredDecisionRecord, overtaken = false) {
  return {
    id: decision.id,
    evaluationId: decision.evaluationId,
    workItemId: decision.workItemId,
    type: factoryDecisionType(decision),
    role: summaryRole(boards, decision.decision),
    source: summarySource(decision.decision),
    status: decision.status,
    attempts: decision.attempts,
    failureOccurrence: decision.failureOccurrence,
    failureCode: decision.failureCode,
    canRetry: decisionRetryable(decision, overtaken),
    lastError: decision.lastError?.slice(0, 512) ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
    completedAt: decision.completedAt?.toISOString() ?? null,
  };
}

export class WorkItemRoutes extends Route<WorkItemRoutesDeps> {
  #defaultBoards: BoardRegistry | undefined;

  get #boards(): BoardRegistry {
    return this.deps.boardRegistry ?? (this.#defaultBoards ??= createBoardRegistry());
  }

  async #projectBoards(scope: { orgId: string; factoryProjectId: string }): Promise<BoardRegistry> {
    return this.deps.boardResolver ? this.deps.boardResolver.forProject(scope) : this.#boards;
  }

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
  async #resolveProject(c: Context): Promise<
    | {
        orgId: string;
        userId: string;
        factoryProjectId: string;
        modelScope: EffectiveModelScope;
        defaultModelId: string | null;
      }
    | { response: Response }
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
    // Work-item starts are runs, so a hybrid Factory resolves the Factory's scope here.
    const modelScope = effectiveModelScope(project.modelScope, 'run');
    return {
      ...tenant,
      factoryProjectId: projectId,
      modelScope,
      defaultModelId: modelScope === 'factory' ? project.defaultModelId : null,
    };
  }

  async #auditWorkItemPatch({
    context,
    item,
    patch,
  }: {
    context: Context;
    item: WorkItemRow;
    patch: Record<string, unknown>;
  }): Promise<void> {
    await this.deps.audit.emit({
      context,
      input: {
        action: 'factory.work_item.updated',
        factoryProjectId: item.factoryProjectId,
        targets: [{ type: 'work_item', id: item.id, name: item.title }],
        metadata: { fields: patchedFields(patch) },
      },
    });
  }

  /** Releasing a parked run and dropping it: same request, opposite outcomes, both audited as consent. */
  #proposalRoute({ verb }: { verb: 'approve' | 'dismiss' }): ApiRoute {
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
        const settled = await resolveFactoryProposal({
          workItems,
          audit: input => audit.emit({ context, input }),
          orgId: resolved.orgId,
          factoryProjectId: resolved.factoryProjectId,
          userId: resolved.userId,
          decisionId,
          action: verb,
        });
        if (!settled.ok) return c.json({ error: settled.code }, 409);
        const { decision } = settled;
        return c.json({ decision: decisionSummary(this.#boards, decision) });
      },
    });
  }

  /** Build the Factory work-item routes as Mastra `apiRoutes`. */
  routes(): ApiRoute[] {
    const { audit, workItems, queueHealth, transitionService, startCoordinator, liveSessions } = this.deps;
    return [
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.boardCatalog.path, {
        method: FACTORY_ROUTE_CONTRACTS.boardCatalog.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          return c.json({
            boards: [...(await this.#projectBoards(resolved))].map(([id, board]) => ({
              id,
              title: board.title,
              initialPhase: board.initialPhase,
              phases: Object.entries(board.phases).map(([phaseId, phase]) => ({
                id: phaseId,
                title: phase.title,
                kind: phase.kind,
                ...(phase.kind === 'working' ? { role: phase.role } : {}),
                transitions: (board.transitions[phaseId] ?? []).map(({ outcome, to }) => ({ outcome, to })),
              })),
            })),
          });
        },
      }),
      // ── Stored boards and intake routes: the board settings screen ─────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.boardConfigGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.boardConfigGet.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const storage = this.deps.boardDefinitions;
          if (!storage) return c.json({ error: 'boards_unavailable' }, 503);
          const config = await storage.getConfig(resolved);
          const runners = [...(this.deps.boardRunners ?? builtInRunners).values()].map(runner => ({
            id: runner.id,
            role: runner.role ?? null,
          }));
          if (config.revision === 0 && this.deps.boardDefaults) {
            // Nothing stored yet: offer the default boards; saving at revision 0 stores them.
            const defaults = projectBoardConfigInputSchema.parse(this.deps.boardDefaults);
            return c.json({
              config: {
                revision: 0,
                boards: defaults.boards.map(board => ({ id: '', ...board })),
                intakeRoutes: defaults.intakeRoutes,
                updatedBy: null,
                updatedAt: null,
              },
              runners,
              agents: FACTORY_AGENTS,
            });
          }
          return c.json({
            config: { ...config, updatedAt: config.updatedAt?.toISOString() ?? null },
            runners,
            agents: FACTORY_AGENTS,
          });
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.boardConfigUpdate.path, {
        method: FACTORY_ROUTE_CONTRACTS.boardConfigUpdate.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const storage = this.deps.boardDefinitions;
          if (!storage) return c.json({ error: 'boards_unavailable' }, 503);
          const parsed = FACTORY_ROUTE_CONTRACTS.boardConfigUpdate.bodySchema.safeParse(await readJson(context));
          if (!parsed.success) {
            return c.json(
              {
                error: parsed.error.issues
                  .slice(0, 3)
                  .map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
                  .join(' '),
                issues: parsed.error.issues.map(issue => ({ message: issue.message, path: issue.path.map(String) })),
              },
              422,
            );
          }
          const unknownRunners = unknownRunnerIssues(parsed.data.config, this.deps.boardRunners ?? builtInRunners);
          if (unknownRunners.length) {
            return c.json(
              { error: unknownRunners.join(' '), issues: unknownRunners.map(message => ({ message, path: [] })) },
              422,
            );
          }
          // Issues and pull requests are filed on Work, so a project that has it keeps it (key included).
          const current = await storage.getConfig(resolved);
          const currentBoards =
            current.revision === 0
              ? (this.deps.boardDefaults?.boards ?? []).map(board => board.key)
              : current.boards.map(board => board.key);
          if (currentBoards.includes('work') && !parsed.data.config.boards.some(board => board.key === 'work')) {
            const message =
              "The Work board can't be removed or re-keyed; Factory files issues and pull requests on it.";
            return c.json({ error: message, issues: [{ message, path: ['boards'] }] }, 422);
          }
          try {
            const config = await storage.saveConfig({
              orgId: resolved.orgId,
              factoryProjectId: resolved.factoryProjectId,
              userId: resolved.userId,
              expectedRevision: parsed.data.expectedRevision,
              config: parsed.data.config,
            });
            this.deps.boardResolver?.invalidate(resolved);
            return c.json({ config: { ...config, updatedAt: config.updatedAt?.toISOString() ?? null } });
          } catch (error) {
            if (error instanceof BoardRevisionConflictError) {
              return c.json({ error: error.message }, 409);
            }
            throw error;
          }
        },
      }),
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
            runningSessionIds: sessionIdsWhere(items, sessionId => liveSessions.isRunning(sessionId)),
            parkedSessionIds: sessionIdsWhere(items, sessionId => liveSessions.parked(sessionId) !== undefined),
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
          if (!query.success) {
            const field = query.error.issues[0]?.path[0];
            return c.json({ error: field === 'before' ? 'invalid_cursor' : 'invalid_decision_query' }, 400);
          }
          await workItems.ensureReady();
          const page = await workItems.listDeferredDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: query.data.statuses,
            before: query.data.before,
            limit: query.data.limit,
          });
          const last = page.decisions.at(-1);
          const overtaken = await overtakenDecisionIds(
            workItems,
            this.#boards,
            resolved,
            page.decisions.filter(decision => decision.status === 'failed'),
          );
          return c.json({
            decisions: page.decisions.map(decision =>
              decisionSummary(this.#boards, decision, overtaken.has(decision.id)),
            ),
            ...(page.hasMore && last ? { nextCursor: encodeDecisionCursor(last) } : {}),
          });
        },
      }),

      ...buildAttentionRoutes({
        workItems,
        boards: this.#boards,
        comments: this.deps.comments,
        liveSessions,
        resolveProject: context => this.#resolveProject(loose(context)),
      }),

      this.#proposalRoute({ verb: 'approve' }),
      this.#proposalRoute({ verb: 'dismiss' }),

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
          const retried = await retryFactoryDecision({
            workItems,
            boards: this.#boards,
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            decisionId,
          });
          if (!retried.ok) return c.json({ error: retried.code }, 409);
          const { decision } = retried;
          return c.json({ decision: decisionSummary(this.#boards, decision) });
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
          try {
            const created = await createFactoryWorkItem({
              workItems,
              boards: await this.#projectBoards(resolved),
              transitionService,
              audit: auditInput => audit.emit({ context: loose(c), input: auditInput }),
              orgId: resolved.orgId,
              userId: resolved.userId,
              factoryProjectId: resolved.factoryProjectId,
              input,
              origin: auditRequestOrigin(loose(c)),
            });
            switch (created.status) {
              case 'refused':
                if (created.code === 'factory_transitions_unavailable') return c.json({ error: created.code }, 503);
                return c.json(
                  { error: created.code, message: created.message },
                  created.code === 'invalid_board' ? 422 : 409,
                );
              case 'rejected':
                return c.json({ status: 'rejected', code: created.code, reason: created.reason }, 422);
              case 'reused': {
                // Source-key reuse: the POST updated an existing card, not created one.
                const { stages: _stages, sessions: _sessions, ...boundedPatch } = input;
                await this.#auditWorkItemPatch({
                  context: loose(c),
                  item: created.item,
                  patch: boundedPatch as unknown as Record<string, unknown>,
                });
                return c.json({ workItem: toWireWorkItem(created.item) });
              }
              case 'created':
                return c.json({ workItem: toWireWorkItem(created.item) });
            }
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
            ...auditRequestOrigin(loose(c)),
            ingress: {
              ...parsed.ingress,
              identity: `human:${resolved.userId}:${parsed.ingress.identity}`,
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
          const input = parseStartBody(
            await readJson(loose(c)),
            resolved,
            resolved.factoryProjectId,
            resolved.modelScope,
          );
          if (!input) return c.json({ error: 'invalid_factory_start' }, 400);
          input.requestContext = loose(c).get('requestContext');
          input.defaultModelId = resolved.defaultModelId ?? undefined;
          await workItems.ensureReady();
          let prepared: FactoryStartPreparedResult;
          try {
            prepared = await startCoordinator.prepare(input);
          } catch (error) {
            if (error instanceof FactoryStartTransitionError) {
              return c.json({ result: error.result }, error.result.code === 'stale' ? 409 : 422);
            }
            if (error instanceof WorkItemRepositoryError) {
              return c.json({ error: error.code, message: error.message, candidates: error.candidates }, 409);
            }
            throw error;
          }
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

          await workItems.ensureReady();
          const existing = await workItems.get({ orgId: tenant.orgId, id });
          if (!existing) return c.json({ error: 'Work item not found' }, 404);
          if (patch.board !== undefined) {
            const board = (await this.#projectBoards(existing)).get(patch.board);
            const stage = patch.stages?.length === 1 ? patch.stages[0] : undefined;
            if (existing.board !== null) {
              return c.json({ error: 'board_already_assigned' }, 409);
            }
            if (!board) {
              return c.json({ error: 'board_not_installed' }, 400);
            }
            if (!stage || !Object.prototype.hasOwnProperty.call(board.phases, stage)) {
              return c.json({ error: 'invalid_board_migration_phase' }, 400);
            }
          } else if (patch.stages !== undefined) {
            return c.json(
              { error: 'governed_transition_required', message: 'Use the Factory transition endpoint to move stages.' },
              409,
            );
          }

          try {
            const updated = await workItems.update({
              orgId: tenant.orgId,
              id,
              userId: tenant.userId,
              patch,
              ...(patch.board !== undefined ? { expectedRevision: existing.revision, expectedBoard: null } : {}),
            });
            if (!updated) return c.json({ error: 'Work item not found' }, 404);
            await this.#auditWorkItemPatch({
              context: loose(c),
              item: updated.item,
              patch: patch as Record<string, unknown>,
            });
            return c.json({ workItem: toWireWorkItem(updated.item) });
          } catch (error) {
            if (error instanceof WorkItemRelationError) {
              return c.json({ error: error.code, message: error.message }, 400);
            }
            if (error instanceof WorkItemUpdateConflictError) {
              return c.json({ error: error.reason === 'board' ? 'board_already_assigned' : error.code }, 409);
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
