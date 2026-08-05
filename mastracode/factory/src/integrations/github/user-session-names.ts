import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';

export const USER_SESSION_BRANCH_PREFIX = 'user/';

const GENERATED_NAME = /^session-(\d+)$/;

function generatedIndex(branch: string): number {
  if (!branch.startsWith(USER_SESSION_BRANCH_PREFIX)) return 0;
  const match = GENERATED_NAME.exec(branch.slice(USER_SESSION_BRANCH_PREFIX.length));
  return match ? Number(match[1]) : 0;
}

/**
 * Branch for a user session the caller did not name. The index counts up
 * forever and clears every live session, so no two sessions ever share a
 * branch — including across a delete, which drops the session row but leaves
 * the branch it pushed behind.
 */
export async function allocateUserSessionBranch(args: {
  sourceControl: Pick<SourceControlStorageHandle, 'sessions' | 'userSessionNames'>;
  projectRepositoryId: string;
  userId: string;
}): Promise<string> {
  const { sourceControl, projectRepositoryId, userId } = args;
  const live = await sourceControl.sessions.list({ projectRepositoryId, userId });
  const index = await sourceControl.userSessionNames.allocate({
    projectRepositoryId,
    userId,
    atLeast: live.reduce((highest, session) => Math.max(highest, generatedIndex(session.branch)), 0) + 1,
  });
  return `${USER_SESSION_BRANCH_PREFIX}session-${index}`;
}
