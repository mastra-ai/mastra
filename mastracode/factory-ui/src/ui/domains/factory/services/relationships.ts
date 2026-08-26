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

function headBranch(item: WorkItem): string | undefined {
  const branch = item.metadata.headBranch;
  return typeof branch === 'string' ? branch : undefined;
}

// One scan for the whole board instead of one per card. Relations come back in board order.
export function relatedWorkItemIndex(allItems: readonly WorkItem[]): (item: WorkItem) => WorkItem[] {
  interface Candidate {
    item: WorkItem;
    position: number;
  }
  const byId = new Map<string, Candidate>();
  const childrenByParentId = new Map<string, Candidate[]>();
  // A pull request with no recorded parent still belongs to the card whose session branch it was pushed from.
  const unlinkedPullRequestsByHeadBranch = new Map<string, Candidate[]>();
  const authorsBySessionBranch = new Map<string, Candidate[]>();
  const push = (index: Map<string, Candidate[]>, key: string, candidate: Candidate) => {
    const bucket = index.get(key);
    if (bucket) bucket.push(candidate);
    else index.set(key, [candidate]);
  };

  allItems.forEach((item, position) => {
    const candidate = { item, position };
    byId.set(item.id, candidate);
    if (item.parentWorkItemId !== null) push(childrenByParentId, item.parentWorkItemId, candidate);
    if (item.source === 'github-pr') {
      const branch = item.parentWorkItemId === null ? headBranch(item) : undefined;
      if (branch !== undefined) push(unlinkedPullRequestsByHeadBranch, branch, candidate);
      return;
    }
    for (const branch of sessionBranches(item)) push(authorsBySessionBranch, branch, candidate);
  });

  return item => {
    const parent = item.parentWorkItemId === null ? undefined : byId.get(item.parentWorkItemId);
    const isPullRequest = item.source === 'github-pr';
    const unlinkedHeadBranch = isPullRequest && item.parentWorkItemId === null ? headBranch(item) : undefined;
    const branchAuthors =
      unlinkedHeadBranch === undefined ? [] : (authorsBySessionBranch.get(unlinkedHeadBranch) ?? []);
    const branchPullRequests = isPullRequest
      ? []
      : [...sessionBranches(item)].flatMap(branch => unlinkedPullRequestsByHeadBranch.get(branch) ?? []);

    const related = new Map<string, Candidate>();
    for (const candidate of [
      ...(childrenByParentId.get(item.id) ?? []),
      ...(parent === undefined ? [] : [parent]),
      ...branchAuthors,
      ...branchPullRequests,
    ]) {
      if (candidate.item.id !== item.id) related.set(candidate.item.id, candidate);
    }
    return [...related.values()].toSorted((a, b) => a.position - b.position).map(candidate => candidate.item);
  };
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
