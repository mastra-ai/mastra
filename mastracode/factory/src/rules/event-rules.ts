import type { BoardEventFacts } from '../boards/board-events.js';
import { closeReason } from '../boards/board-events.js';
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
 * The decision that hands a delivery's status event to the project's intake routes, when no rule
 * decided anything for it. Only an existing card is moved; new cards are placed when filed.
 */
export function routeEventDecision(context: {
  item?: unknown;
  phase?: { kind: string };
  boardEvent?: BoardEventFacts;
  ingress: { id: string };
}): FactoryRouteEventDecision | undefined {
  if (!context.item || !context.boardEvent || context.boardEvent.type === 'work_item.created') return undefined;
  // A close moves only an unfinished card and a reopen only a finished one.
  const finished = context.phase?.kind === 'terminal';
  if (context.boardEvent.type === 'work_item.closed' ? finished : !finished) return undefined;
  return { type: 'routeEvent', idempotencyKey: `${context.ingress.id}:event-route`, event: context.boardEvent };
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
 * A decision the deployment's own handler returned stays its answer: a stock close move it
 * wrapped or reused loses the event tag that would hand it to the project's intake routes.
 */
export function withoutRouteEvent(entry: Record<string, unknown>): Record<string, unknown> {
  if (entry.type !== 'transition' || entry.event === undefined) return entry;
  const { event: _event, ...move } = entry;
  return move;
}
