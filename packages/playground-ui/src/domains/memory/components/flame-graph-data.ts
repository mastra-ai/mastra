import type { ExtractedOmMarker } from '../lib/extract-markers';
import type { TDomain } from '../lib/timeline';
import { toT } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';

/**
 * Pure shaping of OM records, stream markers and messages into the series the
 * flame graph charts. Kept apart from the rendering so each series can be
 * reasoned about — and tested — on its own.
 */

export function getObservationTimestamp(record: OMHistoryRecord): string {
  const d = record.lastObservedAt ?? record.updatedAt;
  return typeof d === 'string' ? d : new Date(d).toISOString();
}

export function toContextData(records: OMHistoryRecord[], markers: ExtractedOmMarker[], domain: TDomain) {
  const fromRecords = records.map(r => ({
    ts: String(getObservationTimestamp(r)),
    pendingMessageTokens: r.pendingMessageTokens,
  }));
  const fromMarkers = markers.flatMap(m => {
    if (m.pendingTokens == null) return [];
    return {
      ts: m.timestamp,
      pendingMessageTokens: m.pendingTokens,
    };
  });
  return [...fromRecords, ...fromMarkers]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map(d => ({ t: toT(d.ts, domain), pendingMessageTokens: d.pendingMessageTokens }));
}

export function toActiveObservationData(records: OMHistoryRecord[], markers: ExtractedOmMarker[], domain: TDomain) {
  const points = [
    ...records.map(record => ({
      ts: String(getObservationTimestamp(record)),
      observationTokenCount: record.observationTokenCount,
    })),
    ...markers.flatMap(marker => {
      if (marker.type !== 'status' || marker.observationTokens == null) return [];
      return {
        ts: marker.timestamp,
        observationTokenCount: marker.observationTokens,
      };
    }),
  ].sort((a, b) => a.ts.localeCompare(b.ts));

  let runningTotal = 0;
  return points.map(point => {
    runningTotal = Math.max(runningTotal, point.observationTokenCount);
    return { t: toT(point.ts, domain), observationTokenCount: runningTotal };
  });
}

export function toBufferedObservationData(markers: ExtractedOmMarker[], domain: TDomain) {
  const points = markers
    .flatMap(marker => {
      if (marker.observationTokens == null || (marker.type !== 'buffering-end' && marker.type !== 'activation')) {
        return [];
      }
      return {
        ts: marker.timestamp,
        bufferedObservationTokenCount:
          marker.type === 'activation' ? -marker.observationTokens : marker.observationTokens,
      };
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));

  let runningTotal = 0;
  return points.map(point => {
    runningTotal = Math.max(0, runningTotal + point.bufferedObservationTokenCount);
    return { t: toT(point.ts, domain), bufferedObservationTokenCount: runningTotal };
  });
}

export function toEventData(records: OMHistoryRecord[], domain: TDomain) {
  return [...records]
    .sort((a, b) => String(getObservationTimestamp(a)).localeCompare(String(getObservationTimestamp(b))))
    .map(r => ({ t: toT(String(getObservationTimestamp(r)), domain), event: 1 }));
}

export function toMessageData(messages: MemoryMessage[], domain: TDomain) {
  return [...messages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(m => ({
      t: toT(new Date(m.createdAt).toISOString(), domain),
      event: 1,
      role: m.role,
    }));
}

/**
 * Merges an area series with an event series onto one timeline. Times carrying
 * an event keep the area value in force at that moment, so an event dot always
 * sits on the curve rather than dropping to zero between readings.
 */
export function toCombinedRowData(
  areaData: Array<Record<string, number>>,
  areaDataKey: string,
  eventData: Array<{ t: number; event: number; [k: string]: unknown }>,
): Array<Record<string, unknown> & { t: number }> {
  const areaValueByTime = new Map<number, number>();
  for (const point of areaData) {
    if (point.t === undefined) continue;
    areaValueByTime.set(point.t, Number(point[areaDataKey] ?? 0));
  }

  const eventsByTime = eventData.reduce<Map<number, Array<(typeof eventData)[number]>>>((acc, event) => {
    const bucket = acc.get(event.t);
    if (bucket) {
      bucket.push(event);
    } else {
      acc.set(event.t, [event]);
    }
    return acc;
  }, new Map());

  const allTimes = Array.from(new Set([...areaValueByTime.keys(), ...eventsByTime.keys()])).sort((a, b) => a - b);

  let lastAreaValue = 0;
  const combinedData: Array<Record<string, unknown> & { t: number }> = [];
  for (const time of allTimes) {
    const nextAreaValue = areaValueByTime.get(time);
    if (nextAreaValue != null) {
      lastAreaValue = nextAreaValue;
    }

    // A bucket only exists once at least one event landed on that moment.
    const bucket = eventsByTime.get(time);
    if (bucket) {
      for (const event of bucket) {
        combinedData.push({ ...event, t: time, [areaDataKey]: lastAreaValue });
      }
    } else {
      combinedData.push({ t: time, [areaDataKey]: lastAreaValue });
    }
  }

  return combinedData;
}

/**
 * Upper bound for an area row's y-axis: tall enough for the data, and for the
 * threshold line when there is one, so the line never sits off the chart.
 */
export function getAreaRowYMax(
  data: Array<{ [k: string]: unknown }>,
  dataKey: string,
  threshold?: number,
): number | undefined {
  if (threshold == null) return undefined;
  const maxValue = Math.max(0, ...data.map(point => Number(point[dataKey]) || 0));
  return Math.max(maxValue, threshold);
}

/** A chart click stands for a moment on the timeline only when it carries a readable label. */
export function toSelectedT(activeLabel: string | number | undefined): number | null {
  if (activeLabel == null) return null;
  return Number(activeLabel);
}

/** Only the points that mark an event get a dot; the rest are just curve samples. */
export function isEventPoint(payload: unknown): boolean {
  return Boolean((payload as { event?: number } | undefined)?.event);
}
