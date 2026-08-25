import type { WorkItem } from '../../factory/services/workItems';
import { USER_SESSION_BRANCH_PREFIX } from './user-sessions';
import type { FactoryUserSession } from './user-sessions';

const REVIEW_BRANCH_PREFIX = 'factory/pr-';

export function getFactorySessionKind(session: FactoryUserSession, workItem: WorkItem | undefined): 'work' | 'review' {
  if (workItem?.source === 'github-pr') return 'review';
  if (!workItem && session.branch.startsWith(REVIEW_BRANCH_PREFIX)) return 'review';
  return 'work';
}

export function getReviewBranchIdentifier(branch: string): string | undefined {
  if (!branch.startsWith(REVIEW_BRANCH_PREFIX)) return undefined;
  const number = branch.slice(REVIEW_BRANCH_PREFIX.length);
  if (!/^\d+$/.test(number)) return undefined;
  return `#${number}`;
}

export function isAutomaticUserSessionBranch(session: FactoryUserSession): boolean {
  return session.branch === `${USER_SESSION_BRANCH_PREFIX}session-${session.sessionId}`;
}

export function getUserSessionLabel(session: FactoryUserSession): string {
  const title = session.title?.trim();
  if (title) return title;
  if (!session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)) return session.branch;
  if (isAutomaticUserSessionBranch(session)) return 'New session';
  return session.branch.slice(USER_SESSION_BRANCH_PREFIX.length);
}

export function getUserSessionTooltip(session: FactoryUserSession): string {
  return isAutomaticUserSessionBranch(session) ? getUserSessionLabel(session) : session.branch;
}
