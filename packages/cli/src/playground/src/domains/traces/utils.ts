import type { RefinedTrace, Span } from './types';

/**
 *
 * @param duration duration of the span
 * @param fixedPoint how many fixed point
 * @returns duration in milliseconds in fixed points
 */
export function formatDuration(duration: number, fixedPoint = 2) {
  const durationInSecs = duration / 1_000;

  return durationInSecs.toFixed(fixedPoint);
}

export function formatOtelTimestamp(otelTimestamp: number) {
  const date = new Date(otelTimestamp / 1000);

  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  }).format(date);
}

export function formatOtelTimestamp2(otelTimestamp: number) {
  const date = new Date(otelTimestamp / 1000000);

  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  }).format(date);
}

export function transformKey(key: string) {
  if (key.includes('.argument.')) {
    return `Input`;
  }
  if (key.includes('.result')) {
    return 'Output';
  }
  return key.split('.').join(' ').split('_');
}

export function cleanString(string: string) {
  return (
    string
      .replace(/\\n/g, '')
      // Also handle any actual newlines
      .replace(/\n/g, '')
      // Clean up any resulting extra spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export const refineTraces = (traces: Span[]): RefinedTrace[] => {
  const listOfSpanIds = new Set<string>();
  const groupedTraces = traces.reduce<Record<string, Span[]>>((acc, curr) => {
    const newCurr = { ...curr, duration: curr.endTime - curr.startTime };

    listOfSpanIds.add(curr.id);

    return { ...acc, [curr.traceId]: [...(acc[curr.traceId] || []), newCurr] };
  }, {});

  const tracesData = Object.entries(groupedTraces).map(([key, value]) => {
    const parentSpan = value.find(span => !span.parentSpanId || !listOfSpanIds.has(span.parentSpanId));

    const enrichedSpans = value.map(span => ({
      ...span,
      parentSpanId: parentSpan?.id === span.id ? null : span?.parentSpanId,
      relativePercentage: parentSpan ? span.duration / parentSpan.duration : 0,
    }));

    const failedStatus = value.find(span => span.status.code !== 0)?.status;
    return {
      traceId: key,
      serviceName: parentSpan?.name || key,
      duration: value.reduce((acc, curr) => acc + curr.duration, 0),
      status: failedStatus || parentSpan?.status || value[0].status,
      started: value[0].startTime,
      trace: enrichedSpans,
    };
  });

  return tracesData;
};
