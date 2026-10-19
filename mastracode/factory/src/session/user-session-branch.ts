export const USER_SESSION_BRANCH_PREFIX = 'user/';

export function userSessionBranch(sessionId: string): string {
  return `${USER_SESSION_BRANCH_PREFIX}session-${sessionId}`;
}
