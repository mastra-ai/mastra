import type { StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import { arrivalKinds } from './board-events.js';

type OrderRoute = Pick<StoredIntakeRouteRecord, 'enabled' | 'when' | 'on' | 'pullRequestOpenedMovesOnly'> & {
  target: Pick<StoredIntakeRouteRecord['target'], 'boardKey' | 'joinClosedIssue'>;
};

/** Whether the route can place a new card: enabled, handling arrivals, and not joining a closed issue's card. */
export function placesArrivals(route: OrderRoute): boolean {
  return route.enabled && arrivalKinds(route).size > 0 && !route.target.joinClosedIssue;
}

/**
 * The kinds of new card a placing route takes whatever they are: every kind it handles when it has
 * no condition, or the one kind its condition names when that is all it tests (`source.kind equals
 * pull_request` on a pull request route, so as a card move it leaves issues' cards alone).
 */
export function kindsTakenWhole(route: Pick<OrderRoute, 'when' | 'on' | 'pullRequestOpenedMovesOnly'>): string[] {
  const kinds = [...arrivalKinds(route)];
  if (route.when === null) return kinds;
  const { operator, conditions } = route.when;
  if (operator !== 'AND' || conditions.length !== 1) return [];
  const [only] = conditions;
  if (!only || !('field' in only) || only.field !== 'source.kind' || only.operator !== 'equals') return [];
  return kinds.filter(kind => kind === only.value);
}

/**
 * Whether the board's intake list takes every new card that reaches it: rules that test nothing
 * but the card's kind file both issues and pull requests, in one rule or two.
 */
export function endsInCatchAll(routes: readonly OrderRoute[], boardKey: string): boolean {
  const kinds = new Set(
    routes
      .filter(route => route.target.boardKey === boardKey && placesArrivals(route))
      .flatMap(route => kindsTakenWhole(route)),
  );
  return kinds.size === 2;
}

/**
 * The intake order an existing project starts with: boards by the position of their first enabled
 * placing route in the route list (`routes`, in list order), then boards with none, in sidebar
 * order (`boardKeys`). Contiguous route lists route exactly as before under it.
 */
export function deriveIntakeOrder(routes: readonly OrderRoute[], boardKeys: readonly string[]): string[] {
  const known = new Set(boardKeys);
  const order: string[] = [];
  for (const route of routes) {
    const key = route.target.boardKey;
    if (placesArrivals(route) && known.has(key) && !order.includes(key)) order.push(key);
  }
  return [...order, ...boardKeys.filter(key => !order.includes(key))];
}

/**
 * The stored order brought up to date with the project's boards: deleted boards leave it, and a
 * board missing from it (one created since) goes just above the first board whose list ends in an
 * enabled catch-all, so it is reachable; last when no board has one.
 */
export function reconcileIntakeOrder(
  stored: readonly string[],
  boardKeys: readonly string[],
  routes: readonly OrderRoute[],
): string[] {
  const known = new Set(boardKeys);
  const order = stored.filter((key, index) => known.has(key) && stored.indexOf(key) === index);
  for (const key of boardKeys) {
    if (order.includes(key)) continue;
    const catchAll = order.findIndex(other => endsInCatchAll(routes, other));
    if (catchAll >= 0) order.splice(catchAll, 0, key);
    else order.push(key);
  }
  return order;
}
