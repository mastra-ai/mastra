import type { WorkItem } from './workItems';

function sourceNumber(item: WorkItem): string | undefined {
  const number = item.metadata.number;
  if (typeof number === 'number' || typeof number === 'string') return String(number);

  const sourceKeyNumber = item.sourceKey?.split(':').at(-1);
  return sourceKeyNumber || undefined;
}

export function relatedWorkItems(item: WorkItem, allItems: WorkItem[]): WorkItem[] {
  return allItems.filter(
    candidate =>
      candidate.id !== item.id && (candidate.parentWorkItemId === item.id || item.parentWorkItemId === candidate.id),
  );
}

export function relationshipLabel(item: WorkItem): string {
  const number = sourceNumber(item);
  if (item.source === 'github-pr') return number ? `Review: PR #${number}` : `Review: ${item.title}`;
  if (item.source === 'github-issue') return number ? `Work item: Issue #${number}` : `Work item: ${item.title}`;
  if (item.source === 'linear-issue') {
    const identifier = typeof item.metadata.identifier === 'string' ? item.metadata.identifier : number;
    return identifier ? `Work item: ${identifier}` : `Work item: ${item.title}`;
  }
  return `Work item: ${item.title}`;
}
