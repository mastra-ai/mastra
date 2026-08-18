import { githubNumberForItem } from '../boardItems';
import type { WorkItem } from './workItems';

/** Intake candidates carry a source and metadata but no card, so identifiers work on both. */
type IdentifiableItem = Pick<WorkItem, 'source' | 'metadata' | 'sourceKey'>;

export function workItemNumber(item: IdentifiableItem): string | undefined {
  const githubNumber = githubNumberForItem(item);
  if (githubNumber !== undefined) return String(githubNumber);

  const number = item.metadata.number;
  if (typeof number === 'number' || typeof number === 'string') return String(number);
  return item.sourceKey?.split(':').at(-1) || undefined;
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

export function inferredParentWorkItemId(
  metadata: Record<string, unknown>,
  allItems: readonly WorkItem[],
): string | undefined {
  const headBranch = metadata.headBranch;
  if (typeof headBranch !== 'string') return undefined;
  return allItems.find(
    item => item.source !== 'github-pr' && Object.values(item.sessions).some(session => session.branch === headBranch),
  )?.id;
}

export function relationshipPath(item: Pick<WorkItem, 'source'>, factoryId: string): string {
  return item.source === 'github-pr' ? `/factories/${factoryId}/review` : `/factories/${factoryId}/work`;
}

export function relationshipLabel(item: WorkItem): string {
  const reference = workItemReferenceLabel(item) ?? item.title;
  return item.source === 'github-pr' ? `Review: ${reference}` : `Work item: ${reference}`;
}

function linearIdentifier(item: IdentifiableItem): string | undefined {
  return typeof item.metadata.identifier === 'string' ? item.metadata.identifier : undefined;
}

/** What a person types to find the item: `#20456` on GitHub, the team key `ENG-123` on Linear. */
export function workItemIdentifier(item: IdentifiableItem): string | undefined {
  // Linear source key already reads `linear:ENG-123` — hashing it would invent `#ENG-123`.
  if (item.source === 'linear-issue') return linearIdentifier(item) ?? workItemNumber(item);
  if (item.source === 'github-pr' || item.source === 'github-issue') {
    const number = workItemNumber(item);
    return number ? `#${number}` : undefined;
  }
  return undefined;
}

export function workItemReferenceLabel(item: IdentifiableItem): string | undefined {
  const identifier = workItemIdentifier(item);
  if (identifier === undefined) return;
  if (item.source === 'github-pr') return `PR ${identifier}`;
  if (item.source === 'github-issue') return `Issue ${identifier}`;
  return identifier;
}
