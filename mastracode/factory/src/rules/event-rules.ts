import type { BoardEventFacts, PullRequestEvent } from '../boards/board-events.js';
import { closeReason, eventMovesCard, isPullRequestEvent } from '../boards/board-events.js';
import { isPullRequestCard } from '../boards/semantics.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
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
 */
export const isStatusEventDecision = (decision: Record<string, unknown>): boolean => {
  if (decision.type !== 'routeEvent' && decision.type !== 'transition') return false;
  const event = decision.event as BoardEventFacts | undefined;
  return event !== undefined && !isPullRequestEvent(event.type);
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
  if (!context.item || !event || event.type === 'work_item.created') return undefined;
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
