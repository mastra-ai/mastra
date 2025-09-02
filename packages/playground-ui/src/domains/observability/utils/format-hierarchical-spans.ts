import { AISpanRecord } from '@mastra/core';
import { UISpan } from '../types';

export const formatHierarchicalSpans = (spans: AISpanRecord[]): UISpan[] => {
  console.log({ spans });

  if (!spans || spans.length === 0) {
    return [];
  }

  // Create a map for quick lookup of spans by spanId
  const spanMap = new Map<string, UISpan>();
  const rootSpans: UISpan[] = [];

  // First pass: create UISpan objects and initialize spans array
  spans?.forEach(spanRecord => {
    const startDate = new Date(spanRecord.startedAt);
    const endDate = spanRecord.endedAt ? new Date(spanRecord.endedAt) : undefined;

    const uiSpan: UISpan = {
      id: spanRecord.spanId,
      name: spanRecord.name,
      type: spanRecord.spanType,
      latency: endDate ? endDate.getTime() - startDate.getTime() : 0,
      startTime: startDate.toISOString(),
      endTime: endDate ? endDate.toISOString() : undefined,
      spans: [],
    };

    spanMap.set(spanRecord.spanId, uiSpan);
  });

  // Second pass: organize into tree structure
  spans?.forEach(spanRecord => {
    const uiSpan = spanMap.get(spanRecord.spanId)!;

    if (spanRecord.parentSpanId === null) {
      // This is a root span
      rootSpans.push(uiSpan);
    } else {
      // This is a child span
      const parent = spanMap.get(spanRecord.parentSpanId);
      if (parent) {
        parent.spans!.push(uiSpan);
      } else {
        // If parent doesn't exist, treat as root
        rootSpans.push(uiSpan);
      }
    }
  });

  // Sort all spans by startTime from earlier to later
  const sortSpansByStartTime = (spans: UISpan[]): UISpan[] => {
    return spans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  // Sort root spans
  const sortedRootSpans = sortSpansByStartTime(rootSpans);

  // Sort all nested spans recursively
  const sortNestedSpans = (spans: UISpan[]): void => {
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
