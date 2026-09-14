import type { BoardCandidate } from '../boardCandidates';
import { pullRequestStatusForItem } from '../boardItems';
import type { WorkItem } from '../services/workItems';

export type ReviewCard = { kind: 'work-item'; value: WorkItem } | { kind: 'candidate'; value: BoardCandidate };

export interface ReviewStack {
  id: string;
  number: string;
  title: string;
}

export interface ReviewStackMember {
  stack: ReviewStack;
  position: number;
}

interface StackPullRequest {
  id: string;
  repository: string;
  number: string;
  title: string;
  headBranch: string;
  baseBranch: string;
  cardKeys: string[];
}

export function reviewCardKey(card: ReviewCard): string {
  return card.kind === 'work-item' ? `work-item:${card.value.id}` : `candidate:${card.value.sourceKey}`;
}

export function reviewCards(workItems: readonly WorkItem[], candidates: readonly BoardCandidate[]): ReviewCard[] {
  return [
    ...workItems.map((value): ReviewCard => ({ kind: 'work-item', value })),
    ...candidates.map((value): ReviewCard => ({ kind: 'candidate', value })),
  ];
}

function stackPullRequest(card: ReviewCard): StackPullRequest | undefined {
  const { source, url, metadata, title } = card.value;
  if (source !== 'github-pr' || !url || !URL.canParse(url)) return;
  if (card.kind === 'work-item') {
    const status = pullRequestStatusForItem(card.value);
    if (status === 'closed' || status === 'merged') return;
  }
  const { headBranch, baseBranch } = metadata;
  if (typeof headBranch !== 'string' || typeof baseBranch !== 'string' || !headBranch || !baseBranch) return;
  const parsedUrl = new URL(url);
  const match = /^\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)\/?$/.exec(parsedUrl.pathname);
  if (!match) return;
  const repository = `${parsedUrl.host}/${match[1]}`.toLowerCase();
  const number = match[2];
  return {
    id: `${repository}/pull/${number}`,
    repository,
    number,
    title,
    headBranch,
    baseBranch,
    cardKeys: [reviewCardKey(card)],
  };
}

export function buildReviewStackIndex(cards: readonly ReviewCard[]): ReadonlyMap<string, ReviewStackMember> {
  const pullRequests = new Map<string, StackPullRequest>();
  for (const card of cards) {
    const pullRequest = stackPullRequest(card);
    if (!pullRequest) continue;
    const existing = pullRequests.get(pullRequest.id);
    if (existing) existing.cardKeys.push(...pullRequest.cardKeys);
    else pullRequests.set(pullRequest.id, pullRequest);
  }

  const heads = new Map<string, StackPullRequest[]>();
  for (const pullRequest of pullRequests.values()) {
    const branchKey = `${pullRequest.repository}:${pullRequest.headBranch}`;
    const matches = heads.get(branchKey);
    if (matches) matches.push(pullRequest);
    else heads.set(branchKey, [pullRequest]);
  }

  const roots: StackPullRequest[] = [];
  const children = new Map<string, StackPullRequest[]>();
  for (const pullRequest of pullRequests.values()) {
    const ownHead = heads.get(`${pullRequest.repository}:${pullRequest.headBranch}`);
    const parents = heads.get(`${pullRequest.repository}:${pullRequest.baseBranch}`);
    if (ownHead?.length !== 1 || (parents && parents.length !== 1)) continue;
    const parent = parents?.[0];
    if (!parent) {
      roots.push(pullRequest);
      continue;
    }
    const siblings = children.get(parent.id);
    if (siblings) siblings.push(pullRequest);
    else children.set(parent.id, [pullRequest]);
  }

  const index = new Map<string, ReviewStackMember>();
  for (const root of roots) {
    const ordered: StackPullRequest[] = [];
    const pending = [root];
    while (pending.length > 0) {
      const pullRequest = pending.pop();
      if (!pullRequest) break;
      ordered.push(pullRequest);
      const descendants = children.get(pullRequest.id);
      if (descendants) pending.push(...descendants.toReversed());
    }
    if (ordered.length < 2) continue;
    const stack: ReviewStack = { id: root.id, number: root.number, title: root.title };
    ordered.forEach((pullRequest, position) => {
      for (const key of pullRequest.cardKeys) index.set(key, { stack, position });
    });
  }
  return index;
}

export function groupReviewCards(
  cards: readonly ReviewCard[],
  stacks: ReadonlyMap<string, ReviewStackMember>,
): ReviewCard[][] {
  const groups = new Map<string, Array<{ card: ReviewCard; position: number }>>();
  for (const card of cards) {
    const key = reviewCardKey(card);
    const member = stacks.get(key);
    const groupKey = member?.stack.id ?? key;
    const entry = { card, position: member?.position ?? 0 };
    const group = groups.get(groupKey);
    if (group) group.push(entry);
    else groups.set(groupKey, [entry]);
  }
  return [...groups.values()].map(group =>
    group.toSorted((left, right) => left.position - right.position).map(entry => entry.card),
  );
}
