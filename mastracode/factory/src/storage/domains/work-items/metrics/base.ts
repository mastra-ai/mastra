/**
 * Vocabulary shared by the Overview aggregations: how a stage history is read,
 * which stages count as pipeline work, and the day math every window uses.
 */

import { FACTORY_RULE_STAGES } from '../../../../rules/types.js';
import type { WorkItemRow, WorkItemStageEntry } from '../base.js';

export const DAY_MS = 86_400_000;

/** Terminal stage — items here count as completed, not in-flight. */
export const DONE_STAGE = 'done';

/** Terminal stage for tracked non-completions — never a completion. */
export const CANCELED_STAGE = 'canceled';

/**
 * Terminal stages — items holding only these are not in-flight. `done` is a
 * completion (feeds throughput/lead time); `canceled` is a tracked
 * non-completion outcome and feeds neither.
 */
export const TERMINAL_STAGES = new Set([DONE_STAGE, CANCELED_STAGE]);

export const INTAKE_STAGE = 'intake';

/** Half-open window, `[windowStart, windowEnd)`. */
export interface Window {
  windowStart: number;
  windowEnd: number;
}

/**
 * Pipeline work excludes the inbox as well as the terminal stages: an intake
 * card is queued, not in flight, and its pass through is the poller filing it.
 */
export function isPipelineStage(stage: string): boolean {
  return !TERMINAL_STAGES.has(stage) && stage !== INTAKE_STAGE;
}

/**
 * The funnel's axis: the pipeline in board order, capped by `done`. A card sits
 * at the furthest gate it ever entered, so one that skipped a stage still
 * counts as having got past it and the band can only ever narrow.
 */
export const FUNNEL_GATES: string[] = [...FACTORY_RULE_STAGES.filter(isPipelineStage), DONE_STAGE];

/**
 * The review board's cards. Every integration files a pull request under the
 * `pull-request` type, and the browser splits its boards on the same field.
 */
export function isReviewThread(item: WorkItemRow): boolean {
  return item.externalSource?.type === 'pull-request';
}

/**
 * The two boards a card can be counted on. A pull request opened for a card of
 * the Factory's own belongs to neither: it is that card's output, and giving it
 * a line of its own reports one delivery twice.
 */
export function splitBoards(items: WorkItemRow[]): { work: WorkItemRow[]; review: WorkItemRow[] } {
  const work: WorkItemRow[] = [];
  const review: WorkItemRow[] = [];
  for (const item of items) {
    if (!isReviewThread(item)) work.push(item);
    else if (item.parentWorkItemId === null) review.push(item);
  }
  return { work, review };
}

/**
 * Cards the Factory ran: starting a run records its session on the row. The
 * integrations sync every issue and PR of a connected repo into the board and
 * those outnumber the Factory's own work by an order of magnitude, so counting
 * them reports the upstream repo's flow as the Factory's.
 */
export function hasFactoryRun(item: WorkItemRow): boolean {
  return Object.keys(item.sessions).length > 0;
}

/** Stage history is server-appended, so an unparsable stamp is a corrupt row. */
export function parseTime(iso: string): number {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) throw new Error(`Unparsable stage-history timestamp: ${iso}`);
  return time;
}

/** Time an entry held the card; a visit still open counted up to `until`. */
export function dwellMs(entry: WorkItemStageEntry, until: number): number {
  const exited = entry.exitedAt === undefined ? until : Math.min(parseTime(entry.exitedAt), until);
  return Math.max(0, exited - parseTime(entry.enteredAt));
}

/** Nearest-rank percentile over an unsorted sample list. */
export function percentile(samples: number[], fraction: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(fraction * sorted.length));
  return sorted[rank - 1]!;
}

/** Whole percent of `part` in `whole`, or `null` when there is nothing to divide. */
export function share(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

/** UTC `YYYY-MM-DD` for a timestamp. */
export function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function utcDayStart(time: number): number {
  return Date.parse(`${utcDay(time)}T00:00:00Z`);
}

/** Stages the item was holding at `time`, replayed from its history. */
export function stagesHeldAt(item: WorkItemRow, time: number): Set<string> {
  const held = new Set<string>();
  for (const entry of item.stageHistory) {
    if (parseTime(entry.enteredAt) >= time) continue;
    if (entry.exitedAt !== undefined && parseTime(entry.exitedAt) <= time) continue;
    held.add(entry.stage);
  }
  return held;
}

/**
 * Index of the gate a card moved back to, or `-1` if it only ever moved
 * forward. One definition of a send-back for the whole page: the funnel prices
 * the redo from here, the rework rate counts the cards that have one, and the
 * browser reads it off the wire rows to explain why a card needs a person.
 * Typed against what it reads so both row shapes satisfy it.
 */
export function sentBackAt(item: { stageHistory: readonly { stage: string }[] }): number {
  let deepest = -1;
  for (const [index, entry] of item.stageHistory.entries()) {
    const gate = FUNNEL_GATES.indexOf(entry.stage);
    if (gate === -1) continue;
    if (gate < deepest) return index;
    deepest = gate;
  }
  return -1;
}
