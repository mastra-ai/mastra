import { randomUUID } from 'node:crypto';

import type { FactoryStorageOps } from '@mastra/core/storage';

import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
} from './work-item-schema.js';
import type {
  BoardItemDbRecord,
  WorkItemDbRecord,
  WorkItemSourceDbRecord,
  WorkItemSourceFacts,
  WorkItemSourceLinkDbRecord,
  WorkItemSourceRole,
} from './work-item-schema.js';

const LINKS = FACTORY_WORK_ITEM_SOURCE_LINKS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
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

/** Record that `workItemId` reads `source`. A no-op when it already does. */
export async function linkSource(
  ops: FactoryStorageOps,
  source: Pick<WorkItemSourceDbRecord, 'id' | 'org_id' | 'factory_project_id'>,
  workItemId: string,
  role: WorkItemSourceRole,
  now = new Date(),
): Promise<boolean> {
  if (await ops.findOne(LINKS, { work_item_id: workItemId, source_id: source.id })) return false;
  await ops.insertOne<WorkItemSourceLinkDbRecord>(LINKS, {
    id: randomUUID(),
    org_id: source.org_id,
    factory_project_id: source.factory_project_id,
    work_item_id: workItemId,
    source_id: source.id,
    role,
    created_at: now,
  });
  return true;
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
 * The sources each work item reads, as that item sees them: `work_item_id` is the item and
 * `role` its own link's role. Ordered by when each source was filed.
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
  const add = (workItemId: string, source: WorkItemSourceDbRecord, role: WorkItemSourceRole) => {
    const group = result.get(workItemId) ?? [];
    if (group.some(existing => existing.id === source.id)) return;
    group.push({ ...source, work_item_id: workItemId, role });
    result.set(workItemId, group);
  };
  const linkRole = new Map(links.map(link => [`${link.work_item_id}\0${link.source_id}`, link.role]));
  for (const source of owned)
    add(source.work_item_id, source, linkRole.get(`${source.work_item_id}\0${source.id}`) ?? ownerRole(source));
  for (const link of links) {
    const source = byId.get(link.source_id);
    if (source) add(link.work_item_id, source, link.role);
  }
  for (const group of result.values()) {
    group.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id),
    );
  }
  return result;
}

/** A source as one work item reads it: the facts stored on the item, or the source's own until backfilled. */
export function withItemFacts(source: WorkItemSourceDbRecord, work: WorkItemDbRecord | null): WorkItemSourceDbRecord {
  const facts = work?.source_facts?.[source.id];
  return facts ? { ...source, ...facts } : source;
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
 * Store one source's current facts on every work item linked to it and stamp their cards, so
 * siblings never disagree. The caller holds the group's card locks ({@link lockSourceGroup}).
 * Returns the work item ids written.
 */
export async function fanOutSourceFacts(
  ops: FactoryStorageOps,
  source: WorkItemSourceDbRecord,
  { now = new Date(), stamp = true }: { now?: Date; stamp?: boolean } = {},
): Promise<string[]> {
  const items = (await linkedItems(ops, [source]))
    .get(source.id)!
    .map(link => link.workItemId)
    .sort();
  const facts = factsOf(source);
  for (const id of items) {
    await ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id }, work => ({
      source_facts: { ...work.source_facts, [source.id]: facts },
      facts_synced_at: now,
    }));
  }
  if (stamp && items.length) await ops.updateMany(BOARD_ITEMS, { work_item_id: { in: items } }, { changed_at: now });
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
  facts: number;
  aborted: boolean;
}

/**
 * Give every source written before links existed a link for its owner, and every work item the
 * facts of the sources it reads. Idempotent and resumable: each row is checked on its own, and a
 * work item's facts are filled under its row lock only for sources it lacks, so a sync that got
 * there first is never overwritten.
 */
export async function backfillSourceLinks(
  storage: { ops: FactoryStorageOps; withTransaction<T>(fn: (ops: FactoryStorageOps) => Promise<T>): Promise<T> },
  { signal, pageSize = BATCH }: { signal?: AbortSignal; pageSize?: number } = {},
): Promise<SourceLinkBackfillReport> {
  const report: SourceLinkBackfillReport = { links: 0, facts: 0, aborted: false };
  const orderBy: Array<[string, 'asc']> = [['id', 'asc']];
  let cursor: string | undefined;
  while (!signal?.aborted) {
    const page = await storage.ops.findMany<WorkItemSourceDbRecord>(
      SOURCES,
      {},
      { orderBy, limit: pageSize, ...(cursor ? { cursor: { values: [cursor] } } : {}) },
    );
    if (!page.length) break;
    cursor = page[page.length - 1]!.id;
    for (const source of page) {
      if (await linkSource(storage.ops, source, source.work_item_id, ownerRole(source), source.created_at)) {
        report.links++;
      }
    }
  }
  cursor = undefined;
  while (!signal?.aborted) {
    const page: WorkItemDbRecord[] = await storage.ops.findMany<WorkItemDbRecord>(
      WORK_ITEMS,
      {},
      { orderBy, limit: pageSize, ...(cursor ? { cursor: { values: [cursor] } } : {}) },
    );
    if (!page.length) break;
    cursor = page[page.length - 1]!.id;
    const read = await sourcesForItems(
      storage.ops,
      page.map(work => work.id),
    );
    for (const work of page) {
      const sources = read.get(work.id) ?? [];
      if (!sources.some(source => !work.source_facts?.[source.id])) continue;
      let filled = false;
      await storage.withTransaction(ops =>
        ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: work.id }, current => {
          const missing = sources.filter(source => !current.source_facts?.[source.id]);
          if (!missing.length) return null;
          filled = true;
          return {
            source_facts: {
              ...current.source_facts,
              ...Object.fromEntries(missing.map(source => [source.id, factsOf(source)])),
            },
            facts_synced_at: current.facts_synced_at ?? new Date(),
          };
        }),
      );
      if (filled) report.facts++;
    }
  }
  report.aborted = signal?.aborted ?? false;
  return report;
}
