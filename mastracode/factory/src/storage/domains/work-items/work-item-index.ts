/**
 * Indexed copies of what a board reads off every card — the columns it shows in, the session,
 * thread and branch refs that relate it to other cards, and its external source — kept as plain
 * rows so a board can page one column, count every column and look cards up by session through
 * SQL instead of reading every card of the project. `FactoryStorageOps` cannot reach inside a
 * card's JSON columns, so these rows are rewritten next to every card write, in the same transaction.
 */

import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';
import { boardForWorkItem } from '../../../boards/semantics.js';
import type { WorkItemRow } from './base.js';

/** One row per column a card shows in: every stage it holds, or Intake when it holds none. */
export const WORK_ITEM_COLUMNS_SCHEMA: CollectionSchema = {
  name: 'factory_work_item_columns',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    board: { type: 'text' },
    stage: { type: 'text' },
    /** The "recent" sort key: when the card entered the column it sits in now. */
    position: { type: 'text' },
    /** The "created" sort key. */
    created_key: { type: 'text' },
    card_changed_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_work_item_columns_card_unique', columns: ['org_id', 'work_item_id', 'stage'] }],
  indexes: [
    {
      name: 'factory_work_item_columns_recent_idx',
      columns: ['org_id', 'factory_project_id', 'board', 'stage', 'position', 'work_item_id'],
    },
    {
      name: 'factory_work_item_columns_created_idx',
      columns: ['org_id', 'factory_project_id', 'board', 'stage', 'created_key', 'work_item_id'],
    },
  ],
};

/**
 * `session`/`thread`: the card's session refs. `session-branch`: branches its sessions work on
 * (non-PR cards). `pr-head`: the branch an unparented pull request was opened from. `source`:
 * its external source, with what intake de-duplication needs in `detail`.
 */
export type WorkItemRefKind = 'session' | 'thread' | 'session-branch' | 'pr-head' | 'source';

/** One row per value a card can be looked up or related by. */
export const WORK_ITEM_REFS_SCHEMA: CollectionSchema = {
  name: 'factory_work_item_refs',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    kind: { type: 'text' },
    value: { type: 'text' },
    detail: { type: 'json', nullable: true },
  },
  uniqueIndexes: [{ name: 'factory_work_item_refs_card_unique', columns: ['org_id', 'work_item_id', 'kind', 'value'] }],
  indexes: [{ name: 'factory_work_item_refs_lookup_idx', columns: ['org_id', 'factory_project_id', 'kind', 'value'] }],
};

/** One row per project whose index has been built; until then readers use the full card list. */
export const WORK_ITEM_INDEX_BUILDS_SCHEMA: CollectionSchema = {
  name: 'factory_work_item_index_builds',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    version: { type: 'text' },
    built_at: { type: 'timestamp' },
  },
  uniqueIndexes: [{ name: 'factory_work_item_index_builds_scope_unique', columns: ['org_id', 'factory_project_id'] }],
};

/** Bump to rebuild every project's index when what an index row holds changes. */
export const WORK_ITEM_INDEX_VERSION = '1';

export const WORK_ITEM_INDEX_SCHEMAS = [WORK_ITEM_COLUMNS_SCHEMA, WORK_ITEM_REFS_SCHEMA, WORK_ITEM_INDEX_BUILDS_SCHEMA];

/** The columns a card shows in, as the board places it: every stage it holds, or Intake when it holds none. */
export function workItemColumns(item: Pick<WorkItemRow, 'stages'>): readonly string[] {
  return item.stages.length > 0 ? item.stages : ['intake'];
}

/** When the card entered the column it sits in now; the board's "recent" position. */
export function columnPosition(item: Pick<WorkItemRow, 'stages' | 'stageHistory' | 'createdAt'>): string {
  const stage = item.stages[0];
  let latest: string | undefined;
  for (const entry of item.stageHistory) {
    if (entry.stage !== stage || (latest !== undefined && entry.enteredAt <= latest)) continue;
    latest = entry.enteredAt;
  }
  return latest ?? item.createdAt.toISOString();
}

export function isPullRequestRow(item: Pick<WorkItemRow, 'externalSource'>): boolean {
  return item.externalSource?.type === 'pull-request';
}

export function headBranchOf(item: Pick<WorkItemRow, 'metadata'>): string | undefined {
  const branch = item.metadata?.headBranch;
  return typeof branch === 'string' ? branch : undefined;
}

/** The metadata a board needs to recognise an issue or pull request it already has a card for. */
const SOURCE_METADATA_KEYS = ['githubIssueNumber', 'githubPullRequestNumber', 'number', 'githubRepositoryId'] as const;

export interface WorkItemSourceEntry {
  board: string;
  externalSource: { integrationId: string; type: string; externalId: string; url?: string };
  metadata: Record<string, unknown>;
}

/** A card's external source as intake de-duplication reads it, or nothing for a card without one. */
export function workItemSourceEntry(item: WorkItemRow): WorkItemSourceEntry | undefined {
  const source = item.externalSource;
  if (!source) return undefined;
  const metadata: Record<string, unknown> = {};
  for (const key of SOURCE_METADATA_KEYS) {
    if (item.metadata?.[key] !== undefined) metadata[key] = item.metadata[key];
  }
  return {
    board: boardForWorkItem(item),
    externalSource: {
      integrationId: source.integrationId,
      type: source.type,
      externalId: source.externalId,
      ...(source.url ? { url: source.url } : {}),
    },
    metadata,
  };
}

interface IndexRef {
  kind: WorkItemRefKind;
  value: string;
  detail: unknown;
}

function indexRows(item: WorkItemRow) {
  const scope = { org_id: item.orgId, factory_project_id: item.factoryProjectId, work_item_id: item.id };
  const board = boardForWorkItem(item);
  const position = columnPosition(item);
  const created_key = item.createdAt.toISOString();
  const columns = [...new Set(workItemColumns(item))].map(stage => ({
    ...scope,
    board,
    stage,
    position,
    created_key,
    card_changed_at: item.changedAt,
  }));
  const refs = new Map<string, IndexRef>();
  const ref = (kind: WorkItemRefKind, value: unknown, detail: unknown = null) => {
    if (typeof value === 'string' && value) refs.set(`${kind}\u0000${value}`, { kind, value, detail });
  };
  const pullRequest = isPullRequestRow(item);
  for (const session of Object.values(item.sessions)) {
    ref('session', session.sessionId);
    ref('thread', session.threadId);
    if (!pullRequest) ref('session-branch', session.branch);
  }
  if (pullRequest && !item.parentWorkItemId) ref('pr-head', headBranchOf(item));
  const source = workItemSourceEntry(item);
  if (source) ref('source', `${source.externalSource.integrationId}:${source.externalSource.externalId}`, source);
  return { columns, refs: [...refs.values()].map(entry => ({ ...scope, ...entry })) };
}

const refKey = (row: { kind: unknown; value: unknown }) => `${row.kind}\u0000${row.value}`;

type IndexedColumnRow = {
  id: string;
  work_item_id: string;
  board: string;
  stage: string;
  position: string;
  created_key: string;
  card_changed_at: Date;
};

type IndexedRefRow = {
  id: string;
  work_item_id: string;
  kind: string;
  value: string;
  detail: unknown;
};

interface IndexedRows {
  columns: IndexedColumnRow[];
  refs: IndexedRefRow[];
}

/**
 * Make a card's index rows say what `item` says. A copy older than the one indexed is skipped,
 * so a background build that read a card before a write cannot undo that write. Rows are
 * upserted on their unique keys, so two writers indexing one card never duplicate a row.
 */
export async function reindexWorkItem(
  ops: FactoryStorageOps,
  item: WorkItemRow,
  /** The card's index rows when the caller already read them. */
  indexed?: IndexedRows,
): Promise<void> {
  const where = { org_id: item.orgId, work_item_id: item.id };
  const columns = indexed?.columns ?? (await ops.findMany<IndexedColumnRow>(WORK_ITEM_COLUMNS_SCHEMA.name, where));
  if (columns.some(row => row.card_changed_at > item.changedAt)) return;
  const refs = indexed?.refs ?? (await ops.findMany<IndexedRefRow>(WORK_ITEM_REFS_SCHEMA.name, where));
  const wanted = indexRows(item);
  const stages = new Set(wanted.columns.map(row => row.stage));
  const keys = new Set(wanted.refs.map(refKey));
  const unchanged = (row: IndexedColumnRow, next: (typeof wanted.columns)[number]) =>
    row.board === next.board &&
    row.position === next.position &&
    row.created_key === next.created_key &&
    row.card_changed_at.getTime() === next.card_changed_at.getTime();
  const staleColumns = columns.filter(row => !stages.has(row.stage)).map(row => row.id);
  const staleRefs = refs.filter(row => !keys.has(refKey(row))).map(row => row.id);
  if (staleColumns.length) await ops.deleteMany(WORK_ITEM_COLUMNS_SCHEMA.name, { id: { in: staleColumns } });
  if (staleRefs.length) await ops.deleteMany(WORK_ITEM_REFS_SCHEMA.name, { id: { in: staleRefs } });
  const byStage = new Map(columns.map(row => [row.stage, row]));
  for (const row of wanted.columns) {
    const current = byStage.get(row.stage);
    if (current) {
      if (unchanged(current, row)) continue;
      const { board, position, created_key, card_changed_at } = row;
      await ops.updateMany(
        WORK_ITEM_COLUMNS_SCHEMA.name,
        { id: current.id },
        { board, position, created_key, card_changed_at },
      );
    } else {
      await ops.upsertOne(WORK_ITEM_COLUMNS_SCHEMA.name, ['org_id', 'work_item_id', 'stage'], row);
    }
  }
  const existing = new Map(refs.map(row => [refKey(row), row]));
  for (const row of wanted.refs) {
    const current = existing.get(refKey(row));
    if (!current) {
      await ops.upsertOne(WORK_ITEM_REFS_SCHEMA.name, ['org_id', 'work_item_id', 'kind', 'value'], row);
    } else if (JSON.stringify(current.detail ?? null) !== JSON.stringify(row.detail ?? null)) {
      // A source's detail can change under the same key (a PR number filled in).
      await ops.updateMany(WORK_ITEM_REFS_SCHEMA.name, { id: current.id }, { detail: row.detail });
    }
  }
}

export async function unindexWorkItems(ops: FactoryStorageOps, orgId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const where = { org_id: orgId, work_item_id: { in: [...ids] } };
  await ops.deleteMany(WORK_ITEM_COLUMNS_SCHEMA.name, where);
  await ops.deleteMany(WORK_ITEM_REFS_SCHEMA.name, where);
}

/** Card columns index rows derive from; `updateMany` writes touching none of them leave the index alone. */
const INDEXED_COLUMNS = [
  'board',
  'external_source',
  'stages',
  'stage_history',
  'sessions',
  'metadata',
  'created_at',
  'parent_work_item_id',
];

/**
 * Wrap `ops` so every write to `work_items` rewrites the written cards' index rows through the
 * same `ops` — inside the caller's transaction when there is one.
 */
export function indexWorkItemWrites<Row>(ops: FactoryStorageOps, toItem: (row: Row) => WorkItemRow): FactoryStorageOps {
  // The proxied methods return `work_items` rows, which is what `toItem` maps.
  const reindexRow = async (row: unknown) => {
    if (row && typeof row === 'object') await reindexWorkItem(ops, toItem(row as Row));
  };
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      switch (property) {
        case 'updateAtomic':
          return async (collection: string, where: CollectionWhere, fn: (row: unknown) => unknown) => {
            if (collection !== 'work_items') return value.call(target, collection, where, fn);
            let patched = false;
            const row = await value.call(target, collection, where, async (current: unknown) => {
              const patch = await fn(current);
              patched = patch != null;
              return patch;
            });
            if (patched) await reindexRow(row);
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (collection === 'work_items') await reindexRow(row);
            return row;
          };
        case 'updateMany':
          return async (collection: string, where: CollectionWhere, set: Record<string, unknown>) => {
            if (collection !== 'work_items' || !INDEXED_COLUMNS.some(column => column in set)) {
              return value.call(target, collection, where, set);
            }
            // Read the ids first: `set` may change the very columns `where` matched on.
            const touched = await ops.findMany<{ id: string }>('work_items', where);
            const count: number = await value.call(target, collection, where, set);
            for (const ids of chunks(
              touched.map(row => row.id),
              ID_CHUNK,
            )) {
              for (const row of await ops.findMany('work_items', { id: { in: ids } })) await reindexRow(row);
            }
            return count;
          };
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere) => {
            if (collection !== 'work_items') return value.call(target, collection, where);
            if (Object.keys(where).length === 0) {
              await ops.deleteMany(WORK_ITEM_COLUMNS_SCHEMA.name, {});
              await ops.deleteMany(WORK_ITEM_REFS_SCHEMA.name, {});
              return value.call(target, collection, where);
            }
            const doomed = await ops.findMany<{ id: string; org_id: string }>('work_items', where);
            const count: number = await value.call(target, collection, where);
            const byOrg = new Map<string, string[]>();
            for (const row of doomed) byOrg.set(row.org_id, [...(byOrg.get(row.org_id) ?? []), row.id]);
            for (const [orgId, ids] of byOrg) await unindexWorkItems(ops, orgId, ids);
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}

export interface WorkItemIndexScope {
  orgId: string;
  factoryProjectId: string;
}

export type IndexedSort = 'recent' | 'created-newest' | 'created-oldest';

export interface IndexedPageCursor {
  key: string;
  id: string;
}

export interface IndexedColumnPage {
  items: WorkItemRow[];
  nextCursor?: IndexedPageCursor;
}

export interface WorkItemIndexDeps {
  ops: () => FactoryStorageOps;
  /** Every card of the project, read fresh; only the build uses it. */
  listAll: (scope: WorkItemIndexScope) => Promise<readonly WorkItemRow[]>;
  byIds: (scope: WorkItemIndexScope, ids: string[]) => Promise<WorkItemRow[]>;
  /** The board version, so counts can be served again while nothing changed. */
  version: (scope: WorkItemIndexScope) => Promise<string | undefined>;
  onBuildError: (scope: WorkItemIndexScope, error: unknown) => void;
}

/** Cards a build reindexes at once; the index rides the app's connection pool next to live requests. */
const BUILD_CONCURRENCY = 4;
/** Ids per `IN (…)` read. */
const ID_CHUNK = 200;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

const scopeKey = (scope: WorkItemIndexScope) => `${scope.orgId}\u0000${scope.factoryProjectId}`;

/**
 * Reads over the work-item index. Every read answers `undefined` until the project's index has
 * been built, so callers fall back to the full card list; the first read starts the build.
 */
export class WorkItemIndex {
  readonly #deps: WorkItemIndexDeps;
  readonly #ready = new Set<string>();
  readonly #building = new Map<string, Promise<void>>();
  readonly #counts = new Map<
    string,
    { version: string; boards: Record<string, Record<string, number>>; total: number }
  >();

  constructor(deps: WorkItemIndexDeps) {
    this.#deps = deps;
  }

  /** Whether reads can use the index now; starts building it when not. */
  async ready(scope: WorkItemIndexScope): Promise<boolean> {
    const key = scopeKey(scope);
    if (this.#ready.has(key)) return true;
    const build = await this.#deps.ops().findOne<{ version: string }>(WORK_ITEM_INDEX_BUILDS_SCHEMA.name, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
    });
    if (build?.version === WORK_ITEM_INDEX_VERSION) {
      this.#ready.add(key);
      return true;
    }
    if (!this.#building.has(key)) {
      const running = this.build(scope)
        .catch(error => this.#deps.onBuildError(scope, error))
        .finally(() => this.#building.delete(key));
      this.#building.set(key, running);
    }
    return false;
  }

  /**
   * Bring every card's index rows in line with the card, then mark the project built. Writes keep
   * the index current while this runs; a second pass repairs rows from copies a write overtook.
   */
  async build(scope: WorkItemIndexScope): Promise<void> {
    for (let pass = 0; pass < 2; pass++) {
      const ops = this.#deps.ops();
      const items = await this.#deps.listAll(scope);
      const where = { org_id: scope.orgId, factory_project_id: scope.factoryProjectId };
      const [columns, refs] = await Promise.all([
        ops.findMany<IndexedColumnRow>(WORK_ITEM_COLUMNS_SCHEMA.name, where),
        ops.findMany<IndexedRefRow>(WORK_ITEM_REFS_SCHEMA.name, where),
      ]);
      const indexed = new Map<string, IndexedRows>();
      const rowsOf = (id: string) => indexed.get(id) ?? indexed.set(id, { columns: [], refs: [] }).get(id)!;
      for (const row of columns) rowsOf(row.work_item_id).columns.push(row);
      for (const row of refs) rowsOf(row.work_item_id).refs.push(row);
      const live = new Set(items.map(item => item.id));
      const orphanColumns = columns.filter(row => !live.has(row.work_item_id)).map(row => row.id);
      const orphanRefs = refs.filter(row => !live.has(row.work_item_id)).map(row => row.id);
      for (const ids of chunks(orphanColumns, ID_CHUNK))
        await ops.deleteMany(WORK_ITEM_COLUMNS_SCHEMA.name, { id: { in: ids } });
      for (const ids of chunks(orphanRefs, ID_CHUNK))
        await ops.deleteMany(WORK_ITEM_REFS_SCHEMA.name, { id: { in: ids } });
      let next = 0;
      await Promise.all(
        Array.from({ length: BUILD_CONCURRENCY }, async () => {
          while (next < items.length) {
            const item = items[next++]!;
            await reindexWorkItem(ops, item, indexed.get(item.id) ?? { columns: [], refs: [] });
          }
        }),
      );
    }
    await this.#deps.ops().upsertOne(WORK_ITEM_INDEX_BUILDS_SCHEMA.name, ['org_id', 'factory_project_id'], {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
      version: WORK_ITEM_INDEX_VERSION,
      built_at: new Date(),
    });
    this.#ready.add(scopeKey(scope));
  }

  /** One page of one column, ordered like the in-memory pager. */
  async pageColumn(
    scope: WorkItemIndexScope,
    query: { board: string; stage: string; sort: IndexedSort; limit: number; cursor?: IndexedPageCursor },
  ): Promise<IndexedColumnPage | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const keyColumn = query.sort === 'recent' ? 'position' : 'created_key';
    const direction = query.sort === 'created-oldest' ? 'asc' : 'desc';
    const rows = await this.#deps.ops().findMany<{ work_item_id: string; position: string; created_key: string }>(
      WORK_ITEM_COLUMNS_SCHEMA.name,
      {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        board: query.board,
        stage: query.stage,
      },
      {
        orderBy: [
          [keyColumn, direction],
          ['work_item_id', 'desc'],
        ],
        limit: query.limit + 1,
        ...(query.cursor ? { cursor: { values: [query.cursor.key, query.cursor.id] } } : {}),
      },
    );
    const page = rows.slice(0, query.limit);
    const byId = new Map(
      (
        await this.#deps.byIds(
          scope,
          page.map(row => row.work_item_id),
        )
      ).map(item => [item.id, item]),
    );
    const last = page.at(-1);
    return {
      // A card deleted since its index row was read drops out; the next sync removes it anyway.
      items: page.flatMap(row => byId.get(row.work_item_id) ?? []),
      ...(rows.length > query.limit && last
        ? { nextCursor: { key: query.sort === 'recent' ? last.position : last.created_key, id: last.work_item_id } }
        : {}),
    };
  }

  /** Cards per board and column for the columns `stages` names, plus every card of the project. */
  async counts(
    scope: WorkItemIndexScope,
    stages: Record<string, readonly string[]>,
  ): Promise<{ total: number; boards: Record<string, Record<string, number>> } | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const version = await this.#deps.version(scope);
    const key = `${scopeKey(scope)}\u0000${JSON.stringify(stages)}`;
    const hit = this.#counts.get(key);
    if (version && hit?.version === version) return { total: hit.total, boards: hit.boards };
    const ops = this.#deps.ops();
    const count = ops.count?.bind(ops);
    if (!count) return undefined;
    const where = { org_id: scope.orgId, factory_project_id: scope.factoryProjectId };
    const entries = Object.entries(stages).flatMap(([board, list]) => list.map(stage => ({ board, stage })));
    const [total, ...counted] = await Promise.all([
      count('work_items', where),
      ...entries.map(entry => count(WORK_ITEM_COLUMNS_SCHEMA.name, { ...where, ...entry })),
    ]);
    const boards: Record<string, Record<string, number>> = {};
    entries.forEach((entry, index) => {
      if (counted[index]) (boards[entry.board] ??= {})[entry.stage] = counted[index]!;
    });
    if (version) this.#counts.set(key, { version, total: total!, boards });
    if (this.#counts.size > 200) this.#counts.delete(this.#counts.keys().next().value!);
    return { total: total!, boards };
  }

  /** Ids of the project's cards holding a ref of `kind` with any of `values`. */
  async idsByRef(
    scope: WorkItemIndexScope,
    kind: WorkItemRefKind,
    values: readonly string[],
  ): Promise<string[] | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const ids = new Set<string>();
    for (const part of chunks([...new Set(values)], ID_CHUNK)) {
      const rows = await this.#deps.ops().findMany<{ work_item_id: string }>(WORK_ITEM_REFS_SCHEMA.name, {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        kind,
        value: { in: part },
      });
      for (const row of rows) ids.add(row.work_item_id);
    }
    return [...ids];
  }

  /** Ref values of `kind` in `values` that some card of the project holds. */
  async heldRefs(
    scope: WorkItemIndexScope,
    kind: WorkItemRefKind,
    values: readonly string[],
  ): Promise<string[] | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const held = new Set<string>();
    for (const part of chunks([...new Set(values)], ID_CHUNK)) {
      const rows = await this.#deps.ops().findMany<{ value: string }>(WORK_ITEM_REFS_SCHEMA.name, {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        kind,
        value: { in: part },
      });
      for (const row of rows) held.add(row.value);
    }
    return [...held];
  }

  /** Cards related to `matched` as {@link withRelatedWorkItems} relates them, read through the index. */
  async related(scope: WorkItemIndexScope, matched: readonly WorkItemRow[]): Promise<WorkItemRow[] | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const matchedIds = matched.map(item => item.id);
    const parentIds = matched.flatMap(item => (item.parentWorkItemId ? [item.parentWorkItemId] : []));
    const sessionBranches = matched
      .filter(item => !isPullRequestRow(item))
      .flatMap(item => Object.values(item.sessions).map(ref => ref.branch));
    const pullRequestBranches = matched.flatMap(item => {
      const branch = isPullRequestRow(item) && !item.parentWorkItemId ? headBranchOf(item) : undefined;
      return branch === undefined ? [] : [branch];
    });
    const ops = this.#deps.ops();
    const children: string[] = [];
    for (const part of chunks(matchedIds, ID_CHUNK)) {
      const rows = await ops.findMany<{ id: string }>('work_items', {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        parent_work_item_id: { in: part },
      });
      children.push(...rows.map(row => row.id));
    }
    const [pullRequests, branchOwners] = await Promise.all([
      this.idsByRef(scope, 'pr-head', sessionBranches),
      this.idsByRef(scope, 'session-branch', pullRequestBranches),
    ]);
    const known = new Set(matchedIds);
    const wanted = [...new Set([...parentIds, ...children, ...(pullRequests ?? []), ...(branchOwners ?? [])])].filter(
      id => !known.has(id),
    );
    const related: WorkItemRow[] = [];
    for (const part of chunks(wanted, ID_CHUNK)) related.push(...(await this.#deps.byIds(scope, part)));
    return [...matched, ...related];
  }

  /** Every card's external source, read off the index. */
  async sources(scope: WorkItemIndexScope): Promise<WorkItemSourceEntry[] | undefined> {
    if (!(await this.ready(scope))) return undefined;
    const rows = await this.#deps.ops().findMany<{ detail: WorkItemSourceEntry | null }>(WORK_ITEM_REFS_SCHEMA.name, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
      kind: 'source',
    });
    return rows.flatMap(row => row.detail ?? []);
  }
}
