import type { WorkItem } from '../../factory/services/workItems';
import { USER_SESSION_BRANCH_PREFIX } from './github';
import type { FactoryUserSession } from './github';

export function getFactorySessionKind(session: FactoryUserSession, workItem: WorkItem | undefined): 'work' | 'review' {
  if (workItem?.source === 'github-pr') return 'review';
  if (!workItem && session.branch.startsWith('factory/pr-')) return 'review';
  return 'work';
}

export function getUserSessionLabel(session: FactoryUserSession): string {
  if (!session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)) return session.branch;
  return session.branch.slice(USER_SESSION_BRANCH_PREFIX.length);
}
