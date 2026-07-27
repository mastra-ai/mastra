import type { WorkItem } from './workItems';

function sourceNumber(item: WorkItem): string | undefined {
  const number = item.metadata.number;
  if (typeof number === 'number' || typeof number === 'string') return String(number);

  const sourceKeyNumber = item.sourceKey?.split(':').at(-1);
  return sourceKeyNumber || undefined;
}

function sessionBranches(item: WorkItem): Set<string> {
  return new Set(Object.values(item.sessions).map(session => session.branch));
}

function inferredFactoryRelation(first: WorkItem, second: WorkItem): boolean {
  const review = first.source === 'github-pr' ? first : second.source === 'github-pr' ? second : undefined;
  const workItem = review === first ? second : first;
  if (!review || workItem.source === 'github-pr' || review.parentWorkItemId !== null) return false;

  const headBranch = review.metadata.headBranch;
  return typeof headBranch === 'string' && sessionBranches(workItem).has(headBranch);
}

export function relatedWorkItems(item: WorkItem, allItems: WorkItem[]): WorkItem[] {
  return allItems.filter(candidate => {
    if (candidate.id === item.id) return false;
    if (candidate.parentWorkItemId === item.id || item.parentWorkItemId === candidate.id) return true;
    return inferredFactoryRelation(item, candidate);
  });
}

export function inferredParentWorkItemId(metadata: Record<string, unknown>, allItems: WorkItem[]): string | undefined {
  const headBranch = metadata.headBranch;
  if (typeof headBranch !== 'string') return undefined;
  return allItems.find(
    item => item.source !== 'github-pr' && Object.values(item.sessions).some(session => session.branch === headBranch),
  )?.id;
}

export function relationshipPath(item: WorkItem, factoryId: string): string {
  return item.source === 'github-pr' ? `/factories/${factoryId}/review` : `/factories/${factoryId}/work`;
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
