/**
 * A card is a board item joined to its work item. The work-items domain reads
 * and writes cards in the legacy `work_items` row shape, so the stage, claim,
 * revision and rule logic did not change with the split; this module is where
 * that shape is taken apart into the two tables and put back together.
 *
 * Every write that can touch both tables must run on transaction ops: the work
 * item is read inside the board item's `updateAtomic`, which outside a
 * transaction would hold one Postgres connection and check out a second.
 */

import { randomUUID } from 'node:crypto';

import type { CollectionListOptions, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import { splitCardMetadata, workItemProviderAdapter } from '../../../work-items/providers/index.js';
import type { ExternalWorkItemSource, WorkItemDbRow } from './base.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA,
  WORK_ITEMS_SCHEMA,
} from './work-item-schema.js';
import type { BoardItemDbRecord, WorkItemDbRecord } from './work-item-schema.js';

const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const BOARD_COLUMNS = new Set(Object.keys(FACTORY_BOARD_ITEMS_SCHEMA.columns));
/** Card columns the work item owns; a patch naming any of them re-derives the work item. */
const WORK_ITEM_CARD_COLUMNS = new Set(['external_source', 'source_key', 'title', 'metadata']);
/** Bounded `IN` lists: both backends cap bound parameters per statement. */
const ID_BATCH = 500;

type ProviderColumns = Pick<
  WorkItemDbRecord,
  | 'provider'
  | 'kind'
  | 'integration_id'
  | 'source_type'
  | 'workspace_id'
  | 'external_id'
  | 'source_key'
  | 'url'
  | 'key'
  | 'title'
  | 'state'
  | 'labels'
  | 'author'
  | 'metadata'
>;

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

/** A card's work item columns and the metadata its board item keeps. */
export function splitCard(card: Pick<WorkItemDbRow, 'id' | 'title' | 'external_source' | 'metadata'>): {
  workItem: ProviderColumns;
  boardMetadata: Record<string, unknown> | null;
} {
  const source = card.external_source ?? null;
  const adapter = workItemProviderAdapter(source);
  const item = adapter.toWorkItem(source, card.metadata, { title: card.title, boardItemId: card.id });
  const metadata = splitCardMetadata(card.metadata, adapter.providerMetadataKeys);
  return {
    workItem: {
      provider: item.provider,
      kind: item.kind,
      integration_id: item.integrationId,
      source_type: item.sourceType,
      workspace_id: item.workspaceId,
      external_id: item.externalId,
      source_key: item.sourceKey,
      url: item.url,
      key: item.key,
      title: item.title,
      state: item.state,
      labels: item.labels,
      author: item.author,
      metadata: metadata.provider,
    },
    boardMetadata: metadata.board,
  };
}

/** Split a card into the two rows it is stored as. */
export function splitCardRows(
  card: WorkItemDbRow,
  { workItemId, revision }: { workItemId: string; revision?: number },
): { workItem: WorkItemDbRecord; boardItem: BoardItemDbRecord } {
  const { workItem, boardMetadata } = splitCard(card);
  return {
    workItem: {
      id: workItemId,
      org_id: card.org_id,
      factory_project_id: String(card.factory_project_id),
      ...workItem,
      // Factory's card-to-card link lives on the board item.
      parent_work_item_id: null,
      revision: 1,
      synced_at: null,
      created_at: card.created_at,
      updated_at: card.updated_at,
    },
    boardItem: {
      id: card.id,
      org_id: card.org_id,
      factory_project_id: String(card.factory_project_id),
      work_item_id: workItemId,
      board: card.board ?? null,
      claim_key: card.claim_key ?? null,
      parent_board_item_id: card.parent_work_item_id ?? null,
      stages: card.stages,
      stage_history: card.stage_history,
      sessions: card.sessions,
      metadata: boardMetadata,
      triage_type: card.triage_type ?? null,
      autonomy_armed_at: card.autonomy_armed_at ?? null,
      plans_preapproved_at: card.plans_preapproved_at ?? null,
      accepted_at: card.accepted_at ?? null,
      comment_count: card.comment_count ?? 0,
      feed_activity_at: card.feed_activity_at ?? null,
      revision: revision ?? card.revision,
      created_by: card.created_by,
      created_at: card.created_at,
      updated_at: card.updated_at,
      migrated_from_updated_at: null,
    },
  };
}

function externalSourceOf(item: WorkItemDbRecord): ExternalWorkItemSource | null {
  if (item.source_key === null) return null;
  const prefix = `${item.source_type}:${item.workspace_id ? `${item.workspace_id}:` : ''}`;
  return {
    integrationId: item.integration_id,
    type: item.source_type,
    ...(item.workspace_id ? { workspaceId: item.workspace_id } : {}),
    externalId: item.external_id.startsWith(prefix) ? item.external_id.slice(prefix.length) : item.external_id,
    ...(item.url ? { url: item.url } : {}),
  };
}

function mergeMetadata(
  work: Record<string, unknown> | null,
  board: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!work) return board;
  if (!board) return work;
  return { ...work, ...board };
}

function joinCard(board: BoardItemDbRecord, work: WorkItemDbRecord | null): WorkItemDbRow {
  if (!work) throw new Error(`Board item ${board.id} has no work item ${board.work_item_id}.`);
  return {
    work_item: work,
    id: board.id,
    org_id: board.org_id,
    factory_project_id: board.factory_project_id,
    board: board.board,
    external_source: externalSourceOf(work),
    source_key: work.source_key,
    claim_key: board.claim_key,
    parent_work_item_id: board.parent_board_item_id,
    title: work.title,
    stages: board.stages,
    stage_history: board.stage_history as WorkItemDbRow['stage_history'],
    sessions: board.sessions as WorkItemDbRow['sessions'],
    metadata: mergeMetadata(work.metadata, board.metadata),
    triage_type: board.triage_type,
    autonomy_armed_at: board.autonomy_armed_at,
    plans_preapproved_at: board.plans_preapproved_at,
    accepted_at: board.accepted_at,
    comment_count: board.comment_count,
    feed_activity_at: board.feed_activity_at,
    revision: board.revision,
    created_by: board.created_by,
    created_at: board.created_at,
    updated_at: board.updated_at,
  };
}

/** The board item columns a card patch sets, or a card filter matches on (`id` included). */
function boardColumns(patch: Partial<WorkItemDbRow>, { filter = false } = {}): Partial<BoardItemDbRecord> {
  const columns: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(patch)) {
    if ((column === 'id' && !filter) || column === 'work_item' || WORK_ITEM_CARD_COLUMNS.has(column)) continue;
    if (column === 'parent_work_item_id') columns.parent_board_item_id = value;
    else if (BOARD_COLUMNS.has(column)) columns[column] = value;
    else throw new Error(`[cards] unknown card column '${column}'.`);
  }
  return columns as Partial<BoardItemDbRecord>;
}

/** Cards in the legacy `work_items` row shape, over `factory_board_items` + `factory_work_items`. */
export class Cards {
  constructor(private readonly ops: FactoryStorageOps) {}

  /** Board item filter for a card filter; null when a source key matches no work item. */
  async #where(where: CollectionWhere): Promise<CollectionWhere | null> {
    const { source_key: sourceKey, ...rest } = where;
    const boardWhere = boardColumns(rest as Partial<WorkItemDbRow>, { filter: true }) as CollectionWhere;
    if (sourceKey === undefined) return boardWhere;
    const scope: CollectionWhere = {};
    if (rest.org_id !== undefined) scope.org_id = rest.org_id;
    if (rest.factory_project_id !== undefined) scope.factory_project_id = rest.factory_project_id;
    const items = await this.ops.findMany<WorkItemDbRecord>(WORK_ITEMS, { ...scope, source_key: sourceKey });
    if (items.length === 0) return null;
    return { ...boardWhere, work_item_id: { in: items.map(item => item.id) } };
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
    return boards.map(board => joinCard(board, items.get(board.work_item_id) ?? null));
  }

  async findOne(where: CollectionWhere): Promise<WorkItemDbRow | null> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.findOne(WORK_ITEMS_SCHEMA.name, where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    const board = await this.ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    return board ? (await this.#join([board]))[0]! : null;
  }

  async findMany(where: CollectionWhere, options?: CollectionListOptions): Promise<WorkItemDbRow[]> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.findMany(WORK_ITEMS_SCHEMA.name, where, options);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return [];
    return this.#join(await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, options));
  }

  /** Insert a card. Needs transaction ops: it writes both tables. */
  async insertOne(card: CardInsert): Promise<WorkItemDbRow> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.insertOne<WorkItemDbRow>(WORK_ITEMS_SCHEMA.name, card);
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
    const workItem = await this.ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, rows.workItem);
    const boardItem = await this.ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, rows.boardItem);
    return joinCard(boardItem, workItem);
  }

  /**
   * `updateAtomic` over a card: the board item row is locked, the updater sees
   * the joined card, and a patch to work item columns re-derives the work item.
   * Needs transaction ops.
   */
  async updateAtomic(
    where: CollectionWhere,
    updater: (card: WorkItemDbRow) => Partial<WorkItemDbRow> | null | Promise<Partial<WorkItemDbRow> | null>,
  ): Promise<WorkItemDbRow | null> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.updateAtomic(WORK_ITEMS_SCHEMA.name, where, updater);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return null;
    let workPatch: Partial<WorkItemDbRecord> | null = null;
    const board = await this.ops.updateAtomic<BoardItemDbRecord>(BOARD_ITEMS, boardWhere, async row => {
      const work = await this.ops.findOne<WorkItemDbRecord>(WORK_ITEMS, { id: row.work_item_id });
      const current = joinCard(row, work);
      const patch = await updater(current);
      if (patch === null) return null;
      const columns = boardColumns(patch);
      if (Object.keys(patch).some(column => WORK_ITEM_CARD_COLUMNS.has(column))) {
        const { workItem, boardMetadata } = splitCard({ ...current, ...patch });
        const previous = splitCard(current).workItem;
        const changed: Partial<WorkItemDbRecord> = {};
        for (const [key, value] of Object.entries(workItem)) {
          if (JSON.stringify(value) !== JSON.stringify(previous[key as keyof ProviderColumns])) changed[key] = value;
        }
        if (Object.keys(changed).length > 0) {
          workPatch = { ...changed, updated_at: patch.updated_at ?? new Date() };
        }
        columns.metadata = boardMetadata;
      }
      return columns;
    });
    if (!board) return null;
    if (workPatch) {
      await this.ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: board.work_item_id }, current => ({
        ...workPatch,
        revision: current.revision + 1,
      }));
    }
    return (await this.#join([board]))[0]!;
  }

  /** Set board item columns on every matching card. */
  async updateMany(where: CollectionWhere, patch: Partial<WorkItemDbRow>): Promise<number> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.updateMany(WORK_ITEMS_SCHEMA.name, where, patch);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return 0;
    return this.ops.updateMany(BOARD_ITEMS, boardWhere, boardColumns(patch));
  }

  /**
   * Delete matching cards and remember their ids without changing frozen legacy rows.
   * Needs transaction ops.
   */
  async deleteMany(where: CollectionWhere): Promise<number> {
    if (process.env.MASTRA_FACTORY_WORK_ITEM_SPLIT === 'dry-run')
      return this.ops.deleteMany(WORK_ITEMS_SCHEMA.name, where);
    const boardWhere = await this.#where(where);
    if (!boardWhere) return 0;
    const boards = await this.ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, boardWhere);
    if (boards.length === 0) return 0;
    // Per project, so the deletes name the board they change.
    const projects = new Map<string, BoardItemDbRecord[]>();
    for (const board of boards) {
      const key = `${board.org_id}\u0000${board.factory_project_id}`;
      projects.set(key, [...(projects.get(key) ?? []), board]);
    }
    let deleted = 0;
    for (const rows of projects.values()) {
      const scope = { org_id: rows[0]!.org_id, factory_project_id: rows[0]!.factory_project_id };
      for (let index = 0; index < rows.length; index += ID_BATCH) {
        const page = rows.slice(index, index + ID_BATCH);
        const ids = page.map(board => board.id);
        deleted += await this.ops.deleteMany(BOARD_ITEMS, { ...scope, id: { in: ids } });
        await this.ops.deleteMany(WORK_ITEMS, { ...scope, id: { in: page.map(board => board.work_item_id) } });
        for (const board of page) {
          await this.ops.upsertOne(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, ['id'], { ...scope, id: board.id });
        }
      }
    }
    return deleted;
  }
}
