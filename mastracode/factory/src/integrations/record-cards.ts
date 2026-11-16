import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * A provider record's cards, keyed by external id: one per board it is on, first filed first.
 * Cards filed without a record are left out.
 */
export function cardsByExternalId(items: readonly Card[]): Map<string, Card[]> {
  const byId = new Map<string, Card[]>();
  for (const item of items) {
    const key = item.externalSource?.externalId;
    // Cards without a record share no record with each other.
    if (key === undefined) continue;
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

/** The ingress identity a record's card evaluates an event under; see `cardIngressIdentity`. */
export function cardIngressId(
  storage: Pick<WorkItemsStorage, 'cardIngressIdentity'>,
  base: string,
  item: Card | undefined,
): Promise<string> {
  return item
    ? storage.cardIngressIdentity({ orgId: item.orgId, factoryProjectId: item.factoryProjectId, base, cardId: item.id })
    : Promise.resolve(base);
}
