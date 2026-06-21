import type { OMHistoryRecord } from '../types';
import type { ExtractedOmMarker } from './extract-markers';
import { parseUTC } from './timeline';

export interface ThreadContextWindowState {
  messageTokens?: number;
  messageThreshold?: number;
  memoryTokens?: number;
  memoryThreshold?: number;
}

function getObservationTimestamp(record: OMHistoryRecord): string {
  const d = record.lastObservedAt ?? record.updatedAt;
  return typeof d === 'string' ? d : new Date(d).toISOString();
}

function sortObservationRecords(records: OMHistoryRecord[]) {
  return [...records].sort((a, b) => parseUTC(getObservationTimestamp(a)) - parseUTC(getObservationTimestamp(b)));
}

export function getLatestThreadContextWindowState({
  markers,
  omRecords,
  observationThreshold,
  reflectionThreshold,
}: {
  markers: ExtractedOmMarker[];
  omRecords: OMHistoryRecord[];
  observationThreshold?: number;
  reflectionThreshold?: number;
}): ThreadContextWindowState {
  const latestStatusMarker = [...markers]
    .filter(marker => marker.type === 'status' && (marker.pendingTokens != null || marker.observationTokens != null))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .at(-1);

  const latestObservationRecord = sortObservationRecords(omRecords).at(-1);

  return {
    messageTokens: latestStatusMarker?.pendingTokens ?? latestObservationRecord?.pendingMessageTokens,
    messageThreshold: latestStatusMarker?.observationThreshold ?? observationThreshold,
    memoryTokens: latestStatusMarker?.observationTokens ?? latestObservationRecord?.observationTokenCount,
    memoryThreshold: latestStatusMarker?.reflectionThreshold ?? reflectionThreshold,
  };
}
