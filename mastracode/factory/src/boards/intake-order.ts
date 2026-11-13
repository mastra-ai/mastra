import type { StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';

type OrderRoute = Pick<StoredIntakeRouteRecord, 'enabled' | 'when' | 'on' | 'target'>;

/** Whether the route can place a new card: enabled, handling arrivals, and not joining a closed issue's card. */
export function placesArrivals(route: OrderRoute): boolean {
  return route.enabled && route.on.includes('work_item.created') && !route.target.joinClosedIssue;
}

/** Whether the board's intake list takes every new card that reaches it. */
export function endsInCatchAll(routes: readonly OrderRoute[], boardKey: string): boolean {
  return routes.some(route => route.target.boardKey === boardKey && placesArrivals(route) && route.when === null);
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
