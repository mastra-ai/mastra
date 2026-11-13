import type { Card } from '../storage/domains/work-items/base.js';

/**
 * A provider record's cards, keyed by external id: one per board it is on, first filed first.
 * The first keeps the delivery's own ingress identity; the others take one suffixed with their id.
 */
export function cardsByExternalId(items: readonly Card[]): Map<string | undefined, Card[]> {
  const byId = new Map<string | undefined, Card[]>();
  for (const item of items) {
    const key = item.externalSource?.externalId;
    const cards = byId.get(key);
    if (cards) cards.push(item);
    else byId.set(key, [item]);
  }
  for (const cards of byId.values()) {
    cards.sort(
      (a, b) => a.workItem.createdAt.getTime() - b.workItem.createdAt.getTime() || a.id.localeCompare(b.id),
    );
  }
  return byId;
}

/** The ingress identity a record's card evaluates under: suffixed for every card but the first. */
export function cardIngressId(base: string, item: Card | undefined, sibling: boolean): string {
  return sibling && item ? `${base}:${item.id}` : base;
}
