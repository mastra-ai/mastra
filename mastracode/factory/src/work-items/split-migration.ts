import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorage, FactoryStorageOps } from '@mastra/core/storage';

import { factoryDecisionHash, WORK_ITEMS_SCHEMA } from '../storage/domains/work-items/base.js';
import type { WorkItemDbRow } from '../storage/domains/work-items/base.js';
import { bumpBoardVersions } from '../storage/domains/work-items/board-version.js';
import type { BoardScope } from '../storage/domains/work-items/board-version.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
} from '../storage/domains/work-items/work-item-schema.js';
import type {
  BoardItemDbRecord,
  WorkItemDbRecord,
  WorkItemSourceDbRecord,
} from '../storage/domains/work-items/work-item-schema.js';
import { splitCardMetadata, workItemProviderAdapter } from './providers/index.js';

const LEGACY = WORK_ITEMS_SCHEMA.name;
const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;
const BOARD_ITEMS = FACTORY_BOARD_ITEMS_SCHEMA.name;
const PAGE_SIZE = 200;

export interface MigratedBoardItem {
  workItemId: string;
  revision: number;
  updatedAt: Date;
  migratedFromUpdatedAt: Date | null;
  migratedFromHash: string | null;
}

export interface WorkItemSplitCard {
  /** Fingerprint observed when planning; rejects a stale migration plan under the row lock. */
  previousHash?: string | null;
  workItem: WorkItemDbRecord;
  source: WorkItemSourceDbRecord | null;
  boardItem: BoardItemDbRecord;
}

export interface WorkItemSplitSkip {
  id: string;
  reason: string;
}

export interface WorkItemSplitPlan {
  inserts: WorkItemSplitCard[];
  recopies: WorkItemSplitCard[];
  unchanged: number;
  skipped: WorkItemSplitSkip[];
}

export interface WorkItemSplitReport {
  dryRun: boolean;
  projects: number;
  cards: number;
  workItems: number;
  sources: number;
  boardItems: number;
  recopied: number;
  unchanged: number;
  skipped: WorkItemSplitSkip[];
}

function time(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
}

function legacyHash(row: WorkItemDbRow): string {
  // stableJson does not invoke Date.toJSON; normalize before hashing.
  return factoryDecisionHash(JSON.parse(JSON.stringify(row)));
}

export function splitLegacyWorkItem(
  row: WorkItemDbRow,
  { workItemId, revision }: { workItemId: string; revision?: number },
): WorkItemSplitCard {
  const adapter = workItemProviderAdapter(row.external_source ?? null);
  const provider = adapter.toSource(row.external_source ?? null, row.metadata);
  const metadata = splitCardMetadata(row.metadata, adapter.providerMetadataKeys);
  return {
    workItem: {
      id: workItemId,
      org_id: row.org_id,
      factory_project_id: String(row.factory_project_id),
      title: row.title,
      parent_work_item_id: null,
      revision: 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    source: provider
      ? {
          id: workItemId,
          org_id: row.org_id,
          factory_project_id: String(row.factory_project_id),
          work_item_id: workItemId,
          provider: provider.provider,
          integration_id: provider.integrationId,
          source_type: provider.sourceType,
          workspace_id: provider.workspaceId,
          external_id: provider.externalId,
          source_key: provider.sourceKey,
          url: provider.url,
          key: provider.key,
          state: provider.state,
          labels: provider.labels,
          author: provider.author,
          metadata: metadata.provider,
          revision: 1,
          synced_at: null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }
      : null,
    boardItem: {
      id: row.id,
      org_id: row.org_id,
      factory_project_id: String(row.factory_project_id),
      work_item_id: workItemId,
      claim_key: row.claim_key ?? null,
      board: row.board ?? null,
      parent_board_item_id: row.parent_work_item_id ?? null,
      stages: row.stages,
      stage_history: row.stage_history,
      sessions: row.sessions,
      metadata: {
        ...metadata.board,
        ...(row.autonomy_armed_at ? { autonomyArmedAt: new Date(row.autonomy_armed_at).toISOString() } : {}),
      },
      revision: revision ?? row.revision,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      migrated_from_updated_at: row.updated_at,
      migrated_from_hash: legacyHash(row),
    },
  };
}

export function planWorkItemSplit(
  rows: readonly WorkItemDbRow[],
  migrated: ReadonlyMap<string, MigratedBoardItem> = new Map(),
  newId: () => string = randomUUID,
): WorkItemSplitPlan {
  const plan: WorkItemSplitPlan = { inserts: [], recopies: [], unchanged: 0, skipped: [] };
  for (const row of rows) {
    const existing = migrated.get(row.id);
    if (existing?.migratedFromHash === legacyHash(row)) {
      plan.unchanged += 1;
      continue;
    }
    if (existing && time(existing.updatedAt) > time(existing.migratedFromUpdatedAt)) {
      plan.skipped.push({ id: row.id, reason: 'Split board item changed after migration' });
      continue;
    }
    try {
      const card = splitLegacyWorkItem(row, {
        workItemId: existing?.workItemId ?? newId(),
        ...(existing ? { revision: Math.max(existing.revision, row.revision) + 1 } : {}),
      });
      if (existing) card.previousHash = existing.migratedFromHash;
      (existing ? plan.recopies : plan.inserts).push(card);
    } catch (error) {
      plan.skipped.push({ id: row.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return plan;
}

async function migratedBoardItems(
  ops: FactoryStorageOps,
  ids: readonly string[],
): Promise<Map<string, MigratedBoardItem>> {
  if (!ids.length) return new Map();
  const rows = await ops.findMany<BoardItemDbRecord>(BOARD_ITEMS, { id: { in: [...ids] } });
  return new Map(
    rows.map(row => [
      row.id,
      {
        workItemId: row.work_item_id,
        revision: row.revision,
        updatedAt: row.updated_at,
        migratedFromUpdatedAt: row.migrated_from_updated_at,
        migratedFromHash: row.migrated_from_hash,
      },
    ]),
  );
}

class MigrationConflict extends Error {}

async function writeCard(ops: FactoryStorageOps, card: WorkItemSplitCard, recopy: boolean): Promise<boolean> {
  if (!recopy) {
    await ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, card.workItem);
    if (card.source) await ops.insertOne<WorkItemSourceDbRecord>(SOURCES, card.source);
    await ops.insertOne<BoardItemDbRecord>(BOARD_ITEMS, card.boardItem);
    return true;
  }
  // updateAtomic locks the board row until this transaction commits, so a new
  // transition cannot land between the overwrite guard and the copy.
  let unchanged = false;
  let baseline = Number.NEGATIVE_INFINITY;
  const board = await ops.updateAtomic<BoardItemDbRecord>(BOARD_ITEMS, { id: card.boardItem.id }, current => {
    if (current.migrated_from_hash === card.boardItem.migrated_from_hash) {
      unchanged = true;
      return null;
    }
    if (current.migrated_from_hash !== card.previousHash) {
      throw new MigrationConflict('Migration baseline changed since planning');
    }
    if (time(current.updated_at) > time(current.migrated_from_updated_at)) {
      throw new MigrationConflict('Split board item changed after migration');
    }
    baseline = time(current.migrated_from_updated_at);
    return { ...card.boardItem, revision: Math.max(current.revision, card.boardItem.revision) + 1 };
  });
  if (unchanged) return false;
  if (!board) throw new MigrationConflict('Split board item disappeared during migration');
  await ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: card.workItem.id }, current => {
    if (time(current.updated_at) > baseline) {
      throw new MigrationConflict('Split work item changed after migration');
    }
    return { ...card.workItem, revision: current.revision + 1 };
  });
  const sources = await ops.findMany<WorkItemSourceDbRecord>(SOURCES, { work_item_id: card.workItem.id });
  if (sources.some(source => source.id !== card.workItem.id)) {
    throw new MigrationConflict('Split source set changed after migration');
  }
  for (const source of sources) {
    await ops.updateAtomic<WorkItemSourceDbRecord>(SOURCES, { id: source.id }, current => {
      if (current.synced_at != null || time(current.updated_at) > baseline) {
        throw new MigrationConflict('Split source changed after migration');
      }
      return null;
    });
  }
  if (sources.length) await ops.deleteMany(SOURCES, { id: { in: sources.map(source => source.id) } });
  if (card.source) await ops.insertOne<WorkItemSourceDbRecord>(SOURCES, card.source);
  return true;
}

export interface MigrateWorkItemSplitOptions {
  dryRun?: boolean;
  ops?: FactoryStorageOps;
  log?: (message: string, details?: Record<string, unknown>) => void;
}

/** Legacy rows are read-only; each card and all its split rows land atomically. */
export async function migrateWorkItemSplit(
  storage: Pick<FactoryStorage, 'ops' | 'withTransaction'>,
  { dryRun = false, ops = storage.ops, log }: MigrateWorkItemSplitOptions = {},
): Promise<WorkItemSplitReport> {
  const report: WorkItemSplitReport = {
    dryRun,
    projects: 0,
    cards: 0,
    workItems: 0,
    sources: 0,
    boardItems: 0,
    recopied: 0,
    unchanged: 0,
    skipped: [],
  };
  const projects = new Set<string>();
  const written = new Map<string, BoardScope>();
  // Recopy released claims before their new owners, even across pages/projects.
  // Each transaction touches only its own card; no cross-card claim locks.
  for (const claimed of [false, true]) {
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
      if (!page.length) break;
      cursor = page[page.length - 1];
      const rows = page.filter(row => Boolean(row.claim_key) === claimed);
      report.cards += rows.length;
      for (const row of rows) projects.add(`${row.org_id}\u0000${row.factory_project_id}`);
      const plan = planWorkItemSplit(
        rows,
        await migratedBoardItems(
          ops,
          rows.map(row => row.id),
        ),
      );
      report.unchanged += plan.unchanged;
      report.skipped.push(...plan.skipped);
      for (const { card, recopy } of [
        ...plan.inserts.map(card => ({ card, recopy: false })),
        ...plan.recopies.map(card => ({ card, recopy: true })),
      ]) {
        if (!dryRun) {
          try {
            const changed = await storage.withTransaction(tx => writeCard(tx, card, recopy));
            if (!changed) {
              report.unchanged += 1;
              continue;
            }
          } catch (error) {
            if (!(error instanceof UniqueViolationError) && !(error instanceof MigrationConflict)) throw error;
            const raced = (await migratedBoardItems(ops, [card.boardItem.id])).get(card.boardItem.id);
            if (raced?.migratedFromHash === card.boardItem.migrated_from_hash) report.unchanged += 1;
            else {
              const reason =
                error instanceof UniqueViolationError &&
                (error.collection === SOURCES || error.collection === BOARD_ITEMS)
                  ? `Conflicting source or claim: ${error.message}`
                  : error.message;
              report.skipped.push({ id: card.boardItem.id, reason });
            }
            continue;
          }
        }
        report.workItems += 1;
        report.sources += card.source ? 1 : 0;
        report.boardItems += 1;
        if (recopy) report.recopied += 1;
        written.set(`${card.boardItem.org_id}\u0000${card.boardItem.factory_project_id}`, {
          orgId: card.boardItem.org_id,
          factoryProjectId: card.boardItem.factory_project_id,
        });
      }
      if (page.length < PAGE_SIZE) break;
    }
  }
  report.projects = projects.size;
  if (!dryRun && written.size) await bumpBoardVersions(ops, [...written.values()]);
  if (report.workItems || report.skipped.length || dryRun) {
    log?.(dryRun ? 'Factory work item split (dry run)' : 'Factory work item split', { ...report });
  }
  return report;
}
