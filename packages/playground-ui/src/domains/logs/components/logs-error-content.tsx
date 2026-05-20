import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { SessionExpired } from '@/ds/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@/lib/query-utils';

export interface LogsErrorContentProps {
  /** The error from a useLogs query. */
  error: unknown;
  /** Passed to PermissionDenied (usually 'logs'). */
  resource: string;
  /** Title shown on the generic ErrorState fallback. */
  errorTitle: string;
}

/**
 * Renders the appropriate fallback content for a logs-related query error:
 * `<SessionExpired />` for 401, `<PermissionDenied />` for 403, otherwise `<ErrorState />`.
 * Mirror of `TracesErrorContent` for the logs domain.
 */
export function LogsErrorContent({ error, resource, errorTitle }: LogsErrorContentProps) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource={resource} />;
  const message = error instanceof Error ? error.message : undefined;
  return <ErrorState title={errorTitle} message={message ?? 'Unknown error'} />;
}
