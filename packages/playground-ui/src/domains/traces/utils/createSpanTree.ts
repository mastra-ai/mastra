import type { Span, SpanNode } from '../types';

function buildTree(
  spans: Span[],
  minStartTime: number,
  totalDurationMs: number,
  parentSpanId: string | null = null,
): SpanNode[] {
  return spans
    .filter(span => span.parentSpanId === parentSpanId)
    .map(span => {
      return {
        ...span,
        children: buildTree(spans, minStartTime, totalDurationMs, span.id),
        offset: (span.startTime - minStartTime) / 1_000, // ns to ms
        duration: span.duration / 1000,
        totalDurationMs,
      };
    });
}

export const createSpanTree = (spans: Span[]) => {
  if (spans.length === 0) return [];

  let minStartTime;
  let maxEndTime;
  let shortest;
  let longest;
  const orderedTree: Array<Span> = [];
  const listSize = spans.length;

  for (let i = listSize - 1; i >= 0; i--) {
    const span = spans[i];

    if (!minStartTime || span.startTime < minStartTime) {
      minStartTime = span.startTime;
      shortest = span;
    }

    if (!maxEndTime || span.endTime > maxEndTime) {
      maxEndTime = span.endTime;
      longest = span;
    }

    if (span.name !== '.insert' && span.name !== 'mastra.getStorage') {
      orderedTree.push(span);
    }
  }

  if (!minStartTime || !maxEndTime) return [];

  const totalDurationMs = (maxEndTime - minStartTime) / 1000;

  return buildTree(orderedTree, minStartTime, totalDurationMs);
};
