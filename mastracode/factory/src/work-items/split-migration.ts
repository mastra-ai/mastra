/**
 * One-time cutover of legacy `work_items` rows into `factory_work_items` (what
 * the work is) and `factory_board_items` (where it sits in Factory).
 *
 * Each legacy row becomes one work item and one board item. The board item
 * keeps the legacy id, so comments, subscriptions, run bindings and rule state
 * keyed by `work_item_id` keep pointing at the card. The work item gets a new
 * id. The legacy table is only read, never written.
 *
 * The pass is idempotent and runs on every boot: a card already copied is
 * skipped unless its legacy row changed after the copy (`updated_at` newer than
 * the board item's `migrated_from_updated_at`), which is how a rolling deploy
 * picks up cards an older replica created or moved after the first pass. Once
 * no older replica is left the legacy table stops changing and the pass writes
 * nothing.
 */

import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorage, FactoryStorageOps } from '@mastra/core/storage';

import { WORK_ITEMS_SCHEMA } from '../storage/domains/work-items/base.js';
import type { WorkItemDbRow } from '../storage/domains/work-items/base.js';
import { bumpBoardVersions } from '../storage/domains/work-items/board-version.js';
import type { BoardScope } from '../storage/domains/work-items/board-version.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
} from '../storage/domains/work-items/work-item-schema.js';
import type { BoardItemDbRecord, WorkItemDbRecord } from '../storage/domains/work-items/work-item-schema.js';
import { splitCardMetadata, workItemProviderAdapter } from './providers/index.js';

const LEGACY = WORK_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const PAGE_SIZE = 200;

/** What a board item already in the new table says about the legacy row it came from. */
export interface MigratedBoardItem {
  workItemId: string;
  revision: number;
  migratedFromUpdatedAt: Date | null;
}

export interface WorkItemSplitCard {
  workItem: WorkItemDbRecord;
  boardItem: BoardItemDbRecord;
}

export interface WorkItemSplitSkip {
  id: string;
  reason: string;
}

export interface WorkItemSplitPlan {
  /** Cards not in the new tables yet. */
  inserts: WorkItemSplitCard[];
  /** Cards whose legacy row changed after they were copied. */
  recopies: WorkItemSplitCard[];
  /** Cards already copied and unchanged since. */
  unchanged: number;
  skipped: WorkItemSplitSkip[];
}

export interface WorkItemSplitReport {
  dryRun: boolean;
  projects: number;
  cards: number;
  /** Work items written (inserted or re-copied) by this pass. */
  workItems: number;
  /** Board items written (inserted or re-copied) by this pass. */
  boardItems: number;
  recopied: number;
  unchanged: number;
  skipped: WorkItemSplitSkip[];
}

function time(value: Date | string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/** Split one legacy row. Throws when the row cannot be mapped onto a work item. */
export function splitLegacyWorkItem(
  row: WorkItemDbRow,
  { workItemId, revision }: { workItemId: string; revision?: number },
): WorkItemSplitCard {
  const adapter = workItemProviderAdapter(row.external_source ?? null);
  const provider = adapter.toWorkItem(row.external_source ?? null, row.metadata, {
    title: row.title,
    boardItemId: row.id,
  });
  const metadata = splitCardMetadata(row.metadata, adapter.providerMetadataKeys);
  return {
    workItem: {
      id: workItemId,
      org_id: row.org_id,
      factory_project_id: String(row.factory_project_id),
      provider: provider.provider,
      kind: provider.kind,
      integration_id: provider.integrationId,
      source_type: provider.sourceType,
      workspace_id: provider.workspaceId,
      external_id: provider.externalId,
      source_key: provider.sourceKey,
      url: provider.url,
      key: provider.key,
      title: provider.title,
      state: provider.state,
      labels: provider.labels,
      author: provider.author,
      // Factory's card-to-card link moves to the board item; legacy rows record no provider parent.
      parent_work_item_id: null,
      metadata: metadata.provider,
      revision: 1,
      synced_at: null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    boardItem: {
      id: row.id,
      org_id: row.org_id,
      factory_project_id: String(row.factory_project_id),
      work_item_id: workItemId,
      board: row.board ?? null,
      claim_key: row.claim_key ?? null,
      parent_board_item_id: row.parent_work_item_id ?? null,
      stages: row.stages,
      stage_history: row.stage_history,
      sessions: row.sessions,
      metadata: metadata.board,
      triage_type: row.triage_type ?? null,
      autonomy_armed_at: row.autonomy_armed_at ?? null,
      plans_preapproved_at: row.plans_preapproved_at ?? null,
      accepted_at: row.accepted_at ?? null,
      comment_count: row.comment_count ?? 0,
      feed_activity_at: row.feed_activity_at ?? null,
      revision: revision ?? row.revision,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      migrated_from_updated_at: row.updated_at,
    },
  };
}

/**
 * Decide what the pass does with each legacy row, given the board items already
 * copied (by legacy id). Pure apart from minting work item ids.
 */
export function planWorkItemSplit(
  rows: readonly WorkItemDbRow[],
  migrated: ReadonlyMap<string, MigratedBoardItem> = new Map(),
  newId: () => string = randomUUID,
): WorkItemSplitPlan {
  const plan: WorkItemSplitPlan = { inserts: [], recopies: [], unchanged: 0, skipped: [] };
  for (const row of rows) {
    const existing = migrated.get(row.id);
    if (existing && time(row.updated_at) <= time(existing.migratedFromUpdatedAt)) {
      plan.unchanged += 1;
      continue;
    }
    let card: WorkItemSplitCard;
    try {
      card = existing
        ? // A re-copy must still invalidate a revision a newer replica handed out.
          splitLegacyWorkItem(row, {
            workItemId: existing.workItemId,
            revision: Math.max(existing.revision, row.revision) + 1,
          })
        : splitLegacyWorkItem(row, { workItemId: newId() });
    } catch (error) {
      plan.skipped.push({ id: row.id, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }
    (existing ? plan.recopies : plan.inserts).push(card);
  }
  return plan;
}

async function migratedBoardItems(
  ops: FactoryStorageOps,
  ids: readonly string[],
): Promise<Map<string, MigratedBoardItem>> {
  if (ids.length === 0) return new Map();
  const rows = await ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, { id: { in: [...ids] } });
  return new Map(
    rows.map(row => [
      row.id,
      {
        workItemId: row.work_item_id,
        revision: row.revision,
        migratedFromUpdatedAt: row.migrated_from_updated_at,
      },
    ]),
  );
}

async function writeCard(ops: FactoryStorageOps, card: WorkItemSplitCard, recopy: boolean): Promise<void> {
  if (!recopy) {
    await ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, card.workItem);
    await ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, card.boardItem);
    return;
  }
  const { id: workItemId, ...workItem } = card.workItem;
  const { id: boardItemId, ...boardItem } = card.boardItem;
  await ops.updateMany(WORK_ITEMS, { id: workItemId }, workItem);
  await ops.updateMany(BOARD_ITEMS, { id: boardItemId }, boardItem);
}

export interface MigrateWorkItemSplitOptions {
  /** Plan and report only; write nothing. */
  dryRun?: boolean;
  /**
   * The ops to read and write through. Defaults to `storage.ops`; the
   * work-items domain passes its own so the writes bump board versions.
   */
  ops?: FactoryStorageOps;
  log?: (message: string, details?: Record<string, unknown>) => void;
}

/**
 * Copy every legacy card that is missing from, or newer than, the new tables.
 * Each page of cards is written in one transaction; when another replica races
 * the same page, the page falls back to one transaction per card and a card the
 * other replica already wrote counts as unchanged.
 */
export async function migrateWorkItemSplit(
  storage: Pick<FactoryStorage, 'ops' | 'withTransaction'>,
  { dryRun = false, ops = storage.ops, log }: MigrateWorkItemSplitOptions = {},
): Promise<WorkItemSplitReport> {
  const report: WorkItemSplitReport = {
    dryRun,
    projects: 0,
    cards: 0,
    workItems: 0,
    boardItems: 0,
    recopied: 0,
    unchanged: 0,
    skipped: [],
  };
  const projects = new Set<string>();
  const written = new Map<string, BoardScope>();
  let cursor: WorkItemDbRow | undefined;
  while (true) {
    const page = await ops.findMany<WorkItemDbRow>(
      LEGACY,
      {},
      {
        orderBy: [
          ['org_id', 'asc'],
          ['factory_project_id', 'asc'],
          ['created_at', 'asc'],
          ['id', 'asc'],
        ],
        limit: PAGE_SIZE,
        ...(cursor
          ? { cursor: { values: [cursor.org_id, cursor.factory_project_id, cursor.created_at, cursor.id] } }
          : {}),
      },
    );
    if (page.length === 0) break;
    cursor = page[page.length - 1];
    report.cards += page.length;
    for (const row of page) projects.add(`${row.org_id}\u0000${row.factory_project_id}`);

    const plan = planWorkItemSplit(
      page,
      await migratedBoardItems(
        ops,
        page.map(row => row.id),
      ),
    );
    report.unchanged += plan.unchanged;
    report.skipped.push(...plan.skipped);
    const cards = [
      ...plan.inserts.map(card => ({ card, recopy: false })),
      ...plan.recopies.map(card => ({ card, recopy: true })),
    ];
    let landed = cards;
    if (!dryRun && cards.length > 0) {
      try {
        await storage.withTransaction(async tx => {
          for (const { card, recopy } of cards) await writeCard(tx, card, recopy);
        });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        landed = [];
        for (const entry of cards) {
          try {
            await storage.withTransaction(tx => writeCard(tx, entry.card, entry.recopy));
            landed.push(entry);
          } catch (cardError) {
            if (!(cardError instanceof UniqueViolationError)) throw cardError;
            const raced = await migratedBoardItems(ops, [entry.card.boardItem.id]);
            if (!raced.has(entry.card.boardItem.id)) throw cardError;
            report.unchanged += 1;
          }
        }
      }
    }
    for (const { card, recopy } of landed) {
      report.workItems += 1;
      report.boardItems += 1;
      if (recopy) report.recopied += 1;
      written.set(`${card.boardItem.org_id}\u0000${card.boardItem.factory_project_id}`, {
        orgId: card.boardItem.org_id,
        factoryProjectId: card.boardItem.factory_project_id,
      });
    }
    if (page.length < PAGE_SIZE) break;
  }
  report.projects = projects.size;
  if (!dryRun && written.size > 0) await bumpBoardVersions(ops, [...written.values()]);
  if (report.workItems > 0 || report.skipped.length > 0 || dryRun) {
    log?.(dryRun ? 'Factory work item split (dry run)' : 'Factory work item split', {
      projects: report.projects,
      cards: report.cards,
      written: report.boardItems,
      recopied: report.recopied,
      unchanged: report.unchanged,
      skipped: report.skipped,
    });
  }
  return report;
}
