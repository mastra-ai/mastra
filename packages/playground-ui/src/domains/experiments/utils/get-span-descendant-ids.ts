import { type ExperimentUISpan } from '../types';

export function getSpanDescendantIds(span: ExperimentUISpan): string[] {
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
