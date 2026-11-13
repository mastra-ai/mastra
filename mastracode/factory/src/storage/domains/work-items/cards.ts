import { randomUUID } from 'node:crypto';

import type { CollectionListOptions, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import { DEFAULT_BOARD_ID } from '../../../boards/default-board.js';
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
  fanOutSourceFacts,
  itemsForSourceKeys,
  linkedItems,
  linkSource,
  lockSourceGroup,
  sourcesForItems,
  unlinkSource,
} from './source-links.js';
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
    // Owners come first, so the card intake filed first is the one a single lookup returns.
    const items = await itemsForSourceKeys(this.ops, rest, sourceKey);
    return items.length ? { ...boardWhere, work_item_id: { in: items } } : null;
  }

  /** Cards matched through a source key, in the order {@link #where} listed their work items. */
  #sourceOrder(boardWhere: CollectionWhere, rows: WorkItemDbRow[]): WorkItemDbRow[] {
    const filter = boardWhere.work_item_id;
    if (!filter || typeof filter !== 'object' || !('in' in filter) || !Array.isArray(filter.in)) return rows;
    const order = filter.in as string[];
    const rank = (row: WorkItemDbRow) => order.indexOf(row.work_item!.id);
    return [...rows].sort((a, b) => rank(a) - rank(b));
  }

  async #join(boards: readonly BoardItemDbRecord[]): Promise<WorkItemDbRow[]> {
    const ids = [...new Set(boards.map(board => board.work_item_id))];
    const items = new Map<string, WorkItemDbRecord>();
    for (let index = 0; index < ids.length; index += ID_BATCH) {
      const page = await this.ops.findMany<WorkItemDbRecord>(WORK_ITEMS, {
        id: { in: ids.slice(index, index + ID_BATCH) },
      });
      for (const item of page) items.set(item.id, item);
    }
    const sources = await sourcesForItems(this.ops, ids);
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
    if (where.source_key !== undefined) return (await this.#findMany(where, boardWhere))[0] ?? null;
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    return board ? ((await this.#join([board]))[0] ?? null) : null;
  }

  async #findMany(
    where: CollectionWhere,
    boardWhere: CollectionWhere,
    options?: CollectionListOptions,
  ): Promise<WorkItemDbRow[]> {
    let rows = await this.#join(await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, options));
    if (where.source_key !== undefined && !options?.orderBy) rows = this.#sourceOrder(boardWhere, rows);
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
    const now = new Date();
    const work = await this.ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, rows.workItem);
    if (rows.source) {
      await this.ops.insertOne(SOURCES, rows.source);
      await linkSource(this.ops, rows.source, work.id, 'origin', now);
    }
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
    let boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    // A source key can name several cards (one per board); write the one a lookup returns.
    const target =
      where.source_key !== undefined
        ? (await this.#findMany(where, boardWhere)).map(card => ({ id: card.id, work_item_id: card.work_item!.id }))[0]
        : await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    if (!target) return null;
    boardWhere = { ...boardWhere, id: target.id };
    // Shared source facts reach every sibling, so take their cards first, in the group's order.
    await lockSourceGroup(this.ops, [target.work_item_id]);
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
          const written = !Object.keys(changed).length
            ? null
            : await this.ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id: previous.id }, source => {
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
          if (written) await fanOutSourceFacts(this.ops, written);
        } else if (next) {
          const inserted = await this.ops.insertOne<WorkItemSourceDbRecord>(SOURCES, next);
          await linkSource(this.ops, inserted, row.work_item_id, 'origin');
          wroteCard = true;
        } else if (previous) {
          const stored = await this.ops.findOne<WorkItemSourceDbRecord>(SOURCES, { id: previous.id });
          if (stored) await unlinkSource(this.ops, stored, row.work_item_id);
          wroteCard = true;
        }
      }
      // After the source: every write sharing facts takes source, then work item rows.
      if (titleChanged || descriptionChanged) {
        await this.ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: row.work_item_id }, work => ({
          ...(titleChanged ? { title: patch.title } : {}),
          ...(descriptionChanged ? { description: patch.description } : {}),
          revision: work.revision + 1,
          updated_at: new Date(),
        }));
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
    const found = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, where);
    if (!found) return null;
    await lockSourceGroup(this.ops, [found.work_item_id]);
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, { ...where, id: found.id });
    if (!board) return null;
    const [joined] = await this.#join([board]);
    if (!joined) return null;
    const next = splitCardRows(
      { ...joined, external_source: source.external_source, metadata: source.metadata },
      { workItemId: board.work_item_id },
    ).source;
    if (!next) throw new Error('[cards] an attached source must carry provider facts.');
    const filed = await this.ops.findOne<WorkItemSourceDbRecord>(SOURCES, {
      org_id: board.org_id,
      factory_project_id: board.factory_project_id,
      provider: next.provider,
      external_id: next.external_id,
    });
    // Lock the card's sources and the pull request's, in id order like every write linking a
    // source, so neither's holders change under us: a card added to another board meanwhile
    // waits, then links the pull request too.
    const locks = [...(joined.work_item_sources ?? []).map(row => row.id), ...(filed ? [filed.id] : [])];
    let existing: WorkItemSourceDbRecord | null = null;
    for (const id of [...new Set(locks)].sort()) {
      const locked = await this.ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id }, () => null);
      if (id === filed?.id) existing = locked;
    }
    // A pull request joins the issue, so every card of the issue carries it.
    const issueCards = await this.#originSiblings(joined);
    if (existing) {
      const holders = (await linkedItems(this.ops, [existing])).get(existing.id)!.map(link => link.workItemId);
      if (!holders.some(holder => issueCards.includes(holder))) {
        return { row: joined, attached: false, ownerWorkItemId: existing.work_item_id };
      }
      for (const item of issueCards) await linkSource(this.ops, existing, item, 'attached', source.now);
      await fanOutSourceFacts(this.ops, existing, { now: source.now });
      const [row] = await this.#join([board]);
      return { row: row ?? joined, attached: false };
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
    const inserted = await this.ops.insertOne<WorkItemSourceDbRecord>(SOURCES, {
      ...next,
      id: randomUUID(),
      role: 'attached',
      created_at: source.now,
      updated_at: source.now,
      synced_at: source.now,
    });
    for (const item of issueCards) await linkSource(this.ops, inserted, item, 'attached', source.now);
    await fanOutSourceFacts(this.ops, inserted, { now: source.now, stamp: issueCards.length > 1 });
    const [attached] = await this.#join([bumped]);
    return attached ? { row: attached, attached: true } : null;
  }

  /**
   * A new card, with a work item of its own, for the external record this card was filed from,
   * on another board. It reads the same sources (the issue and any pull request joined to it) and
   * copies their facts and the title; placement and process state start fresh. One card per board:
   * the source row's lock serializes concurrent adds, so a board that already holds a card for
   * the record refuses another.
   */
  async linkToBoard(
    where: { org_id: string; id: string },
    { board: target, stage, by, now }: { board: string; stage: string; by: string; now: Date },
  ): Promise<{ row: WorkItemDbRow } | { alreadyOn: string } | { noSource: true } | null> {
    if (this.legacyMode) throw new Error('[cards] linking a card to a board needs the split work item tables.');
    const found = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, where);
    if (!found) return null;
    await lockSourceGroup(this.ops, [found.work_item_id]);
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, { ...where, id: found.id });
    if (!board) return null;
    const [read] = await this.#join([board]);
    if (!read) return null;
    if (!read.work_item_sources?.some(source => source.role !== 'attached')) return { noSource: true };
    // Lock the card's sources in id order, then read them again: a pull request joined or a
    // source removed between the first read and the locks must be what the new card links to.
    for (const id of (read.work_item_sources ?? []).map(source => source.id).sort()) {
      await this.ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id }, () => null);
    }
    const [card] = await this.#join([board]);
    const source = card?.work_item_sources?.find(row => row.role !== 'attached');
    if (!card || !source) return null;
    const holders = (await linkedItems(this.ops, [source])).get(source.id)!.map(link => link.workItemId);
    const placed = await this.#join(
      await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, { work_item_id: { in: holders } }),
    );
    const taken = placed.find(row => (row.board ?? DEFAULT_BOARD_ID) === target);
    if (taken) return { alreadyOn: taken.id };

    const sources = card.work_item_sources ?? [];
    const work = await this.ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, {
      id: randomUUID(),
      org_id: board.org_id,
      factory_project_id: board.factory_project_id,
      title: card.title,
      description: card.description ?? null,
      parent_work_item_id: null,
      revision: 1,
      created_at: now,
      updated_at: now,
    });
    for (const read of sources) {
      await linkSource(this.ops, read, work.id, read.id === source.id ? 'origin' : 'attached', now);
    }
    const created = await this.ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, {
      id: randomUUID(),
      org_id: board.org_id,
      factory_project_id: board.factory_project_id,
      work_item_id: work.id,
      triage_type: null,
      accepted_at: null,
      autonomy_armed_at: null,
      plans_preapproved_at: null,
      board: target,
      parent_board_item_id: null,
      stages: [stage],
      stage_history: [{ stage, enteredAt: now.toISOString(), by }],
      sessions: {},
      metadata: null,
      revision: 1,
      created_by: by,
      created_at: now,
      updated_at: now,
      migrated_from_updated_at: null,
      migrated_from_hash: null,
      changed_at: now,
    });
    const [row] = await this.#join([created]);
    return row ? { row } : null;
  }

  /** Every work item reading this card's origin source (the card's own first), or just the card's. */
  async #originSiblings(card: WorkItemDbRow): Promise<string[]> {
    const own = card.work_item!.id;
    const origin = card.work_item_sources?.find(source => source.role !== 'attached');
    const stored = origin && (await this.ops.findOne<WorkItemSourceDbRecord>(SOURCES, { id: origin.id }));
    if (!stored) return [own];
    const linked = (await linkedItems(this.ops, [stored])).get(stored.id)!.map(link => link.workItemId);
    return [own, ...linked.filter(id => id !== own)];
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
      // The cards sharing its sources first, in id order, as every write sharing a source takes
      // them; locking its own row first could deadlock against a sync locking a lower sibling.
      await lockSourceGroup(this.ops, [board.work_item_id]);
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
      // Sources before work item rows, the order writes sharing a source take them in.
      const read = (await sourcesForItems(this.ops, [board.work_item_id])).get(board.work_item_id) ?? [];
      for (const { id } of [...read].sort((x, y) => x.id.localeCompare(y.id))) {
        const stored = await this.ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id }, () => null);
        // Other cards of the issue keep it; the last one out deletes it.
        if (stored) await unlinkSource(this.ops, stored, board.work_item_id);
      }
      await this.ops.updateAtomic(WORK_ITEMS, { ...scope, id: board.work_item_id }, () => null);
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
