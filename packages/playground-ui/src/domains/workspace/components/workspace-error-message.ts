import { MastraClientError } from '@mastra/client-js';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/react/hooks/query';

export function describeWorkspaceError(error: Error | undefined, fallback: string) {
  if (is401UnauthorizedError(error)) return 'Your session has expired. Sign in again to continue.';
  if (is403ForbiddenError(error)) return "You don't have permission to access this.";
  if (is404NotFoundError(error)) return 'This path no longer exists.';
  if (error instanceof MastraClientError && error.status === 501)
    return 'This workspace does not support this operation.';
  return fallback;
}
