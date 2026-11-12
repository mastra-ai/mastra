import { randomUUID } from 'node:crypto';

import type { CollectionListOptions, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import { splitLegacyWorkItem } from '../../../work-items/split-migration.js';
import type { ExternalWorkItemSource, WorkItemDbRow } from './base.js';
import {
  isLegacyReviewPlacement,
  LEGACY_REVIEW_BOARD,
  normalizeLegacyReviewColumns,
  readLegacyReviewRow,
  readReviewBoardInUse,
  widenLegacyReviewBoardFilter,
} from './legacy-review.js';
import type { ReviewBoardInUse } from './legacy-review.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA,
  FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA,
  WORK_ITEMS_SCHEMA,
} from './work-item-schema.js';
import type { BoardItemDbRecord, WorkItemDbRecord, WorkItemSourceDbRecord } from './work-item-schema.js';

const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const BOARD_COLUMNS = new Set(Object.keys(FACTORY_BOARD_ITEMS_SCHEMA.columns));
const PROJECTED_COLUMNS = new Set([
  'work_item',
  'work_item_sources',
  'external_source',
  'source_key',
  'title',
  'description',
]);
const ID_BATCH = 500;
const LEGACY = WORK_ITEMS_SCHEMA.name;
const LEGACY_KEYS = ['id', 'org_id', 'factory_project_id', 'source_key'] as const;

/** Copies legacy cards that have no split rows yet; only supplied while the split backfill is pending. */
export interface LegacyCardCopier {
  copy(rows: readonly WorkItemDbRow[]): Promise<void>;
}

export type CardInsert = Pick<
  WorkItemDbRow,
  | 'org_id'
  | 'factory_project_id'
  | 'board'
  | 'external_source'
  | 'source_key'
  | 'parent_work_item_id'
  | 'title'
  | 'stages'
  | 'stage_history'
  | 'sessions'
  | 'metadata'
  | 'revision'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
> & { description?: string | null };

export function splitCardRows(card: WorkItemDbRow, options: { workItemId: string; revision?: number }) {
  const rows = splitLegacyWorkItem(card, options);
  return { ...rows, boardItem: { ...rows.boardItem, migrated_from_updated_at: null, migrated_from_hash: null } };
}

function externalSourceOf(source: WorkItemSourceDbRecord | undefined): ExternalWorkItemSource | null {
  if (!source) return null;
  const prefix = `${source.source_type}:${source.workspace_id ? `${source.workspace_id}:` : ''}`;
  return {
    integrationId: source.integration_id,
    type: source.source_type,
    ...(source.workspace_id ? { workspaceId: source.workspace_id } : {}),
    externalId: source.external_id.startsWith(prefix) ? source.external_id.slice(prefix.length) : source.external_id,
    ...(source.url ? { url: source.url } : {}),
  };
}

/** A source row written before `role` existed is its work item's only source, so it is the origin. */
function isOriginSource(source: WorkItemSourceDbRecord): boolean {
  return source.role !== 'attached';
}

/** The origin source first, then attached ones, each keeping the order they were read in. */
function originFirst(sources: WorkItemSourceDbRecord[]): WorkItemSourceDbRecord[] {
  return [...sources.filter(isOriginSource), ...sources.filter(source => !isOriginSource(source))];
}

function joinCard(
  board: BoardItemDbRecord,
  work: WorkItemDbRecord | null,
  sources: WorkItemSourceDbRecord[],
  reviewInUse = false,
): WorkItemDbRow {
  if (!work) throw new Error(`Board item ${board.id} has no work item ${board.work_item_id}.`);
  const source = sources.find(isOriginSource) ?? sources[0];
  return readLegacyReviewRow(
    {
      work_item: work,
      work_item_sources: sources,
      id: board.id,
      org_id: board.org_id,
      factory_project_id: board.factory_project_id,
      board: board.board,
      external_source: externalSourceOf(source),
      source_key: source?.source_key ?? null,
      claim_key: null,
      parent_work_item_id: board.parent_board_item_id,
      title: work.title,
      description: work.description ?? null,
      stages: board.stages,
      stage_history: board.stage_history as WorkItemDbRow['stage_history'],
      sessions: board.sessions as WorkItemDbRow['sessions'],
      metadata: board.metadata || source?.metadata ? { ...board.metadata, ...source?.metadata } : null,
      triage_type: board.triage_type ?? null,
      autonomy_armed_at: board.autonomy_armed_at ?? null,
      plans_preapproved_at: board.plans_preapproved_at ?? null,
      accepted_at: board.accepted_at ?? null,
      revision: board.revision,
      created_by: board.created_by,
      created_at: board.created_at,
      updated_at: board.updated_at,
      changed_at: board.changed_at,
    },
    reviewInUse,
  );
}

/** A board filter that leaves Review out: a widened query's rows a project keeping Review holds there. */
function excludesReview(filter: unknown): boolean {
  if (filter === LEGACY_REVIEW_BOARD) return false;
  if (filter && typeof filter === 'object' && 'in' in filter && Array.isArray(filter.in)) {
    return !filter.in.includes(LEGACY_REVIEW_BOARD);
  }
  return true;
}

/** Strictly after the row's last change, so two writes in one millisecond still both read as changes. */
function nextChangedAt(row: { changed_at?: Date | string | null }): Date {
  const previous = row.changed_at ? new Date(row.changed_at).getTime() : 0;
  return new Date(Math.max(Date.now(), previous + 1));
}

function boardColumns(patch: Partial<WorkItemDbRow>, { filter = false } = {}): Partial<BoardItemDbRecord> {
  const columns: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(patch)) {
    if ((column === 'id' && !filter) || column === 'claim_key' || PROJECTED_COLUMNS.has(column)) continue;
    if (column === 'parent_work_item_id') columns.parent_board_item_id = value;
    else if (BOARD_COLUMNS.has(column)) columns[column] = value;
    else throw new Error(`[cards] unknown card column '${column}'.`);
  }
  return columns as Partial<BoardItemDbRecord>;
}

/** Compatibility row operations over work, source and placement tables. Writes require transaction ops. */
export class Cards {
  constructor(
    private readonly ops: FactoryStorageOps,
    private readonly legacyMode = false,
    private readonly copier?: LegacyCardCopier,
    private readonly reviewInUse: ReviewBoardInUse = readReviewBoardInUse,
  ) {}

  readonly #reviewInUse = new Map<string, Promise<boolean>>();

  /** The projects among `boards` that still use the Review board, asked once per project per operation. */
  async #projectsUsingReview(boards: readonly BoardItemDbRecord[]): Promise<Set<string>> {
    const using = new Set<string>();
    for (const board of boards) {
      if (board.board !== LEGACY_REVIEW_BOARD) continue;
      const key = `${board.org_id}\0${board.factory_project_id}`;
      let inUse = this.#reviewInUse.get(key);
      if (!inUse) {
        inUse = this.reviewInUse(this.ops, { orgId: board.org_id, factoryProjectId: board.factory_project_id });
        this.#reviewInUse.set(key, inUse);
      }
      if (await inUse) using.add(key);
    }
    return using;
  }

  /**
   * Copies the legacy cards a lookup by id or source addresses that have no split rows and no
   * tombstone. Returns whether it tried, so the caller re-reads the split tables.
   */
  async #copyLegacy(where: CollectionWhere): Promise<boolean> {
    if (!this.copier || (where.id === undefined && where.source_key === undefined)) return false;
    const legacyWhere: CollectionWhere = {};
    for (const key of LEGACY_KEYS) if (where[key] !== undefined) legacyWhere[key] = where[key];
    const rows = await this.ops.findMany<WorkItemDbRow>(LEGACY, legacyWhere);
    if (!rows.length) return false;
    const ids = { in: rows.map(row => row.id) };
    const done = new Set(
      [
        ...(await this.ops.findMany<{ id: string }>(BOARD_ITEMS, { id: ids })),
        ...(await this.ops.findMany<{ id: string }>(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, { id: ids })),
      ].map(row => row.id),
    );
    const missing = rows.filter(row => !done.has(row.id));
    if (!missing.length) return false;
    await this.copier.copy(missing);
    return true;
  }

  /** Single-card writes copy first only when the split tables miss the card. */
  async #copyLegacyOnMiss(where: CollectionWhere): Promise<void> {
    if (!this.copier) return;
    const boardWhere = await this.#where(where);
    if (boardWhere && (await this.ops.findOne(BOARD_ITEMS, boardWhere))) return;
    await this.#copyLegacy(where);
  }

  async #where(where: CollectionWhere): Promise<CollectionWhere | null> {
    const { source_key: sourceKey, ...rest } = where;
    const boardWhere = boardColumns(rest as Partial<WorkItemDbRow>, { filter: true }) as CollectionWhere;
    if (boardWhere.board !== undefined) boardWhere.board = widenLegacyReviewBoardFilter(boardWhere.board) as never;
    if (sourceKey === undefined) return boardWhere;
    const scope: CollectionWhere = {};
    if (rest.org_id !== undefined) scope.org_id = rest.org_id;
    if (rest.factory_project_id !== undefined) scope.factory_project_id = rest.factory_project_id;
    const sources = await this.ops.findMany<WorkItemSourceDbRecord>(SOURCES, { ...scope, source_key: sourceKey });
    return sources.length ? { ...boardWhere, work_item_id: { in: sources.map(source => source.work_item_id) } } : null;
  }

  async #join(boards: readonly BoardItemDbRecord[]): Promise<WorkItemDbRow[]> {
    const ids = [...new Set(boards.map(board => board.work_item_id))];
    const items = new Map<string, WorkItemDbRecord>();
    const sources = new Map<string, WorkItemSourceDbRecord[]>();
    for (let index = 0; index < ids.length; index += ID_BATCH) {
      const pageIds = ids.slice(index, index + ID_BATCH);
      const page = await this.ops.findMany<WorkItemDbRecord>(WORK_ITEMS, { id: { in: pageIds } });
      for (const item of page) items.set(item.id, item);
      const sourcePage = await this.ops.findMany<WorkItemSourceDbRecord>(
        SOURCES,
        { work_item_id: { in: pageIds } },
        {
          orderBy: [
            ['created_at', 'asc'],
            ['id', 'asc'],
          ],
        },
      );
      for (const source of sourcePage) {
        const group = sources.get(source.work_item_id) ?? [];
        group.push(source);
        sources.set(source.work_item_id, group);
      }
    }
    const deletedMidRead = await this.#deletedBoardIds(boards.filter(board => !items.has(board.work_item_id)));
    const usingReview = await this.#projectsUsingReview(boards);
    return boards
      .filter(board => !deletedMidRead.has(board.id))
      .map(board =>
        joinCard(
          board,
          items.get(board.work_item_id) ?? null,
          originFirst(sources.get(board.work_item_id) ?? []),
          usingReview.has(`${board.org_id}\0${board.factory_project_id}`),
        ),
      );
  }

  async #deletedBoardIds(boards: readonly BoardItemDbRecord[]): Promise<Set<string>> {
    const deleted = new Set(boards.map(board => board.id));
    const ids = [...deleted];
    for (let index = 0; index < ids.length; index += ID_BATCH) {
      const page = await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, {
        id: { in: ids.slice(index, index + ID_BATCH) },
      });
      for (const board of page) deleted.delete(board.id);
    }
    return deleted;
  }

  async findOne(where: CollectionWhere): Promise<WorkItemDbRow | null> {
    if (this.legacyMode) return this.ops.findOne(WORK_ITEMS_SCHEMA.name, where);
    const found = await this.#findOne(where);
    return found || !(await this.#copyLegacy(where)) ? found : this.#findOne(where);
  }

  async #findOne(where: CollectionWhere): Promise<WorkItemDbRow | null> {
    const boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    if (where.board !== undefined && excludesReview(where.board)) {
      // The widened filter may match a row its project keeps on Review; only another row answers.
      return (await this.#findMany(where, boardWhere))[0] ?? null;
    }
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    return board ? ((await this.#join([board]))[0] ?? null) : null;
  }

  async #findMany(
    where: CollectionWhere,
    boardWhere: CollectionWhere,
    options?: CollectionListOptions,
  ): Promise<WorkItemDbRow[]> {
    const rows = await this.#join(await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, options));
    // A filter that leaves Review out was widened to find redundant Review rows read as Work;
    // rows a project keeps on Review still read as Review, so they don't match it.
    return where.board !== undefined && excludesReview(where.board)
      ? rows.filter(row => row.board !== LEGACY_REVIEW_BOARD)
      : rows;
  }

  async findMany(where: CollectionWhere, options?: CollectionListOptions): Promise<WorkItemDbRow[]> {
    if (this.legacyMode) return this.ops.findMany(WORK_ITEMS_SCHEMA.name, where, options);
    // A split hit does not prove every match is copied (a source spans projects), so check first.
    await this.#copyLegacy(where);
    const boardWhere = await this.#where(where);
    return boardWhere ? this.#findMany(where, boardWhere, options) : [];
  }

  async insertOne(card: CardInsert): Promise<WorkItemDbRow> {
    if (this.legacyMode) return this.ops.insertOne<WorkItemDbRow>(WORK_ITEMS_SCHEMA.name, card);
    const rows = splitCardRows(
      {
        claim_key: null,
        triage_type: null,
        autonomy_armed_at: null,
        plans_preapproved_at: null,
        accepted_at: null,
        description: null,
        ...card,
        id: randomUUID(),
      },
      { workItemId: randomUUID() },
    );
    const work = await this.ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, rows.workItem);
    if (rows.source) await this.ops.insertOne(SOURCES, rows.source);
    const board = await this.ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, {
      ...rows.boardItem,
      changed_at: new Date(),
    });
    const reviewInUse = (await this.#projectsUsingReview([board])).size > 0;
    return joinCard(board, work, rows.source ? [rows.source] : [], reviewInUse);
  }

  async updateAtomic(
    where: CollectionWhere,
    updater: (card: WorkItemDbRow) => Partial<WorkItemDbRow> | null | Promise<Partial<WorkItemDbRow> | null>,
    /**
     * Moves the board item's `updated_at` forward even when only work or source facts changed,
     * without bumping its revision, so a revision-and-time guarded delete sees the write.
     */
    { touch = false }: { touch?: boolean } = {},
  ): Promise<WorkItemDbRow | null> {
    if (this.legacyMode) return this.ops.updateAtomic(WORK_ITEMS_SCHEMA.name, where, updater);
    await this.#copyLegacyOnMiss(where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    const board = await this.ops.updateAtomic<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, async row => {
      const joined = (await this.#join([row]))[0]!;
      const matchedSource = joined.work_item_sources?.find(source => source.source_key === where.source_key);
      const current = matchedSource
        ? {
            ...joined,
            external_source: externalSourceOf(matchedSource),
            source_key: matchedSource.source_key,
            metadata: row.metadata || matchedSource.metadata ? { ...row.metadata, ...matchedSource.metadata } : null,
            work_item_sources: [
              matchedSource,
              ...joined.work_item_sources!.filter(source => source.id !== matchedSource.id),
            ],
          }
        : joined;
      const patch = await updater(current);
      if (!patch) return null;
      const columns = boardColumns(patch);
      if (patch.metadata !== undefined) {
        const next = { ...current, ...patch };
        const split = splitCardRows(next, { workItemId: row.work_item_id });
        columns.metadata = split.boardItem.metadata;
      }
      const titleChanged = patch.title !== undefined && patch.title !== current.title;
      const descriptionChanged = patch.description !== undefined && patch.description !== current.description;
      // Both live on the work item, so a card with a source can change without its own row moving.
      let wroteCard = titleChanged || descriptionChanged;
      if (titleChanged || descriptionChanged) {
        await this.ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: row.work_item_id }, work => ({
          ...(titleChanged ? { title: patch.title } : {}),
          ...(descriptionChanged ? { description: patch.description } : {}),
          revision: work.revision + 1,
          updated_at: new Date(),
        }));
      }
      if (patch.metadata !== undefined || patch.external_source !== undefined) {
        const next = splitCardRows({ ...current, ...patch }, { workItemId: row.work_item_id }).source;
        const previous = current.work_item_sources?.[0];
        if (next && previous) {
          const before = splitCardRows(current, { workItemId: row.work_item_id }).source;
          const changed = Object.fromEntries(
            Object.entries(next).filter(
              ([key, value]) =>
                !['id', 'revision', 'created_at', 'updated_at', 'synced_at'].includes(key) &&
                JSON.stringify(before?.[key]) !== JSON.stringify(value),
            ),
          );
          wroteCard ||= Object.keys(changed).length > 0;
          if (Object.keys(changed).length)
            await this.ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id: previous.id }, source => {
              const metadata = { ...source.metadata };
              if ('metadata' in changed && next.metadata !== null) {
                for (const key of new Set([...Object.keys(before?.metadata ?? {}), ...Object.keys(next.metadata)])) {
                  if (JSON.stringify(before?.metadata?.[key]) === JSON.stringify(next.metadata[key])) continue;
                  if (Object.hasOwn(next.metadata, key)) metadata[key] = next.metadata[key];
                  else delete metadata[key];
                }
              }
              return {
                ...changed,
                ...('metadata' in changed ? { metadata: next.metadata === null ? null : metadata } : {}),
                revision: source.revision + 1,
                updated_at: new Date(),
                synced_at: new Date(),
              };
            });
        } else if (next) {
          await this.ops.insertOne(SOURCES, next);
          wroteCard = true;
        } else if (previous) {
          await this.ops.deleteMany(SOURCES, { id: previous.id });
          wroteCard = true;
        }
      }
      const nativeTitleChanged = !current.external_source && titleChanged;
      const boardChanged =
        nativeTitleChanged ||
        descriptionChanged ||
        Object.entries(columns).some(
          ([key, value]) =>
            !['revision', 'updated_at'].includes(key) && JSON.stringify(row[key]) !== JSON.stringify(value),
        );
      // Board reloads read only rows whose `changed_at` moved, so any change to the card moves it.
      const changedAt = nextChangedAt(row);
      if (!boardChanged) {
        if (!touch && !wroteCard) return null;
        return {
          changed_at: changedAt,
          ...(touch ? { updated_at: new Date(Math.max(Date.now(), new Date(row.updated_at).getTime() + 1)) } : {}),
        };
      }
      // A legacy Review row read as Work stores its Work placement on its first real write.
      if (
        isLegacyReviewPlacement(row.board, joined.work_item_sources?.[0]?.source_type) &&
        joined.board !== LEGACY_REVIEW_BOARD
      ) {
        Object.assign(columns, normalizeLegacyReviewColumns(row, columns));
      }
      return {
        ...columns,
        changed_at: changedAt,
        ...(nativeTitleChanged
          ? { revision: patch.revision ?? row.revision + 1, updated_at: patch.updated_at ?? new Date() }
          : {}),
      };
    });
    return board ? ((await this.#join([board]))[0] ?? null) : null;
  }

  /**
   * Add one more source to an existing card's work item. The new source is stored
   * as `attached`, so it sorts after the card's origin source and never becomes the
   * card's primary source, whatever its timestamp. Only
   * the source's provider facts are stored; Factory-owned keys in `metadata`
   * (trust stamps, process state) belong to the card and are ignored here.
   */
  async attachSource(
    where: { org_id: string; id: string },
    source: { external_source: ExternalWorkItemSource; metadata: Record<string, unknown> | null; now: Date },
    expectedRevision?: number,
  ): Promise<{ row: WorkItemDbRow; attached: boolean; ownerWorkItemId?: string; revisionConflict?: true } | null> {
    if (this.legacyMode) throw new Error('[cards] attaching a source needs the split work item tables.');
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, where);
    if (!board) return null;
    const [joined] = await this.#join([board]);
    if (!joined) return null;
    const next = splitCardRows(
      { ...joined, external_source: source.external_source, metadata: source.metadata },
      { workItemId: board.work_item_id },
    ).source;
    if (!next) throw new Error('[cards] an attached source must carry provider facts.');
    const existing = await this.ops.findOne<WorkItemSourceDbRecord>(SOURCES, {
      org_id: board.org_id,
      factory_project_id: board.factory_project_id,
      provider: next.provider,
      external_id: next.external_id,
    });
    if (existing) {
      return existing.work_item_id === board.work_item_id
        ? { row: joined, attached: false }
        : { row: joined, attached: false, ownerWorkItemId: existing.work_item_id };
    }
    // Bump the card first: the row lock makes a concurrent attach against the same revision
    // wait, then see the new revision and stop.
    let stale = false;
    const bumped = await this.ops.updateAtomic<BoardItemDbRecord>(BOARD_ITEMS, { id: board.id }, row => {
      if (expectedRevision !== undefined && row.revision !== expectedRevision) {
        stale = true;
        return null;
      }
      return {
        revision: row.revision + 1,
        updated_at: source.now,
        changed_at: nextChangedAt(row),
        ...(isLegacyReviewPlacement(row.board, joined.work_item_sources?.[0]?.source_type) &&
        joined.board !== LEGACY_REVIEW_BOARD
          ? normalizeLegacyReviewColumns(row, {})
          : {}),
      };
    });
    if (!bumped || stale) return { row: joined, attached: false, revisionConflict: true };
    await this.ops.insertOne<WorkItemSourceDbRecord>(SOURCES, {
      ...next,
      id: randomUUID(),
      role: 'attached',
      created_at: source.now,
      updated_at: source.now,
      synced_at: source.now,
    });
    const [attached] = await this.#join([bumped]);
    return attached ? { row: attached, attached: true } : null;
  }

  async updateMany(where: CollectionWhere, patch: Partial<WorkItemDbRow>): Promise<number> {
    if (this.legacyMode) return this.ops.updateMany(WORK_ITEMS_SCHEMA.name, where, patch);
    const boards = await this.findMany(where);
    for (const board of boards) await this.updateAtomic({ id: board.id }, () => patch);
    return boards.length;
  }

  async deleteMany(where: CollectionWhere): Promise<number> {
    if (this.legacyMode) return this.ops.deleteMany(WORK_ITEMS_SCHEMA.name, where);
    // Copy first so the delete tombstones the card; otherwise the backfill would bring it back.
    await this.#copyLegacy(where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return 0;
    const boards = await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, { orderBy: [['id', 'asc']] });
    let deleted = 0;
    for (const board of boards) {
      const scope = { org_id: board.org_id, factory_project_id: board.factory_project_id };
      const guard = await this.ops.updateAtomic(
        FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name,
        { id: board.id },
        () => null,
      );
      if (!guard) await this.ops.insertOne(FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name, { ...scope, id: board.id });
      // Re-check the whole filter under the row lock, so a write that landed since the read
      // above (e.g. a bumped revision) keeps the row.
      const locked = await this.ops.updateAtomic(BOARD_ITEMS, { ...boardWhere, ...scope, id: board.id }, () => null);
      if (!locked) continue;
      deleted++;
      await this.ops.updateAtomic(WORK_ITEMS, { ...scope, id: board.work_item_id }, () => null);
      const sources = await this.ops.findMany<WorkItemSourceDbRecord>(
        SOURCES,
        { ...scope, work_item_id: board.work_item_id },
        { orderBy: [['id', 'asc']] },
      );
      for (const source of sources) await this.ops.updateAtomic(SOURCES, { id: source.id }, () => null);
      await this.ops.deleteMany(SOURCES, { ...scope, work_item_id: board.work_item_id });
      await this.ops.deleteMany(BOARD_ITEMS, { ...scope, id: board.id });
      await this.ops.deleteMany(WORK_ITEMS, { ...scope, id: board.work_item_id });
      await this.ops.upsertOne(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, ['id'], {
        ...scope,
        id: board.id,
        deleted_at: new Date(),
      });
    }
    return deleted;
  }
}
