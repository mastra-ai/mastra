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

import type { FactoryBoardEngine } from '../board-engine/engine.js';
import {
  boardPhaseOutcomes,
  DEFAULT_BOARD_ID,
  isPullRequestCard,
  isOpenPullRequestSource,
  pullRequestSourceNumber,
  pullRequestSources,
} from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { IntakeRoutesReader } from '../boards/intake-routing.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type {
  FactoryStartCoordinator,
  FactoryStartPreparedResult,
  FactoryStartRequest,
} from '../rules/start-coordinator.js';
import { FactoryStartTransitionError, WorkItemRepositoryError } from '../rules/start-coordinator.js';
import { workItemSource } from '../rules/types.js';
import type { LiveSessions } from '../session/live-sessions.js';
import type { RunRepositoryResolution } from '../session/work-item-repository.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { IntakeEvaluator } from '../storage/domains/boards/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { EffectiveModelScope, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { QueueHealthStorage } from '../storage/domains/queue-health/base.js';
import { thresholdsOrDefault } from '../storage/domains/queue-health/base.js';
import type { UpdateWorkItemInput, Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { WorkItemRelationError, WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import { computeFactoryMetrics, parseMetricsRange } from '../storage/domains/work-items/metrics.js';
import { relatedCardsIn } from '../work-items/list-related-cards.js';
import { buildAttentionRoutes } from './attention.js';
import { BoardCatalogRoutes } from './board-catalog.js';
import { BoardLiveStateRoutes } from './board-live-state.js';
import {
  boardSnapshot,
  hashedBody,
  listCheck,
  matchesEtag,
  movedBody,
  scopedSnapshot,
  sendJson,
  sendRevalidated,
} from './board-snapshot.js';
import { BoardWorkItemRoutes } from './board-work-items.js';
export { parseCreateWorkItem } from './board-work-items.js';
import { toVersionedWireWorkItem, toWireWorkItem } from './card-wire.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import { decisionSummary } from './decision-wire.js';
import type { ProjectSessionsReader } from './project-sessions.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';
import { buildSessionRowRoutes } from './session-rows.js';
import { workItemActivity } from './work-item-activity.js';
import { cardsFiledFrom, cardsWithIds, unstartedCards } from './work-item-selection.js';
import {
  CARD_DECISION_PAGE_SIZE,
  CARD_DECISION_STATUSES,
  cardsWithFailedRun,
  workItemStarters,
} from './work-item-starters.js';

export interface WorkItemRoutesDeps extends RouteDependencies {
  audit: AuditEmitter;
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Work-items domain backing the kanban board. */
  workItems: WorkItemsStorage;
  /** Boards installed for this Factory instance. */
  /** A fixed registry, or the per-project boards. Defaults to the built-in boards. */
  boardRegistry?: BoardRegistry | ProjectBoardSource;
  /** The project's intake routes, which place a card filed without a board. */
  intakeRoutes?: IntakeRoutesReader;
  /** Which evaluator places a filed card; the old `route-list` by default. */
  intakeEvaluator?: IntakeEvaluator;
  /** Per-project queue-health threshold config. */
  queueHealth: QueueHealthStorage;
  /** The board engine every stage move goes through. Stage moves 503 when absent. */
  boardEngine?: Pick<FactoryBoardEngine, 'requestMove'>;
  /** Coordinator that binds a Factory run before dispatching its kickoff. */
  startCoordinator?: Pick<FactoryStartCoordinator, 'prepare'>;
  sessionRepository?: (input: {
    orgId: string;
    factoryProjectId: string;
    item: Card;
  }) => Promise<RunRepositoryResolution>;
  /** Materialized sessions, read to report which sessions wait on someone and which session a run's thread is on. */
  liveSessions: Pick<LiveSessions, 'parked' | 'parkedIn' | 'sessionOnThread'>;
  /** This process's dispatcher run slots; absent or `undefined` while it runs no dispatcher. */
  runSlots?: () => { inUse: number; cap: number; interactive: { inUse: number; cap: number } } | undefined;
  projectSessions?: ProjectSessionsReader;
  activeRuns?: () => readonly { threadId: string; resourceId?: string }[];
}

// One list per board version, so every tab's sidebar shares its serialization.
const cardsInSessions = new WeakMap<readonly Card[], Card[]>();

/** The cards `holds` picks, and the cards related to them, in board order. */
function withRelatedCards(board: readonly Card[], holds: (card: Card) => boolean): Card[] {
  const relatedTo = relatedCardsIn(board);
  const picked = new Set<Card>();
  for (const card of board) {
    if (!holds(card)) continue;
    picked.add(card);
    for (const related of relatedTo(card)) picked.add(related);
  }
  return board.filter(card => picked.has(card));
}

/** The cards that hold one of the sessions, and the cards related to them, in board order. */
function sessionCards(board: readonly Card[], sessionIds: readonly string[]): Card[] {
  const wanted = new Set(sessionIds);
  return withRelatedCards(board, card => Object.values(card.sessions).some(session => wanted.has(session.sessionId)));
}

/** The cards that hold any session, and the cards related to them, in board order. */
function allSessionCards(board: readonly Card[]): Card[] {
  let cards = cardsInSessions.get(board);
  if (!cards) {
    cards = withRelatedCards(board, card => Object.keys(card.sessions).length > 0);
    cardsInSessions.set(board, cards);
  }
  return cards;
}

/** The error a list query is refused with, named after the parameter that failed to parse. */
function listQueryError(field: PropertyKey | undefined): string {
  switch (field) {
    case 'scope':
      return 'invalid_scope';
    case 'started':
      return 'invalid_started';
    case 'q':
      return 'invalid_search';
    case 'source':
      return 'invalid_source';
    case 'workItemId':
      return 'invalid_work_item_id';
    default:
      return 'invalid_session_id';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** Validate an untrusted patch body. Unknown keys are dropped. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  const parsed = FACTORY_ROUTE_CONTRACTS.workItemUpdate.bodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Fields a PATCH touched, for the bounded `updated` event summary. */
function patchedFields(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(key => patch[key] !== undefined);
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

/** Where a catalog board came from, whether it can be edited, and what is wrong with it. */

/** The pull request a person picked closed before the pick was written. */
class PullRequestClosedError extends Error {}

export class WorkItemRoutes extends Route<WorkItemRoutesDeps> {
  #source: ProjectBoardSource | undefined;

  get #boards(): ProjectBoardSource {
    return (this.#source ??= toBoardSource(this.deps.boardRegistry));
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
    item: Card;
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

  /** Build the Factory work-item routes as Mastra `apiRoutes`. */
  routes(): ApiRoute[] {
    const { audit, workItems, queueHealth, boardEngine, startCoordinator, liveSessions, projectSessions, activeRuns } =
      this.deps;
    return [
      ...new BoardCatalogRoutes({ auth: this.deps.auth, projects: this.deps.projects, boards: this.#boards }).routes(),
      ...new BoardWorkItemRoutes({
        auth: this.deps.auth,
        audit,
        projects: this.deps.projects,
        workItems,
        boards: this.#boards,
        boardEngine,
        intakeRoutes: this.deps.intakeRoutes,
        intakeEvaluator: this.deps.intakeEvaluator,
      }).routes(),
      ...new BoardLiveStateRoutes({
        auth: this.deps.auth,
        projects: this.deps.projects,
        workItems,
        audit,
        boards: this.#boards,
        runSlots: this.deps.runSlots,
      }).routes(),
      // ── List the org's work items for a project ─────────────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemList.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemList.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const query = FACTORY_ROUTE_CONTRACTS.workItemList.querySchema.safeParse({
            sessionId: context.req.queries('sessionId'),
            scope: context.req.query('scope'),
            started: context.req.query('started'),
            q: context.req.query('q'),
            limit: context.req.query('limit'),
            source: context.req.queries('source'),
            workItemId: context.req.queries('workItemId'),
            since: context.req.query('since'),
          });
          // A filter that fails to parse must not widen to the whole board.
          if (!query.success) return c.json({ error: listQueryError(query.error.issues[0]?.path[0]) }, 400);
          await workItems.ensureReady();
          const { sessionId: sessionIds, scope, started, q, limit, source, workItemId: ids, since } = query.data;
          const list = await workItems.listSharedSince({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            since,
          });
          const board = list.items;
          const unstarted = started ? unstartedCards(board, q ?? '', limit) : undefined;
          const part =
            unstarted?.cards ??
            (scope
              ? allSessionCards(board)
              : sessionIds
                ? sessionCards(board, sessionIds)
                : source
                  ? cardsFiledFrom(board, source)
                  : ids && cardsWithIds(board, ids));
          // A tab that kept the board gets what moved since its cursor: a body the size of the change.
          if (list.changed) {
            const workItems = list.changed.map(toWireWorkItem);
            const moved = { workItems, removedIds: list.removed, check: listCheck(board), cursor: list.cursor };
            return sendJson(context, movedBody(moved), { 'Cache-Control': 'no-store' });
          }
          const snapshot = part
            ? // A reader asks for cards by id to hold the bodies a phases answer names by version.
              scopedSnapshot(part, ids ? toVersionedWireWorkItem : toWireWorkItem, unstarted?.total)
            : boardSnapshot(board, toWireWorkItem, list.cursor);
          // Every open tab refetches its list on each feed frame; most frames leave it unchanged.
          return sendRevalidated(context, snapshot);
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
          const items = await workItems.listShared({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          const boards = await this.#boards.load({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
          });
          return c.json({
            metrics: computeFactoryMetrics(items, { windowStart, windowEnd }, boardPhaseOutcomes(boards)),
          });
        },
      }),

      // ── What the draft page's starter buttons count on the default board ────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemStarters.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemStarters.method,
        requiresAuth: false,
        handler: async c => {
          const resolved = await this.#resolveProject(loose(c));
          if ('response' in resolved) return resolved.response;
          const project = { orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId };
          await workItems.ensureReady();
          const [cards, boards, { decisions }] = await Promise.all([
            workItems.listShared(project),
            this.#boards.load(project),
            workItems.listDeferredDecisionPage({
              ...project,
              statuses: [...CARD_DECISION_STATUSES],
              limit: CARD_DECISION_PAGE_SIZE,
            }),
          ]);
          return c.json(
            workItemStarters({
              board: boards.get(DEFAULT_BOARD_ID),
              cards,
              failedCardIds: cardsWithFailedRun(decisions),
              now: Date.now(),
            }),
          );
        },
      }),

      // ── When cards were created and completed, for the draft page's band ────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemActivity.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemActivity.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const query = FACTORY_ROUTE_CONTRACTS.workItemActivity.querySchema.safeParse({
            since: context.req.query('since'),
          });
          if (!query.success) return c.json({ error: 'invalid_activity_since' }, 400);
          const project = { orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId };
          await workItems.ensureReady();
          const [cards, boards] = await Promise.all([workItems.listShared(project), this.#boards.load(project)]);
          const answer = hashedBody(workItemActivity(cards, boards, query.data.since));
          // A draft tab asks again on each feed frame; most frames change no card of the period.
          const headers = { ETag: answer.etag, 'Cache-Control': 'private, no-cache' };
          if (matchesEtag(c.req.header('if-none-match'), answer.etag)) return c.body(null, 304, headers);
          return c.body(answer.json, 200, { ...headers, 'Content-Type': 'application/json; charset=UTF-8' });
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

      ...buildAttentionRoutes({
        workItems,
        boards: this.#boards,
        liveSessions,
        resolveProject: context => this.#resolveProject(loose(context)),
      }),

      ...(projectSessions && activeRuns
        ? buildSessionRowRoutes({
            workItems,
            boards: this.#boards,
            liveSessions,
            resolveProject: context => this.#resolveProject(loose(context)),
            sessionCards: async scope => allSessionCards(await workItems.listShared(scope)),
            projectSessions,
            activeRuns,
            authEnabled: () => this.deps.auth.enabled(),
          })
        : []),

      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemSessionRepository.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemSessionRepository.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.workItemSessionRepository.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            workItemId: context.req.param('workItemId'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          await workItems.ensureReady();
          const item = await workItems.get({ orgId: resolved.orgId, id: parsedPath.data.workItemId });
          if (!item || item.factoryProjectId !== resolved.factoryProjectId) {
            return c.json({ error: 'Work item not found' }, 404);
          }
          const { sessionRepository } = this.deps;
          if (!sessionRepository) return c.json({ error: 'factory_session_repository_unavailable' }, 503);
          const resolution = await sessionRepository({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            item,
          });
          return c.json(
            resolution.status === 'resolved'
              ? {
                  status: resolution.status,
                  projectRepositoryId: resolution.projectRepositoryId,
                  slug: resolution.slug,
                }
              : { status: resolution.status, hint: resolution.hint },
          );
        },
      }),

      // ── Pick the pull request a card's sessions work on ──────────────────────
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.workItemWorkingPullRequest.path, {
        method: FACTORY_ROUTE_CONTRACTS.workItemWorkingPullRequest.method,
        requiresAuth: false,
        handler: async c => {
          const context = loose(c);
          const resolved = await this.#resolveProject(context);
          if ('response' in resolved) return resolved.response;
          const contract = FACTORY_ROUTE_CONTRACTS.workItemWorkingPullRequest;
          const parsedPath = contract.pathSchema.safeParse({
            id: resolved.factoryProjectId,
            workItemId: context.req.param('workItemId'),
          });
          if (!parsedPath.success) return c.json({ error: 'Work item not found' }, 404);
          const body = contract.bodySchema.safeParse(await readJson(context));
          if (!body.success) return c.json({ error: 'invalid_working_pull_request' }, 400);
          await workItems.ensureReady();
          const existing = await workItems.get({ orgId: resolved.orgId, id: parsedPath.data.workItemId });
          if (!existing || existing.factoryProjectId !== resolved.factoryProjectId) {
            return c.json({ error: 'Work item not found' }, 404);
          }
          const source = pullRequestSources(existing).find(
            candidate => pullRequestSourceNumber(candidate) === body.data.pullRequest,
          );
          if (!source || isPullRequestCard({ source: workItemSource(existing.externalSource) })) {
            return c.json(
              { error: 'pull_request_not_linked', message: 'That pull request is not linked to this card.' },
              422,
            );
          }
          const closed = () => c.json({ error: 'pull_request_not_open', message: 'That pull request is closed.' }, 422);
          if (!isOpenPullRequestSource(source)) return closed();
          // The recorded head belongs to the pull request being replaced; the next push records this one's.
          const patch = {
            metadata: {
              openPullRequestNumber: body.data.pullRequest,
              pullRequestHeadSha: null,
              pullRequestHeadAt: null,
              pullRequestHeadDeliveryId: null,
            },
          };
          try {
            const updated = await workItems.update({
              orgId: resolved.orgId,
              id: existing.id,
              userId: resolved.userId,
              patch,
              expectedRevision: body.data.expectedRevision,
              // It may have closed since the read above without moving the card's revision.
              check: current => {
                const now = pullRequestSources(current).find(
                  candidate => pullRequestSourceNumber(candidate) === body.data.pullRequest,
                );
                if (!now || !isOpenPullRequestSource(now)) throw new PullRequestClosedError();
              },
            });
            if (!updated) return c.json({ error: 'Work item not found' }, 404);
            await this.#auditWorkItemPatch({ context, item: updated.item, patch });
            return c.json({ workItem: toWireWorkItem(updated.item) });
          } catch (error) {
            if (error instanceof PullRequestClosedError) return closed();
            if (error instanceof WorkItemUpdateConflictError) return c.json({ error: 'stale' }, 409);
            throw error;
          }
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
              return c.json({ error: error.code, message: error.message }, 409);
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
            const boards = await this.#boards.load({
              orgId: tenant.orgId,
              factoryProjectId: existing.factoryProjectId,
            });
            const board = boards.get(patch.board);
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

/** A board's loop parts, by phase key, as the catalog reports them. */
