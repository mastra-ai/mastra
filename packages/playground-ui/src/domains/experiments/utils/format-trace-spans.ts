import { SpanRecord } from '@mastra/core/storage';
import { ExperimentUISpan } from '../types';

export const formatTraceSpans = (spans: SpanRecord[]): ExperimentUISpan[] => {
  if (!spans || spans.length === 0) {
    return [];
  }

  const overallEndDate = spans.reduce(
    (latest, span) => {
      const endDate = span?.endedAt ? new Date(span.endedAt) : undefined;
      return endDate && (!latest || endDate > latest) ? endDate : latest;
    },
    null as Date | null,
  );

  // Create a map for quick lookup of spans by spanId
  const spanMap = new Map<string, ExperimentUISpan>();
  const rootSpans: ExperimentUISpan[] = [];

  // First pass: create ExperimentUISpan objects and initialize spans array
  spans.forEach(spanRecord => {
    const startDate = new Date(spanRecord.startedAt);
    const endDate = spanRecord.endedAt ? new Date(spanRecord.endedAt) : undefined;

    const uiSpan: ExperimentUISpan = {
      id: spanRecord.spanId,
      name: spanRecord.name,
      type: spanRecord.spanType,
      latency: endDate ? endDate.getTime() - startDate.getTime() : 0,
      startTime: startDate.toISOString(),
      endTime: endDate ? endDate.toISOString() : undefined,
      spans: [],
      parentSpanId: spanRecord.parentSpanId,
    };

    spanMap.set(spanRecord.spanId, uiSpan);
  });

  // Second pass: organize into tree structure
  spans.forEach(spanRecord => {
    const uiSpan = spanMap.get(spanRecord.spanId)!;

    if (spanRecord?.parentSpanId == null) {
      if (overallEndDate && uiSpan.endTime && overallEndDate > new Date(uiSpan.endTime)) {
        uiSpan.endTime = overallEndDate.toISOString();
        const overallEndTime = new Date(overallEndDate).getTime();
        const spanStartTime = new Date(uiSpan.startTime).getTime();
        uiSpan.latency = overallEndTime - spanStartTime;
      }
      rootSpans.push(uiSpan);
    } else {
      const parent = spanMap.get(spanRecord.parentSpanId);
      if (parent) {
        parent.spans!.push(uiSpan);
      } else {
        rootSpans.push(uiSpan);
      }
    }
  });

  const sortSpansByStartTime = (spans: ExperimentUISpan[]): ExperimentUISpan[] => {
    return spans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const sortedRootSpans = sortSpansByStartTime(rootSpans);

  const sortNestedSpans = (spans: ExperimentUISpan[]): void => {
    spans.forEach(span => {
      if (span.spans && span.spans.length > 0) {
        span.spans = sortSpansByStartTime(span.spans);
        sortNestedSpans(span.spans);
      }
    });
  };

  sortNestedSpans(sortedRootSpans);

  return sortedRootSpans;
};
