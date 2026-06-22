import type { OMHistoryRecord } from '../types';
import type { TDomain } from './timeline';
import { parseUTC, tToTimestamp } from './timeline';

/** Converts a normalized timeline coordinate (0–1) into an epoch ms cursor. */
export function tToTimestampMs(t: number, domain: TDomain): number {
  return tToTimestamp(t, domain).getTime();
}

function getObservationTimestamp(record: OMHistoryRecord): string {
  const d = record.lastObservedAt ?? record.updatedAt;
  return typeof d === 'string' ? d : new Date(d).toISOString();
}

/**
 * Returns the id of the OM record whose observation time is at or just before
 * the replay cursor (ms epoch). Returns null when there is no such record.
 */
export function findRecordIdAtOrBefore(records: OMHistoryRecord[], cursorMs: number | null): string | null {
  if (cursorMs == null || records.length === 0) return null;

  const sorted = records
    .map(record => ({ id: record.id, t: parseUTC(getObservationTimestamp(record)) }))
    .toSorted((a, b) => a.t - b.t);

  let matchId: string | null = null;
  for (const entry of sorted) {
    if (entry.t <= cursorMs) {
      matchId = entry.id;
    } else {
      break;
    }
  }

  return matchId;
}
