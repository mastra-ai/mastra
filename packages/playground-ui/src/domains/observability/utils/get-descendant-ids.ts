import { type UISpan } from '../types';

export function getSpanDescendantIds(span: UISpan): string[] {
  if (!span.spans || span.spans.length === 0) {
    return [];
  }

  const descendantIds: string[] = [];

  // Add direct children IDs
  span.spans.forEach(childSpan => {
    descendantIds.push(childSpan.id);
    // Recursively add descendant IDs from each child
    descendantIds.push(...getSpanDescendantIds(childSpan));
  });

  return descendantIds;
}
