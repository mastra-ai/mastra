import type { QueueHealth, QueueHealthEntry } from './queue-health';

interface AttentionReason {
  id: string;
  /** Says why this one card is here, read inside its row. */
  label: string;
  /** Names the whole pile, read on a filter. */
  short: string;
  matches: (entry: QueueHealthEntry) => boolean;
}

/**
 * Why a card needs a person, most demanding first. First match wins, so the
 * order is both the classification and the ranking.
 */
export const ATTENTION_REASONS = [
  {
    id: 'sent-back',
    label: 'Came back for another pass',
    short: 'Sent back',
    matches: entry => !entry.active && entry.sentBack,
  },
  {
    id: 'review',
    label: 'Waiting on a reviewer',
    short: 'Needs review',
    matches: entry => !entry.active && entry.stage === 'review',
  },
  { id: 'unclaimed', label: 'Nobody picked it up', short: 'Unclaimed', matches: entry => !entry.active },
  { id: 'running', label: 'Run still going', short: 'Agent running', matches: entry => entry.active },
] as const satisfies readonly AttentionReason[];

export type AttentionReasonId = (typeof ATTENTION_REASONS)[number]['id'];

export interface AttentionRow {
  entry: QueueHealthEntry;
  reason: (typeof ATTENTION_REASONS)[number];
}

/** Fresh cards are moving on their own — waiting is only news once it lasts. */
function reasonOf(entry: QueueHealthEntry): AttentionRow['reason'] | undefined {
  if (entry.bucket === 'green') return undefined;
  return ATTENTION_REASONS.find(reason => reason.matches(entry));
}

/**
 * Every card the board is holding past its first age threshold, most demanding
 * first. A window onto the queue, not a store of its own: no read state, no
 * dismissal, so the count can never drift from what the board actually holds.
 */
export function attentionRows(health: QueueHealth): AttentionRow[] {
  return health.entries
    .flatMap(entry => {
      const reason = reasonOf(entry);
      return reason ? [{ entry, reason }] : [];
    })
    .sort(
      (a, b) =>
        ATTENTION_REASONS.indexOf(a.reason) - ATTENTION_REASONS.indexOf(b.reason) ||
        b.entry.ageSeconds - a.entry.ageSeconds,
    );
}

/** A run in progress is the board working, not the board waiting — it never counts as a notification. */
export function needsPerson(row: AttentionRow): boolean {
  return row.reason.id !== 'running';
}
