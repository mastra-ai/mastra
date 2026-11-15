import type { QueryClient } from '@tanstack/react-query';
import { replaceEqualDeep } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { listWorkItems } from '../ui/domains/factory/services/workItems';
import type { BoardSnapshot, WorkItem } from '../ui/domains/factory/services/workItems';

/** The most ids one `workItemId` read may name. */
const CARDS_PER_READ = 100;

/** The cards among `ids` the server still holds, read by id. */
async function readCards(baseUrl: string, factoryProjectId: string, ids: string[], signal: AbortSignal) {
  const reads: Promise<BoardSnapshot>[] = [];
  for (let start = 0; start < ids.length; start += CARDS_PER_READ) {
    const workItemId = ids.slice(start, start + CARDS_PER_READ);
    reads.push(listWorkItems(baseUrl, factoryProjectId, signal, { workItemId }));
  }
  return (await Promise.all(reads)).flatMap(read => read.workItems);
}

/**
 * The card the tab holds for each id of `versions`, from whichever read cached it. Where several
 * reads hold a card, the one whose body is the version named wins.
 */
function heldCards(client: QueryClient, factoryProjectId: string, versions: ReadonlyMap<string, string>) {
  const held = new Map<string, WorkItem>();
  const snapshots = client.getQueriesData<BoardSnapshot>({ queryKey: queryKeys.workItems(factoryProjectId) });
  for (const [, snapshot] of snapshots) {
    for (const card of snapshot?.workItems ?? []) {
      const version = versions.get(card.id);
      if (version === undefined) continue;
      const holder = held.get(card.id);
      if (!holder || (card.version === version && holder.version !== version)) held.set(card.id, card);
    }
  }
  return held;
}

/**
 * The body of each card an answer names in `versions`, in its order: the one `sent` with the
 * answer, else the one the tab holds at the version named, else the one downloaded by id. A card
 * the read leaves equal stays the object held, so nothing showing it renders again.
 */
export async function readNamedCards(
  client: QueryClient,
  baseUrl: string,
  factoryProjectId: string,
  versions: ReadonlyMap<string, string>,
  sent: readonly WorkItem[],
  signal: AbortSignal,
): Promise<Map<string, WorkItem>> {
  const read = new Map(sent.map(card => [card.id, card]));
  const heldAtAnswer = heldCards(client, factoryProjectId, versions);
  const stale = [...versions].flatMap(([id, version]) =>
    read.has(id) || heldAtAnswer.get(id)?.version === version ? [] : [id],
  );
  if (stale.length > 0) {
    for (const card of await readCards(baseUrl, factoryProjectId, stale, signal)) {
      if (versions.has(card.id)) read.set(card.id, card);
    }
  }
  // Read again: the cards held carry the changes made here while the server answered.
  const held = heldCards(client, factoryProjectId, versions);
  const cards = new Map<string, WorkItem>();
  // A card the server holds no body of was deleted since it was named: nothing lists it, and the
  // older body the tab holds is not it.
  const deleted = new Set(stale.filter(id => !read.has(id)));
  for (const id of versions.keys()) {
    if (deleted.has(id)) continue;
    const body = read.get(id);
    const card = body ? replaceEqualDeep(held.get(id), body) : held.get(id);
    if (card) cards.set(id, card);
  }
  return cards;
}

/**
 * What a read caches: `listing` with the `workItems` it lists. It is `previous` itself where the
 * read changed nothing, and otherwise keeps every part of `previous` the read left equal.
 */
export function snapshotKeepingHeld<Listing extends object>(
  previous: (NoInfer<Listing> & Pick<BoardSnapshot, 'workItems'>) | undefined,
  listing: Listing,
  workItems: WorkItem[],
): Listing & Pick<BoardSnapshot, 'workItems'> {
  if (!previous) return { ...listing, workItems };
  const { workItems: previousCards, ...previousListing } = previous;
  const sameCards =
    workItems.length === previousCards.length && workItems.every((card, i) => card === previousCards[i]);
  const sharedListing = replaceEqualDeep(previousListing, listing);
  if (sameCards && sharedListing === previousListing) return previous;
  return { ...sharedListing, workItems: sameCards ? previousCards : workItems };
}
