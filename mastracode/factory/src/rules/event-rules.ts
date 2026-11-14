import type { BoardEventFacts, PullRequestEvent } from '../boards/board-events.js';
import {
  closeReason,
  eventMovesCard,
  isPullRequestEvent,
  isUpdateEvent,
  listChange,
  updateEventFacts,
} from '../boards/board-events.js';
import { isPullRequestCard } from '../boards/semantics.js';
import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryRouteEventDecision, FactoryRuleHandler, FactoryTransitionDecision } from './types.js';

type EventRuleTable<E extends string, TContext> = Readonly<Record<E, FactoryRuleHandler<TContext> | null>>;
type BoardEventRuleMap<E extends string, TContext> = Readonly<Partial<Record<E, FactoryRuleHandler<TContext> | null>>>;

const explicitOverrides = new WeakMap<object, ReadonlySet<string>>();

/**
 * Records which events a deployment set explicitly on an integration's `rules`. Those handlers keep
 * precedence over board event handlers, so integration-level wrappers behave exactly as before.
 */
export function recordExplicitRuleOverrides<T extends object>(
  rules: T,
  overrides: Readonly<Record<string, unknown>> | undefined,
): T {
  const keys = Object.entries(overrides ?? {})
    .filter(([, handler]) => handler !== undefined)
    .map(([event]) => event);
  explicitOverrides.set(rules, Object.freeze(new Set(keys)));
  return rules;
}

/**
 * Runs a board event handler ahead of the integration default. A board handler that returns no
 * decision leaves the default in force, so card-independent defaults (filing a new card,
 * dismissing stale reviews) keep running on every board; `null` switches the default off.
 */
export function composeEventRule<TContext>(
  boardRule: FactoryRuleHandler<TContext> | null | undefined,
  base: FactoryRuleHandler<TContext> | null,
): FactoryRuleHandler<TContext> | null {
  if (boardRule === null) return null;
  if (!boardRule) return base;
  if (!base) return boardRule;
  return context => {
    const decision = boardRule(context);
    if (isPromiseLike(decision)) return Promise.resolve(decision).then(resolved => resolved ?? base(context));
    return decision ?? base(context);
  };
}

/**
 * Handler that answers one integration event: a handler the deployment set explicitly on the
 * integration, else the card's board handler composed over the integration default.
 */
export function selectEventRule<E extends string, TContext>(
  rules: EventRuleTable<E, TContext>,
  boardRules: BoardEventRuleMap<E, TContext> | undefined,
  event: E,
): FactoryRuleHandler<TContext> | null {
  const base = rules[event];
  if (hasExplicitRuleOverride(rules, event)) return base;
  return composeEventRule(boardRules?.[event], base);
}

/**
 * Whether the deployment answers the event itself: with a handler or `null` set explicitly on the
 * integration's `rules`, or with `null` on the card's board handlers. Intake routes then stay out
 * of it, so an override that moves nothing really moves nothing.
 */
export function deploymentOwnsEvent<E extends string, TContext>(
  rules: EventRuleTable<E, TContext>,
  boardRules: BoardEventRuleMap<E, TContext> | undefined,
  event: E,
): boolean {
  return hasExplicitRuleOverride(rules, event) || boardRules?.[event] === null;
}

/** Whether the deployment set this event explicitly on the integration's `rules`. */
export function hasExplicitRuleOverride(rules: object, event: string): boolean {
  return explicitOverrides.get(rules)?.has(event) ?? false;
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}

/**
 * A decision that carries a work item's status event (a close, a reopen) for the card's routes.
 * Those overtake one another, so the source's last word wins. Pull request events don't: a merge,
 * a close or a push each concerns its own pull request, and the default rules already decided it.
 * Neither do updates: a label change never cancels a close or a reopen, nor is cancelled by one.
 */
export const isStatusEventDecision = (decision: Record<string, unknown>): boolean => {
  if (decision.type !== 'routeEvent' && decision.type !== 'transition') return false;
  const event = decision.event as BoardEventFacts | undefined;
  return event !== undefined && !isPullRequestEvent(event.type) && !isUpdateEvent(event.type);
};

const QUEUED_STATUSES = ['pending', 'retry', 'leased'] as const;

/**
 * The decision that hands a delivery's status event to the project's intake routes, when no rule
 * decided anything for it. Only an existing card is moved; new cards are placed when filed.
 */
export async function routeEventDecision(
  context: {
    item?: { id: string };
    phase?: { kind: string };
    boardEvent?: BoardEventFacts;
    ingress: { id: string };
  },
  storage: Pick<WorkItemsStorage, 'listDeferredDecisions'>,
  scope: { orgId: string; factoryProjectId: string },
): Promise<FactoryRouteEventDecision | undefined> {
  const event = context.boardEvent;
  if (!context.item || !event || event.type === 'work_item.opened') return undefined;
  const decision = routeEvent(context.ingress.id, event);
  // A close moves only an unfinished card and a reopen only a finished one, unless an earlier
  // status event is still queued for the card: this one overtakes it, so the last one wins.
  if (eventMovesCard(event.type, context.phase?.kind === 'terminal')) return decision;
  const queued = await storage.listDeferredDecisions(scope.orgId, scope.factoryProjectId, {
    workItemId: context.item.id,
    statuses: QUEUED_STATUSES,
  });
  return queued.some(record => isStatusEventDecision(record.decision)) ? decision : undefined;
}

function routeEvent(ingressId: string, event: BoardEventFacts): FactoryRouteEventDecision {
  return { type: 'routeEvent', idempotencyKey: `${ingressId}:event-route`, event };
}

/**
 * The decision handing a label or assignee change to the card's routes. A change the card's own
 * session made (`fromCardSession`) is held until its run ends.
 */
export function cardUpdateDecision(
  ingressId: string,
  event: BoardEventFacts,
  fromCardSession: boolean,
): FactoryRouteEventDecision {
  return { ...routeEvent(ingressId, event), ...(fromCardSession ? { fromCardSession: true as const } : {}) };
}

/**
 * Commits a label or assignee change on a card as an update event for the card's routes. Nothing
 * is committed when nothing changed. `fromCardSession` marks a change Factory made itself, which
 * the dispatcher holds until the card's run ends. The change has already been written to the card,
 * so a stale revision only means another write landed; re-read and commit against it.
 */
export async function commitCardUpdate(
  storage: Pick<WorkItemsStorage, 'commitRuleEvaluation' | 'get'>,
  input: {
    orgId: string;
    factoryProjectId: string;
    item: { id: string; revision: number };
    ingress: { identity: string; triggerType: string };
    configVersion: string;
    actor: Record<string, unknown>;
    event: BoardEventFacts | undefined;
    fromCardSession: boolean;
    now?: Date;
  },
): Promise<'committed' | 'replayed' | 'ignored'> {
  if (!input.event) return 'ignored';
  const decision = cardUpdateDecision(input.ingress.identity, input.event, input.fromCardSession);
  let revision = input.item.revision;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const committed = await storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: input.item.id,
      ingress: input.ingress,
      configVersion: input.configVersion,
      expectedRevision: revision,
      actor: input.actor,
      outcome: { status: 'accepted' },
      decisions: [{ ...decision }],
      causalChain: [],
      now: input.now ?? new Date(),
    });
    if (committed.status === 'committed' || committed.status === 'replayed') return committed.status;
    if (committed.status === 'missing') return 'ignored';
    const current = await storage.get({ orgId: input.orgId, id: input.item.id });
    if (!current) return 'ignored';
    revision = current.revision;
  }
  return 'ignored';
}

/** The labels and assignees a polled provider last reported for a card's item. */
const OBSERVED_ITEM_METADATA_KEY = 'observedItem';

function observedItem(
  item: Pick<Card, 'metadata' | 'workItem'>,
): { labels: string[]; assignees: string[] } | undefined {
  const value = item.metadata?.[OBSERVED_ITEM_METADATA_KEY] ?? item.workItem.metadata?.[OBSERVED_ITEM_METADATA_KEY];
  if (!value || typeof value !== 'object') return undefined;
  const list = (entry: unknown) =>
    Array.isArray(entry) ? entry.filter((name): name is string => typeof name === 'string') : [];
  const record = value as Record<string, unknown>;
  return { labels: list(record.labels), assignees: list(record.assignees) };
}

/**
 * For a provider that only reports "the item changed" (Linear, Jira, incident.io are polled):
 * diffs the item's labels and assignee against the ones the last sighting recorded, records the
 * new ones, and hands the change to the card's routes as a `work_item.updated` event. The first
 * sighting only records them, so cards filed before this existed don't all fire at once. Polling
 * cannot tell who made the change, so it is never held for the card's run.
 */
export async function commitObservedChange(
  storage: Pick<WorkItemsStorage, 'commitRuleEvaluation' | 'get' | 'syncCard'>,
  input: {
    orgId: string;
    factoryProjectId: string;
    item: Pick<Card, 'id' | 'metadata' | 'workItem'>;
    ingressId: string;
    triggerType: string;
    configVersion: string;
    actor: Record<string, unknown>;
    labels: readonly string[];
    assignee: string | null;
    /** Provider-specific metadata to record next to the labels and assignees. */
    metadata?: Record<string, unknown>;
  },
): Promise<'committed' | 'replayed' | 'ignored'> {
  const assignees = input.assignee ? [input.assignee] : [];
  const seen = observedItem(input.item);
  const event = seen
    ? updateEventFacts('work_item.updated', {
        labels: listChange(seen.labels, input.labels),
        assignees: listChange(seen.assignees, assignees),
      })
    : undefined;
  if (seen && !event) return 'ignored';
  let synced;
  try {
    synced = await storage.syncCard({
      orgId: input.orgId,
      id: input.item.id,
      userId: 'factory-rule-dispatcher',
      patch: {
        metadata: {
          ...input.metadata,
          labels: [...input.labels],
          assignees,
          assignee: input.assignee,
          [OBSERVED_ITEM_METADATA_KEY]: { labels: [...input.labels], assignees },
        },
      },
    });
  } catch (error) {
    // A concurrent write won; the next sighting diffs against what it left.
    if (!(error instanceof WorkItemUpdateConflictError)) throw error;
    return 'ignored';
  }
  if (!synced || !event) return 'ignored';
  return commitCardUpdate(storage, {
    orgId: input.orgId,
    factoryProjectId: input.factoryProjectId,
    item: synced.item,
    ingress: { identity: `${input.ingressId}:update`, triggerType: input.triggerType },
    configVersion: input.configVersion,
    actor: input.actor,
    event,
    fromCardSession: false,
  });
}

/**
 * Tells whether a delivery's item was turned away by intake (Not routed): it has no card, but an
 * update to it should run intake again. Storage that keeps Not routed records provides it.
 */
export interface NotRoutedLookup {
  isNotRouted(scope: { orgId: string; factoryProjectId: string }, sourceKey: string): Promise<boolean>;
}

/** A pull or merge request's own card on a board with no pull request loop: Factory doesn't review it there. */
export function unreviewedPullRequestCard(context: {
  item?: { readonly source: string };
  flow?: { pullRequestReview?: string };
}): boolean {
  return context.item !== undefined && isPullRequestCard(context.item) && context.flow?.pullRequestReview === undefined;
}

/**
 * A merge or close on a board with no pull request loop moves the card only where a route on its
 * board says; there is no move of Factory's own to fall back on.
 */
export function routedOnly(
  context: { phase?: { kind: string }; ingress: { id: string } },
  event: 'pull_request.merged' | 'pull_request.closed',
): FactoryRouteEventDecision | undefined {
  if (context.phase?.kind === 'terminal') return undefined;
  return routeEvent(context.ingress.id, { type: event });
}

/**
 * A default close handler's answer: the board's `sourceClosed` move, which the project's intake
 * routes replace when a route on the card's board handles closes.
 */
export function closedByRoutes<T extends Omit<FactoryTransitionDecision, 'type' | 'event'>>(
  canceled: boolean,
  move: T,
): FactoryTransitionDecision {
  return { type: 'transition', ...move, event: { type: 'work_item.closed', reason: closeReason(canceled) } };
}

/**
 * A default pull request handler's answer: the move it decided on, which a route on the card's
 * board naming the event sends elsewhere. A route to the same phase keeps the move as it is
 * (its message, its re-entry).
 */
export function pullRequestMoveByRoutes<T extends Omit<FactoryTransitionDecision, 'type' | 'event'>>(
  event: PullRequestEvent,
  move: T,
): FactoryTransitionDecision {
  return { type: 'transition', ...move, event: { type: event } };
}

/**
 * A decision the deployment's own handler returned stays its answer: a stock close move it
 * wrapped or reused loses the event tag that would hand it to the project's intake routes.
 */
export function withoutRouteEvent(entry: Record<string, unknown>): Record<string, unknown> {
  if (entry.type !== 'transition' || entry.event === undefined) return entry;
  const { event: _event, ...move } = entry;
  return move;
}
