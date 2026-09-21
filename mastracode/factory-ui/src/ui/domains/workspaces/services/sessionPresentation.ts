import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';
import { USER_SESSION_BRANCH_PREFIX } from './user-sessions';
import type { FactoryUserSession } from './user-sessions';

const GITHUB_REVIEW_BRANCH = /^factory\/pr-([1-9]\d*)$/;
const GITLAB_REVIEW_BRANCH = /^factory\/gitlab-mr-([1-9]\d*)-[a-z0-9]+$/;

export interface SessionOwnerDetails {
  name: string;
  avatarUrl?: string;
}

export interface SessionViewerProfile {
  userId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export function getSessionOwnerDetails(
  session: FactoryUserSession,
  viewer: SessionViewerProfile | undefined,
): SessionOwnerDetails {
  const isViewer = Boolean(viewer?.userId) && session.userId === viewer?.userId;
  const name =
    (isViewer && (viewer?.name?.trim() || viewer?.email?.trim())) || session.owner?.name?.trim() || session.userId;
  const avatarUrl = (isViewer && viewer?.avatarUrl?.trim()) || session.owner?.avatarUrl?.trim();
  return {
    name,
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

export function getFactorySessionKind(session: FactoryUserSession, workItem: WorkItem | undefined): 'work' | 'review' {
  if (workItem && isPullRequestSource(workItem.source)) return 'review';
  if (!workItem && getReviewBranchIdentifier(session.branch)) return 'review';
  return 'work';
}

export function getReviewBranchIdentifier(branch: string): string | undefined {
  const github = GITHUB_REVIEW_BRANCH.exec(branch);
  if (github) return `#${github[1]}`;
  const gitlab = GITLAB_REVIEW_BRANCH.exec(branch);
  return gitlab ? `!${gitlab[1]}` : undefined;
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
