import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * One integration's records' cards, keyed by external id: one per board a record is on, first
 * filed first. Cards filed without a record, or from another integration or source type, are left
 * out: they are not the record's cards even when they carry the same external id.
 */
export function cardsByExternalId(
  items: readonly Card[],
  { integrationId, type }: { integrationId: string; type: string },
): Map<string, Card[]> {
  const byId = new Map<string, Card[]>();
  for (const item of items) {
    const source = item.externalSource;
    if (source?.integrationId !== integrationId || source.type !== type) continue;
    const key = source.externalId;
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
