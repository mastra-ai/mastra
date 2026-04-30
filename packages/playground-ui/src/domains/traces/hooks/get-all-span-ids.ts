import type { UISpan } from '../types';

export function getSpanDescendantIds(span: UISpan): string[] {
  if (!span.spans || span.spans.length === 0) {
    return [];
  }

  const descendantIds: string[] = [];

  span.spans.forEach(childSpan => {
    descendantIds.push(childSpan.id);
    descendantIds.push(...getSpanDescendantIds(childSpan));
  });

  return descendantIds;
}

export function getAllSpanIds(spans: UISpan[]): string[] {
  const ids: string[] = [];
  for (const span of spans) {
    ids.push(span.id);
    ids.push(...getSpanDescendantIds(span));
  }
  return ids;
}
