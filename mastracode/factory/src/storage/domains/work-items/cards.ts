import { randomUUID } from 'node:crypto';

import type { CollectionListOptions, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import { splitLegacyWorkItem } from '../../../work-items/split-migration.js';
import type { ExternalWorkItemSource, WorkItemDbRow } from './base.js';
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
const RETIRED_COLUMNS = new Set(['claim_key', 'triage_type', 'accepted_at', 'plans_preapproved_at']);
const PROJECTED_COLUMNS = new Set([
  'work_item',
  'work_item_sources',
  'external_source',
  'source_key',
  'title',
  'comment_count',
  'feed_activity_at',
]);
const ID_BATCH = 500;

export type CardInsert = Pick<
  WorkItemDbRow,
  | 'org_id'
  | 'factory_project_id'
  | 'board'
  | 'external_source'
  | 'source_key'
  | 'claim_key'
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
>;

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

function joinCard(
  board: BoardItemDbRecord,
  work: WorkItemDbRecord | null,
  sources: WorkItemSourceDbRecord[],
): WorkItemDbRow {
  if (!work) throw new Error(`Board item ${board.id} has no work item ${board.work_item_id}.`);
  const source = sources[0];
  const armedAt = board.metadata?.autonomyArmedAt;
  return {
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
    stages: board.stages,
    stage_history: board.stage_history as WorkItemDbRow['stage_history'],
    sessions: board.sessions as WorkItemDbRow['sessions'],
    metadata: board.metadata || source?.metadata ? { ...board.metadata, ...source?.metadata } : null,
    triage_type: null,
    autonomy_armed_at: typeof armedAt === 'string' ? new Date(armedAt) : null,
    plans_preapproved_at: null,
    accepted_at: null,
    comment_count: 0,
    feed_activity_at: null,
    revision: board.revision,
    created_by: board.created_by,
    created_at: board.created_at,
    updated_at: board.updated_at,
  };
}

function boardColumns(patch: Partial<WorkItemDbRow>, { filter = false } = {}): Partial<BoardItemDbRecord> {
  const columns: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(patch)) {
    if (
      (column === 'id' && !filter) ||
      PROJECTED_COLUMNS.has(column) ||
      RETIRED_COLUMNS.has(column) ||
      column === 'autonomy_armed_at'
    )
      continue;
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
  ) {}

  async #where(where: CollectionWhere): Promise<CollectionWhere | null> {
    const { source_key: sourceKey, claim_key: claimKey, ...rest } = where;
    if (claimKey !== undefined && claimKey !== null) return null;
    const boardWhere = boardColumns(rest as Partial<WorkItemDbRow>, { filter: true }) as CollectionWhere;
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
    const cards = boards.map(board =>
      joinCard(board, items.get(board.work_item_id) ?? null, sources.get(board.work_item_id) ?? []),
    );
    // Batch by project and card ids, including tombstones so edits/deletes advance the feed clock.
    const projects = new Map<string, WorkItemDbRow[]>();
    for (const card of cards) {
      const key = `${card.org_id}\0${card.factory_project_id}`;
      const group = projects.get(key) ?? [];
      group.push(card);
      projects.set(key, group);
    }
    for (const group of projects.values()) {
      const byId = new Map(group.map(card => [card.id, card]));
      for (let index = 0; index < group.length; index += ID_BATCH) {
        const comments = await this.ops.findMany<
          { work_item_id: string; deleted_at: Date | null; updated_at: Date } & Record<string, unknown>
        >('work_item_comments', {
          org_id: group[0]!.org_id,
          factory_project_id: group[0]!.factory_project_id,
          work_item_id: { in: group.slice(index, index + ID_BATCH).map(card => card.id) },
        });
        for (const comment of comments) {
          const card = byId.get(comment.work_item_id)!;
          if (!comment.deleted_at) card.comment_count += 1;
          if (!card.feed_activity_at || comment.updated_at > card.feed_activity_at)
            card.feed_activity_at = comment.updated_at;
        }
      }
    }
    return cards;
  }

  async findOne(where: CollectionWhere): Promise<WorkItemDbRow | null> {
    if (this.legacyMode) return this.ops.findOne(WORK_ITEMS_SCHEMA.name, where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    return board ? (await this.#join([board]))[0]! : null;
  }

  async findMany(where: CollectionWhere, options?: CollectionListOptions): Promise<WorkItemDbRow[]> {
    if (this.legacyMode) return this.ops.findMany(WORK_ITEMS_SCHEMA.name, where, options);
    const boardWhere = await this.#where(where);
    return boardWhere ? this.#join(await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, options)) : [];
  }

  async insertOne(card: CardInsert): Promise<WorkItemDbRow> {
    if (this.legacyMode) return this.ops.insertOne<WorkItemDbRow>(WORK_ITEMS_SCHEMA.name, card);
    const rows = splitCardRows(
      {
        triage_type: null,
        autonomy_armed_at: null,
        plans_preapproved_at: null,
        accepted_at: null,
        comment_count: 0,
        feed_activity_at: null,
        ...card,
        id: randomUUID(),
      },
      { workItemId: randomUUID() },
    );
    const work = await this.ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, rows.workItem);
    if (rows.source) await this.ops.insertOne(SOURCES, rows.source);
    const board = await this.ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, rows.boardItem);
    return joinCard(board, work, rows.source ? [rows.source] : []);
  }

  async updateAtomic(
    where: CollectionWhere,
    updater: (card: WorkItemDbRow) => Partial<WorkItemDbRow> | null | Promise<Partial<WorkItemDbRow> | null>,
  ): Promise<WorkItemDbRow | null> {
    if (this.legacyMode) return this.ops.updateAtomic(WORK_ITEMS_SCHEMA.name, where, updater);
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
      if (patch.metadata !== undefined || patch.autonomy_armed_at !== undefined) {
        const next = { ...current, ...patch };
        const split = splitCardRows(next, { workItemId: row.work_item_id });
        columns.metadata = split.boardItem.metadata;
        if (patch.autonomy_armed_at === null && columns.metadata) delete columns.metadata.autonomyArmedAt;
      }
      if (patch.title !== undefined && patch.title !== current.title) {
        await this.ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: row.work_item_id }, work => ({
          title: patch.title,
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
        } else if (next) await this.ops.insertOne(SOURCES, next);
        else if (previous) await this.ops.deleteMany(SOURCES, { id: previous.id });
      }
      const boardChanged = Object.entries(columns).some(
        ([key, value]) =>
          !['revision', 'updated_at'].includes(key) && JSON.stringify(row[key]) !== JSON.stringify(value),
      );
      if (!boardChanged) return null;
      return { ...columns, revision: row.revision + 1, updated_at: patch.updated_at ?? new Date() };
    });
    return board ? (await this.#join([board]))[0]! : null;
  }

  async updateMany(where: CollectionWhere, patch: Partial<WorkItemDbRow>): Promise<number> {
    if (this.legacyMode) return this.ops.updateMany(WORK_ITEMS_SCHEMA.name, where, patch);
    const boards = await this.findMany(where);
    for (const board of boards) await this.updateAtomic({ id: board.id }, () => patch);
    return boards.length;
  }

  async deleteMany(where: CollectionWhere): Promise<number> {
    if (this.legacyMode) return this.ops.deleteMany(WORK_ITEMS_SCHEMA.name, where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return 0;
    const boards = await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, { orderBy: [['id', 'asc']] });
    for (const board of boards) {
      const scope = { org_id: board.org_id, factory_project_id: board.factory_project_id };
      const guard = await this.ops.updateAtomic(
        FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name,
        { id: board.id },
        () => null,
      );
      if (!guard) await this.ops.insertOne(FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name, { ...scope, id: board.id });
      const locked = await this.ops.updateAtomic(BOARD_ITEMS, { ...scope, id: board.id }, () => null);
      if (!locked) continue;
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
      await this.ops.upsertOne(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, ['id'], { ...scope, id: board.id });
    }
    return boards.length;
  }
}
