import type { WorkItem } from '../../factory/services/workItems';
import { USER_SESSION_BRANCH_PREFIX } from './github';
import type { FactoryUserSession } from './github';

const REVIEW_BRANCH_PREFIX = 'factory/pr-';

export function getFactorySessionKind(session: FactoryUserSession, workItem: WorkItem | undefined): 'work' | 'review' {
  if (workItem?.source === 'github-pr') return 'review';
  if (!workItem && session.branch.startsWith(REVIEW_BRANCH_PREFIX)) return 'review';
  return 'work';
}

/** `#900` from a `factory/pr-900` branch — the only identifier left when work items fail to load. */
export function getReviewBranchIdentifier(branch: string): string | undefined {
  if (!branch.startsWith(REVIEW_BRANCH_PREFIX)) return undefined;
  const number = branch.slice(REVIEW_BRANCH_PREFIX.length);
  if (!/^\d+$/.test(number)) return undefined;
  return `#${number}`;
}

export function getUserSessionLabel(session: FactoryUserSession): string {
  if (!session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)) return session.branch;
  return session.branch.slice(USER_SESSION_BRANCH_PREFIX.length);
}

const GENERATED_SESSION_NAME = /^session-(\d+)$/;

/**
 * Name for the next user session. Counts past the highest `session-N` instead
 * of filling gaps — deleting a session drops its row and checkout but not the
 * branch it pushed, so a reused name would land back on that branch.
 */
export function nextUserSessionName(sessions: FactoryUserSession[]): string {
  const highest = sessions.reduce((max, session) => {
    const match = GENERATED_SESSION_NAME.exec(getUserSessionLabel(session));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `session-${highest + 1}`;
}
