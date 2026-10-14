import type { FactoryRuleHandler } from './types.js';

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

/** Whether the deployment set this event explicitly on the integration's `rules`. */
export function hasExplicitRuleOverride(rules: object, event: string): boolean {
  return explicitOverrides.get(rules)?.has(event) ?? false;
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}
