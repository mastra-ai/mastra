/**
 * Client-side aggregation for the Overview page's queue-health chart.
 *
 * Pure, DB-free functions over `work_items` rows — mirrors the discipline of
 * the server-side `computeFactoryMetrics`, but runs in the UI because the chart
 * ages every card against "now" on each poll. This module takes all inputs and
 * returns a plain shape, so it is unit-testable without a network or DOM.
 */

import type { QueueHealthConfig } from '@mastra/factory/storage/domains/queue-health/base';
import type { WorkItem, WorkItemStageEntry } from './services/workItems';
import { PIPELINE_STAGES } from './stages';

/**
 * The row shape the aggregation reads. The client list endpoint serializes
 * `createdAt` to an ISO string, but accepting a `Date` too keeps the function
 * usable from server-shaped rows without a mapping layer. Everything else
 * matches the wire `WorkItem`.
 */
export type QueueHealthWorkItem = Omit<WorkItem, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

/**
 * Terminal stages — items here are completed or canceled, not in the queue.
 * Redefined locally (the server set in `factory/metrics.ts`) rather than
 * imported from the UI `stages.ts`, which is explicitly UI-only.
 */
const TERMINAL_STAGES = new Set(['done', 'canceled']);

/** Age-bucket keys, in left→right segment order. */
export const AGE_BUCKETS = ['green', 'amber', 'orange', 'red'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** One drill-down row: a work item's presence in one stage. */
export interface QueueHealthEntry {
  itemId: string;
  title: string;
  url: string | null;
  stage: string;
  ageSeconds: number;
  bucket: AgeBucket;
  active: boolean;
}

/** One bar in the chart: a non-done stage segmented by age bucket. */
export interface QueueHealthStage {
  stage: string;
  total: number;
  buckets: Record<AgeBucket, number>;
  /** Entries in this stage whose item has ≥1 active session. */
  activeCount: number;
}

export interface QueueHealth {
  stages: QueueHealthStage[];
  /** Flat per-(item, stage) index so the drill-down list needs no second fetch. */
  entries: QueueHealthEntry[];
}

function parseTime(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Open (no `exitedAt`) history entries for currently-held non-terminal stages —
 * one per held stage. Replicated from `factory/metrics.ts:openEntries` — that
 * helper is module-private, and this UI-only module must not import server
 * modules.
 */
function openEntries(item: QueueHealthWorkItem): WorkItemStageEntry[] {
  return item.stageHistory.filter(
    entry => entry.exitedAt === undefined && !TERMINAL_STAGES.has(entry.stage) && item.stages.includes(entry.stage),
  );
}

/** The bucket an age falls into: `ageSeconds >= boundary` moves to the higher bucket. */
function bucketFor(ageSeconds: number, thresholdsSeconds: number[]): AgeBucket {
  let index = 0;
  for (const boundary of thresholdsSeconds) {
    if (ageSeconds >= boundary) index += 1;
  }
  return AGE_BUCKETS[Math.min(index, AGE_BUCKETS.length - 1)]!;
}

/**
 * The open entry for the item's *current* visit to `stage`. Re-entering a
 * stage (execute → review → execute) appends a new open entry without closing
 * the earlier one, so multiple open entries can coexist for one stage; the
 * current visit is the latest, so scan from the end. (`Array.prototype.findLast`
 * with an explicit loop keeps the module's ES target simple.)
 */
function latestOpenEntryFor(open: WorkItemStageEntry[], stage: string): WorkItemStageEntry | undefined {
  for (let i = open.length - 1; i >= 0; i--) {
    if (open[i]!.stage === stage) return open[i]!;
  }
  return undefined;
}

/**
 * Cards the Factory ran: starting a run records its session on the row. Mirrors
 * `hasFactoryRun` in `factory/metrics.ts` — the server module this one is the
 * UI half of, and whose population the Overview header reports.
 */
function hasFactoryRun(item: QueueHealthWorkItem): boolean {
  return Object.keys(item.sessions).length > 0;
}

/**
 * Aggregate work items into per-stage age buckets plus an active-work count.
 *
 * Aging is per-(item, stage): an item holding N open stages contributes one
 * entry to each, aged from that stage's own `enteredAt` — so a stage's bar
 * reflects the age of work *currently in that stage* (totals across bars may
 * exceed the unique-item count). A held stage with no open history entry
 * falls back to the item's `createdAt`.
 *
 * Only cards the Factory ran are charted, so the bars sum to the in-flight
 * count above them. Filtering here rather than at the call site keeps the two
 * halves of one screen from drifting apart: the integrations sync every issue
 * and PR of a connected repo into the lanes, and those cards age forever
 * without anyone working them — charting them pins the queue red on the
 * upstream backlog rather than on work that is actually stuck.
 */
export function computeQueueHealth(
  items: QueueHealthWorkItem[],
  activeSessions: ReadonlySet<string>,
  config: QueueHealthConfig,
  now: Date = new Date(),
): QueueHealth {
  const nowMs = now.getTime();
  const thresholds = config.thresholdsSeconds;

  const byStage = new Map<string, QueueHealthStage>();
  for (const stage of PIPELINE_STAGES) {
    byStage.set(stage, { stage, total: 0, buckets: { green: 0, amber: 0, orange: 0, red: 0 }, activeCount: 0 });
  }

  const entries: QueueHealthEntry[] = [];

  for (const item of items) {
    if (!hasFactoryRun(item)) continue;

    const inFlightStages = item.stages.filter(stage => !TERMINAL_STAGES.has(stage));
    if (inFlightStages.length === 0) continue;

    const open = openEntries(item);
    const active = Object.values(item.sessions).some(ref => activeSessions.has(ref.sessionId));

    for (const stage of inFlightStages) {
      const stageAgg = byStage.get(stage);
      if (!stageAgg) continue; // stage not on the board — not charted

      const entry = latestOpenEntryFor(open, stage);
      // Fall back to creation time when history has no open entry for the
      // held stage (mirrors metrics.ts aging fallback; shouldn't happen since
      // history is server-appended).
      const enteredAt =
        entry?.enteredAt ?? (item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt);
      const ageSeconds = Math.max(0, Math.round((nowMs - parseTime(enteredAt)) / 1000));
      const bucket = bucketFor(ageSeconds, thresholds);

      stageAgg.total += 1;
      stageAgg.buckets[bucket] += 1;
      if (active) stageAgg.activeCount += 1;

      entries.push({ itemId: item.id, title: item.title, url: item.url, stage, ageSeconds, bucket, active });
    }
  }

  return { stages: [...byStage.values()], entries };
}
