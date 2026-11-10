import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionValue, FactoryStorage, FactoryStorageOps } from '@mastra/core/storage';

import { factoryDecisionHash } from '../storage/domains/work-items/base.js';
import type { WorkItemDbRow } from '../storage/domains/work-items/base.js';
import { bumpBoardVersions } from '../storage/domains/work-items/board-version.js';
import type { BoardScope } from '../storage/domains/work-items/board-version.js';
import {
  WORK_ITEMS_SCHEMA,
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA,
  FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA,
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
const LOGGED_SKIPS = 10;
const PROGRESS_LOG_INTERVAL_MS = 10_000;

const fmt = (value: number) => value.toLocaleString('en-US');

/** One line: skips repeat while an older replica keeps writing, so only a sample is named. */
function summaryLine(title: string, report: WorkItemSplitReport): string {
  const counts = [
    `${fmt(report.cards)} cards checked`,
    `${fmt(report.workItems)} copied`,
    `${fmt(report.recopied)} recopied`,
    `${fmt(report.unchanged)} unchanged`,
    `${fmt(report.deferred)} deferred`,
    `${fmt(report.skipped.length)} skipped`,
  ];
  if (report.aborted) counts.push('stopped early');
  let line = `${title}: ${counts.join(', ')}`;
  if (report.skipped.length) {
    const sample = report.skipped
      .slice(0, LOGGED_SKIPS)
      .map(skip => `${skip.id} (${skip.reason.replace(/\s+/g, ' ')})`);
    const more = report.skipped.length - sample.length;
    line += ` — ${sample.join('; ')}${more ? `; and ${fmt(more)} more` : ''}`;
  }
  return line;
}

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
  /** Rows the `include` filter left for a later pass. */
  deferred: number;
  workItems: number;
  sources: number;
  boardItems: number;
  recopied: number;
  unchanged: number;
  skipped: WorkItemSplitSkip[];
  aborted: boolean;
}

function time(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
}

function legacyHash(row: WorkItemDbRow): string {
  const copied = {
    id: row.id,
    org_id: row.org_id,
    factory_project_id: row.factory_project_id,
    board: row.board,
    external_source: row.external_source,
    parent_work_item_id: row.parent_work_item_id,
    title: row.title,
    // Undefined drops out of the JSON, so rows without a description keep their earlier hash.
    description: row.description ?? undefined,
    stages: row.stages,
    stage_history: row.stage_history,
    sessions: row.sessions,
    metadata: row.metadata,
    triage_type: row.triage_type,
    accepted_at: row.accepted_at,
    autonomy_armed_at: row.autonomy_armed_at,
    plans_preapproved_at: row.plans_preapproved_at,
    revision: row.revision,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  // stableJson does not invoke Date.toJSON; normalize before hashing.
  return factoryDecisionHash(JSON.parse(JSON.stringify(copied)));
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
      description: row.description ?? null,
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
          role: 'origin',
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
      board: row.board ?? null,
      parent_board_item_id: row.parent_work_item_id ?? null,
      stages: row.stages,
      stage_history: row.stage_history,
      sessions: row.sessions,
      metadata: metadata.board,
      triage_type: row.triage_type ?? null,
      accepted_at: row.accepted_at ?? null,
      autonomy_armed_at: row.autonomy_armed_at ?? null,
      plans_preapproved_at: row.plans_preapproved_at ?? null,
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
    // Both paths take this card-specific lock before any card rows. A project-wide
    // lock here would invert the row-lock order of parent/child and bulk deletions.
    const guard = await ops.updateAtomic(
      FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name,
      { id: card.boardItem.id },
      () => null,
    );
    if (!guard)
      await ops.insertOne(FACTORY_WORK_ITEM_SPLIT_LOCKS_SCHEMA.name, {
        id: card.boardItem.id,
        org_id: card.boardItem.org_id,
        factory_project_id: card.boardItem.factory_project_id,
      });
    if (await ops.findOne(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, { id: card.boardItem.id })) return false;
    const existing = await ops.findOne<BoardItemDbRecord>(BOARD_ITEMS, { id: card.boardItem.id });
    if (existing) {
      if (existing.migrated_from_hash === card.boardItem.migrated_from_hash) return false;
      throw new MigrationConflict('Migration baseline changed since planning');
    }
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
    return {
      ...card.boardItem,
      revision: Math.max(current.revision, card.boardItem.revision) + 1,
    };
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

export interface LegacyWatermark {
  updatedAt: Date;
  id: string;
}

export interface WorkItemSplitMarker {
  /** Newest legacy row when the finished pass began; null when the legacy table was empty. */
  watermark: LegacyWatermark | null;
  completedAt: Date;
}

const SPLIT_STATE = FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA.name;
const SPLIT_MARKER_ID = 'work_item_split';

/** The newest legacy write, by `(updated_at, id)`; one indexed row. */
export async function readLegacyWatermark(ops: FactoryStorageOps): Promise<LegacyWatermark | null> {
  const [row] = await ops.findMany<WorkItemDbRow>(
    LEGACY,
    {},
    {
      orderBy: [
        ['updated_at', 'desc'],
        ['id', 'desc'],
      ],
      limit: 1,
    },
  );
  return row ? { updatedAt: row.updated_at, id: row.id } : null;
}

export async function readWorkItemSplitMarker(ops: FactoryStorageOps): Promise<WorkItemSplitMarker | null> {
  const row = await ops.findOne<{ legacy_updated_at: Date | null; legacy_id: string | null; completed_at: Date }>(
    SPLIT_STATE,
    { id: SPLIT_MARKER_ID },
  );
  if (!row) return null;
  return {
    watermark: row.legacy_updated_at && row.legacy_id ? { updatedAt: row.legacy_updated_at, id: row.legacy_id } : null,
    completedAt: row.completed_at,
  };
}

/** Marks every legacy row up to `watermark` as copied. */
export async function recordWorkItemSplitComplete(
  ops: FactoryStorageOps,
  watermark: LegacyWatermark | null,
): Promise<void> {
  await ops.upsertOne(SPLIT_STATE, ['id'], {
    id: SPLIT_MARKER_ID,
    legacy_updated_at: watermark?.updatedAt ?? null,
    legacy_id: watermark?.id ?? null,
    completed_at: new Date(),
  });
}

/**
 * Copies legacy cards that have no split rows yet, inside the caller's
 * transaction. Tombstoned cards and cards whose source another card already
 * holds are left alone; the source is checked first because a unique violation
 * would abort the caller's Postgres transaction. Returns the copied ids.
 */
export async function copyLegacyRows(ops: FactoryStorageOps, rows: readonly WorkItemDbRow[]): Promise<string[]> {
  const copied: string[] = [];
  for (const row of rows) {
    let card: WorkItemSplitCard;
    try {
      card = splitLegacyWorkItem(row, { workItemId: randomUUID() });
    } catch {
      continue;
    }
    if (
      card.source &&
      (await ops.findOne(SOURCES, {
        org_id: card.source.org_id,
        factory_project_id: card.source.factory_project_id,
        provider: card.source.provider,
        external_id: card.source.external_id,
      }))
    ) {
      continue;
    }
    try {
      if (await writeCard(ops, card, false)) copied.push(row.id);
    } catch (error) {
      if (!(error instanceof MigrationConflict)) throw error;
    }
  }
  return copied;
}

export interface MigrateWorkItemSplitOptions {
  dryRun?: boolean;
  ops?: FactoryStorageOps;
  /** Receives single-line progress and summary messages. */
  log?: (line: string) => void;
  /** Names the pass in log lines, e.g. `boot pass`. */
  label?: string;
  /** Minimum time between progress lines; a pass shorter than this logs none. */
  progressIntervalMs?: number;
  now?: () => number;
  /** Rows this returns false for are counted as deferred and not looked up. */
  include?: (row: WorkItemDbRow) => boolean | Promise<boolean>;
  /** Scan only legacy rows written after this watermark, in `(updated_at, id)` order. */
  since?: LegacyWatermark | null;
  pageSize?: number;
  /** Checked between cards and pages; an aborted pass reports `aborted`. */
  signal?: AbortSignal;
}

/** Legacy rows are read-only; each card and all its split rows land atomically. */
export async function migrateWorkItemSplit(
  storage: Pick<FactoryStorage, 'ops' | 'withTransaction'>,
  {
    dryRun = false,
    ops = storage.ops,
    log,
    include,
    since,
    pageSize = PAGE_SIZE,
    signal,
    label,
    progressIntervalMs = PROGRESS_LOG_INTERVAL_MS,
    now = Date.now,
  }: MigrateWorkItemSplitOptions = {},
): Promise<WorkItemSplitReport> {
  const report: WorkItemSplitReport = {
    dryRun,
    projects: 0,
    cards: 0,
    deferred: 0,
    workItems: 0,
    sources: 0,
    boardItems: 0,
    recopied: 0,
    unchanged: 0,
    skipped: [],
    aborted: false,
  };
  const projects = new Set<string>();
  const orderBy: Array<[string, 'asc']> = since
    ? [
        ['updated_at', 'asc'],
        ['id', 'asc'],
      ]
    : [
        ['org_id', 'asc'],
        ['factory_project_id', 'asc'],
        ['created_at', 'asc'],
        ['id', 'asc'],
      ];
  let cursor: CollectionValue[] | undefined = since ? [since.updatedAt, since.id] : undefined;
  const title = `work item split${dryRun ? ' (dry run)' : ''}${label ? ` (${label})` : ''}`;
  let lastProgressAt = now();
  // Counted only once a progress line is due, so a fast pass pays nothing; unknown for a `since` scan.
  let total: number | null | undefined = since ? null : undefined;
  const progress = async () => {
    if (!log || now() - lastProgressAt < progressIntervalMs) return;
    if (total === undefined) total = (await ops.count?.(LEGACY, {})) ?? null;
    lastProgressAt = now();
    const checked = total === null ? fmt(report.cards) : `${fmt(report.cards)}/${fmt(total)}`;
    log(`${title}: ${checked} cards checked, ${fmt(report.workItems)} copied, ${fmt(report.skipped.length)} skipped`);
  };
  while (!signal?.aborted) {
    const page = await ops.findMany<WorkItemDbRow>(
      LEGACY,
      {},
      { orderBy, limit: pageSize, ...(cursor ? { cursor: { values: cursor } } : {}) },
    );
    if (!page.length) break;
    const last = page[page.length - 1]!;
    cursor = since ? [last.updated_at, last.id] : [last.org_id, last.factory_project_id, last.created_at, last.id];
    report.cards += page.length;
    const rows: WorkItemDbRow[] = [];
    for (const row of page) {
      projects.add(`${row.org_id}\u0000${row.factory_project_id}`);
      if (!include || (await include(row))) rows.push(row);
      else report.deferred += 1;
    }
    const written = new Map<string, BoardScope>();
    if (rows.length) {
      const tombstones = await ops.findMany<{ id: string }>(FACTORY_BOARD_ITEM_TOMBSTONES_SCHEMA.name, {
        id: { in: rows.map(row => row.id) },
      });
      const deleted = new Set(tombstones.map(row => row.id));
      report.unchanged += deleted.size;
      const plan = planWorkItemSplit(
        rows.filter(row => !deleted.has(row.id)),
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
        if (signal?.aborted) break;
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
                  ? `Conflicting source: ${error.message}`
                  : error.message;
              report.skipped.push({ id: card.boardItem.id, reason });
            }
            continue;
          }
        }
        await progress();
        report.workItems += 1;
        report.sources += card.source ? 1 : 0;
        report.boardItems += 1;
        if (recopy) report.recopied += 1;
        written.set(`${card.boardItem.org_id}\u0000${card.boardItem.factory_project_id}`, {
          orgId: card.boardItem.org_id,
          factoryProjectId: card.boardItem.factory_project_id,
        });
      }
    }
    // Per page, so cached boards pick up a long pass's cards as they land.
    if (!dryRun && written.size) await bumpBoardVersions(ops, [...written.values()]);
    if (page.length < pageSize) break;
    await progress();
  }
  report.aborted = signal?.aborted ?? false;
  report.projects = projects.size;
  if (log && (report.workItems || report.skipped.length || dryRun)) log(summaryLine(title, report));
  return report;
}
