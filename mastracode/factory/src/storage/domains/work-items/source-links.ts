import { randomUUID } from 'node:crypto';

import type { FactoryStorageOps } from '@mastra/core/storage';

import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from './work-item-schema.js';
import type {
  BoardItemDbRecord,
  WorkItemSourceDbRecord,
  WorkItemSourceFacts,
  WorkItemSourceLinkDbRecord,
  WorkItemSourceRole,
} from './work-item-schema.js';

const LINKS = FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const BATCH = 500;

export interface SourceLink {
  workItemId: string;
  role: WorkItemSourceRole;
}

async function findIn<T extends Record<string, unknown>>(
  ops: FactoryStorageOps,
  collection: string,
  column: string,
  values: readonly string[],
): Promise<T[]> {
  const unique = [...new Set(values)];
  const rows: T[] = [];
  for (let index = 0; index < unique.length; index += BATCH) {
    rows.push(
      ...(await ops.findMany<T>(
        collection,
        { [column]: { in: unique.slice(index, index + BATCH) } },
        {
          orderBy: [
            ['created_at', 'asc'],
            ['id', 'asc'],
          ],
        },
      )),
    );
  }
  return rows;
}

/** A source row written before `role` existed is its work item's only source, so it is the origin. */
function ownerRole(source: WorkItemSourceDbRecord): WorkItemSourceRole {
  return source.role === 'attached' ? 'attached' : 'origin';
}

export function factsOf(source: WorkItemSourceDbRecord): WorkItemSourceFacts {
  return { state: source.state, labels: source.labels, author: source.author, metadata: source.metadata };
}

/** The source's facts as a link stores them, stamped with the source's own sync time. */
function linkFacts(source: WorkItemSourceDbRecord, now: Date) {
  return { ...factsOf(source), facts_synced_at: source.synced_at ?? now };
}

/**
 * Whether a link's facts are current. A release before links carried facts syncs only the source
 * row, moving its `synced_at` past the link's, so the source row is read until the next sync.
 */
function linkIsCurrent(link: WorkItemSourceLinkDbRecord, source: WorkItemSourceDbRecord): boolean {
  if (!link.facts_synced_at) return false;
  return !source.synced_at || new Date(link.facts_synced_at).getTime() >= new Date(source.synced_at).getTime();
}

/** Record that `workItemId` reads `source`, with its current facts. A no-op when it already does. */
export async function linkSource(
  ops: FactoryStorageOps,
  source: WorkItemSourceDbRecord,
  workItemId: string,
  role: WorkItemSourceRole,
  now = new Date(),
): Promise<boolean> {
  if (await ops.findOne(LINKS, { work_item_id: workItemId, source_id: source.id })) return false;
  // Insert if absent: a concurrent writer may add the same link between the read and the write,
  // and a failed insert would abort the whole transaction on Postgres. Facts the loser writes are
  // as old as its read of the source, which reads skip in favour of the source row.
  const id = randomUUID();
  const written = await ops.upsertOne<WorkItemSourceLinkDbRecord>(LINKS, ['work_item_id', 'source_id'], {
    id,
    org_id: source.org_id,
    factory_project_id: source.factory_project_id,
    work_item_id: workItemId,
    source_id: source.id,
    role,
    ...linkFacts(source, now),
    created_at: now,
  });
  return written.id === id;
}

/**
 * Every work item each source belongs to: its owner (`work_item_id`, which rows written before
 * links existed only have) first, then its other links oldest first.
 */
export async function linkedItems(
  ops: FactoryStorageOps,
  sources: readonly WorkItemSourceDbRecord[],
): Promise<Map<string, SourceLink[]>> {
  const links = await findIn<WorkItemSourceLinkDbRecord>(
    ops,
    LINKS,
    'source_id',
    sources.map(source => source.id),
  );
  const linked = new Map<string, SourceLink[]>();
  for (const source of sources) {
    const own = links.find(link => link.source_id === source.id && link.work_item_id === source.work_item_id);
    linked.set(source.id, [{ workItemId: source.work_item_id, role: own?.role ?? ownerRole(source) }]);
  }
  for (const link of links) {
    const group = linked.get(link.source_id);
    if (!group || group.some(item => item.workItemId === link.work_item_id)) continue;
    group.push({ workItemId: link.work_item_id, role: link.role });
  }
  return linked;
}

/** The work items reading any source whose `source_key` is in `keys`, owners first. */
export async function itemsForSourceKeys(
  ops: FactoryStorageOps,
  scope: { org_id?: unknown; factory_project_id?: unknown },
  keys: unknown,
): Promise<string[]> {
  const where: Record<string, unknown> = { source_key: keys };
  if (scope.org_id !== undefined) where.org_id = scope.org_id;
  if (scope.factory_project_id !== undefined) where.factory_project_id = scope.factory_project_id;
  const sources = await ops.findMany<WorkItemSourceDbRecord>(SOURCES, where as never);
  if (!sources.length) return [];
  const linked = await linkedItems(ops, sources);
  const owners = sources.map(source => source.work_item_id);
  const others = [...linked.values()].flat().map(link => link.workItemId);
  return [...new Set([...owners, ...others])];
}

/**
 * The sources each work item reads, as that item sees them: `work_item_id` is the item, `role`
 * its own link's role, and the facts its link's (the source row's until the link has them).
 * Ordered by when each source was filed.
 */
export async function sourcesForItems(
  ops: FactoryStorageOps,
  workItemIds: readonly string[],
): Promise<Map<string, WorkItemSourceDbRecord[]>> {
  const owned = await findIn<WorkItemSourceDbRecord>(ops, SOURCES, 'work_item_id', workItemIds);
  const links = await findIn<WorkItemSourceLinkDbRecord>(ops, LINKS, 'work_item_id', workItemIds);
  const byId = new Map(owned.map(source => [source.id, source]));
  const missing = links.map(link => link.source_id).filter(id => !byId.has(id));
  for (const source of await findIn<WorkItemSourceDbRecord>(ops, SOURCES, 'id', missing)) byId.set(source.id, source);
  const result = new Map<string, WorkItemSourceDbRecord[]>();
  const add = (workItemId: string, source: WorkItemSourceDbRecord, link: WorkItemSourceLinkDbRecord | undefined) => {
    const group = result.get(workItemId) ?? [];
    if (group.some(existing => existing.id === source.id)) return;
    const facts =
      link && linkIsCurrent(link, source)
        ? { state: link.state, labels: link.labels ?? [], author: link.author, metadata: link.metadata }
        : {};
    group.push({ ...source, ...facts, work_item_id: workItemId, role: link?.role ?? ownerRole(source) });
    result.set(workItemId, group);
  };
  const linkOf = new Map(links.map(link => [`${link.work_item_id}\0${link.source_id}`, link]));
  for (const source of owned) add(source.work_item_id, source, linkOf.get(`${source.work_item_id}\0${source.id}`));
  for (const link of links) {
    const source = byId.get(link.source_id);
    if (source) add(link.work_item_id, source, link);
  }
  for (const group of result.values()) {
    group.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id),
    );
  }
  return result;
}

/** Every work item sharing a source with any of these, including them. */
export async function sourceGroup(ops: FactoryStorageOps, workItemIds: readonly string[]): Promise<string[]> {
  const owned = await findIn<WorkItemSourceDbRecord>(ops, SOURCES, 'work_item_id', workItemIds);
  const own = await findIn<WorkItemSourceLinkDbRecord>(ops, LINKS, 'work_item_id', workItemIds);
  const ownedIds = new Set(owned.map(source => source.id));
  const linkedOnly = own.map(link => link.source_id).filter(id => !ownedIds.has(id));
  const sourceIds = [...ownedIds, ...linkedOnly];
  if (!sourceIds.length) return [...workItemIds];
  const owners = (await findIn<WorkItemSourceDbRecord>(ops, SOURCES, 'id', linkedOnly)).map(
    source => source.work_item_id,
  );
  const links = await findIn<WorkItemSourceLinkDbRecord>(ops, LINKS, 'source_id', sourceIds);
  return [...new Set([...workItemIds, ...owners, ...links.map(link => link.work_item_id)])];
}

/**
 * Lock the cards of every work item in `workItemIds`' source group in id order: the order every
 * write that fans facts out to sibling work items takes them in, so two such writes never deadlock.
 * Returns the group. A lone work item takes no extra lock.
 */
export async function lockSourceGroup(ops: FactoryStorageOps, workItemIds: readonly string[]): Promise<string[]> {
  const group = await sourceGroup(ops, workItemIds);
  if (group.length <= 1) return group;
  const boards = await findIn<BoardItemDbRecord>(ops, BOARD_ITEMS, 'work_item_id', group);
  for (const id of boards.map(board => board.id).sort()) await ops.updateAtomic(BOARD_ITEMS, { id }, () => null);
  return group;
}

/**
 * Write one source's current facts to every link it has, in one statement, and stamp the linked
 * cards, so siblings never disagree. The caller holds the group's card locks ({@link lockSourceGroup})
 * and then the source row: the order every fact write takes them in. Returns the work item ids.
 */
export async function fanOutSourceFacts(
  ops: FactoryStorageOps,
  source: WorkItemSourceDbRecord,
  { now = new Date(), stamp = true }: { now?: Date; stamp?: boolean } = {},
): Promise<string[]> {
  const holders = (await linkedItems(ops, [source])).get(source.id)!;
  // An owner filed before links existed gets its link here, with the facts.
  for (const holder of holders) await linkSource(ops, source, holder.workItemId, holder.role, now);
  await ops.updateMany(LINKS, { source_id: source.id }, linkFacts(source, now));
  const items = holders.map(holder => holder.workItemId).sort();
  if (stamp) await ops.updateMany(BOARD_ITEMS, { work_item_id: { in: items } }, { changed_at: now });
  return items;
}

/**
 * Drop one work item's link to a source. The source row goes with its last link; otherwise a
 * removed owner hands it to the oldest remaining linked work item.
 */
export async function unlinkSource(
  ops: FactoryStorageOps,
  source: WorkItemSourceDbRecord,
  workItemId: string,
): Promise<void> {
  const remaining = (await linkedItems(ops, [source])).get(source.id)!.filter(link => link.workItemId !== workItemId);
  await ops.deleteMany(LINKS, { source_id: source.id, work_item_id: workItemId });
  if (!remaining.length) {
    await ops.deleteMany(LINKS, { source_id: source.id });
    await ops.deleteMany(SOURCES, { id: source.id });
    return;
  }
  if (source.work_item_id !== workItemId) return;
  const [next] = remaining;
  await ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id: source.id }, () => ({
    work_item_id: next!.workItemId,
    role: next!.role,
    updated_at: new Date(),
  }));
}

export interface SourceLinkBackfillReport {
  links: number;
  aborted: boolean;
}

/**
 * Give every source written before links existed a link for its owner, carrying the source's
 * facts. Idempotent and resumable: a source that already has its owner's link is skipped. Each
 * source is locked and read again first, so its owner is current (a card deleted since the page
 * was read is not linked back) and two passes never both insert one link: every link insert holds
 * its source's row lock. Reads fall back to the source row for any link it has not reached yet.
 */
export async function backfillSourceLinks(
  storage: { ops: FactoryStorageOps; withTransaction<T>(fn: (ops: FactoryStorageOps) => Promise<T>): Promise<T> },
  { signal, pageSize = BATCH }: { signal?: AbortSignal; pageSize?: number } = {},
): Promise<SourceLinkBackfillReport> {
  const report: SourceLinkBackfillReport = { links: 0, aborted: false };
  const orderBy: Array<[string, 'asc']> = [['id', 'asc']];
  let cursor: string | undefined;
  pages: while (!signal?.aborted) {
    const page = await storage.ops.findMany<WorkItemSourceDbRecord>(
      SOURCES,
      {},
      { orderBy, limit: pageSize, ...(cursor ? { cursor: { values: [cursor] } } : {}) },
    );
    if (!page.length) break;
    cursor = page[page.length - 1]!.id;
    for (const { id } of page) {
      if (signal?.aborted) break pages;
      const linked = await storage.withTransaction(async ops => {
        const source = await ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id }, () => null);
        return source ? linkSource(ops, source, source.work_item_id, ownerRole(source), source.created_at) : false;
      });
      if (linked) report.links++;
    }
  }
  report.aborted = signal?.aborted ?? false;
  return report;
}
