import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { SessionExpired } from '@/ds/components/SessionExpired';
import { parseError } from '@/lib/errors';
import { is401UnauthorizedError, is403ForbiddenError } from '@/lib/query-utils';

export interface TracesErrorContentProps {
  /** The error from a useTraces / useTraceLightSpans / etc. query. */
  error: unknown;
  /** Passed to PermissionDenied (e.g. 'traces' / 'trace'). */
  resource: string;
  /** Title shown on the generic ErrorState fallback. */
  errorTitle: string;
}

/**
 * Renders the appropriate fallback content for a traces-related query error:
 * `<SessionExpired />` for 401, `<PermissionDenied />` for 403, otherwise `<ErrorState />`.
 *
 * The consumer wraps it in whatever layout they want (NoDataPageLayout for the list page,
 * PageLayout.MainArea for the detail page, etc.) — this component only owns the 3-branch decision.
 */
export function TracesErrorContent({ error, resource, errorTitle }: TracesErrorContentProps) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource={resource} />;
  const parsed = error instanceof Error ? parseError(error) : undefined;
  return <ErrorState title={errorTitle} message={parsed?.error ?? 'Unknown error'} />;
}
