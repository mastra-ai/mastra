/**
 * Which cards belong together: a card with its parent and children, and a pull request with the
 * card whose session branch it was pushed from. The UI and the session-scoped work-item listing
 * both read relations here, so a scoped listing holds every card the UI relates to the session's.
 */

/** What relations are read from, on the server's card and the UI's alike. */
export interface RelatableCard {
  readonly id: string;
  readonly parentWorkItemId: string | null;
  readonly sessions: Readonly<Record<string, { readonly branch: string }>>;
}

/** The pull request facts each side reads off its own card shape. */
export interface PullRequestFacts<T> {
  isPullRequest(card: T): boolean;
  /** The branch a pull request card was opened from. */
  headBranch(card: T): string | undefined;
}

// One scan for the whole board instead of one per card. Relations come back in board order.
export function relatedCardIndex<T extends RelatableCard>(
  cards: readonly T[],
  { isPullRequest, headBranch }: PullRequestFacts<T>,
): (card: T) => T[] {
  interface Candidate {
    card: T;
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
  const sessionBranches = (card: T) => new Set(Object.values(card.sessions).map(session => session.branch));

  cards.forEach((card, position) => {
    const candidate = { card, position };
    byId.set(card.id, candidate);
    if (card.parentWorkItemId !== null) push(childrenByParentId, card.parentWorkItemId, candidate);
    if (isPullRequest(card)) {
      const branch = card.parentWorkItemId === null ? headBranch(card) : undefined;
      if (branch !== undefined) push(unlinkedPullRequestsByHeadBranch, branch, candidate);
      return;
    }
    for (const branch of sessionBranches(card)) push(authorsBySessionBranch, branch, candidate);
  });

  return card => {
    const parent = card.parentWorkItemId === null ? undefined : byId.get(card.parentWorkItemId);
    const pullRequest = isPullRequest(card);
    const unlinkedHeadBranch = pullRequest && card.parentWorkItemId === null ? headBranch(card) : undefined;
    const branchAuthors =
      unlinkedHeadBranch === undefined ? [] : (authorsBySessionBranch.get(unlinkedHeadBranch) ?? []);
    const branchPullRequests = pullRequest
      ? []
      : [...sessionBranches(card)].flatMap(branch => unlinkedPullRequestsByHeadBranch.get(branch) ?? []);

    const related = new Map<string, Candidate>();
    for (const candidate of [
      ...(childrenByParentId.get(card.id) ?? []),
      ...(parent === undefined ? [] : [parent]),
      ...branchAuthors,
      ...branchPullRequests,
    ]) {
      if (candidate.card.id !== card.id) related.set(candidate.card.id, candidate);
    }
    return [...related.values()].toSorted((a, b) => a.position - b.position).map(candidate => candidate.card);
  };
}
