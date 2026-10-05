import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/react/hooks';
import { Notice } from '@/ds/components/Notice';

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status;

function describeError(error: unknown, fallback: string) {
  if (is401UnauthorizedError(error)) return 'Your session has expired. Sign in again to continue.';
  if (is403ForbiddenError(error)) return "You don't have permission to access this.";
  if (is404NotFoundError(error)) return 'This path no longer exists.';
  if (statusOf(error) === 501) return 'This workspace does not support this operation.';
  return fallback;
}

export function WorkspaceError({
  error,
  fallback,
  className,
}: {
  error: unknown;
  fallback: string;
  className?: string;
}) {
  return (
    <Notice variant="destructive" className={className}>
      <Notice.Message>{describeError(error, fallback)}</Notice.Message>
    </Notice>
  );
}
