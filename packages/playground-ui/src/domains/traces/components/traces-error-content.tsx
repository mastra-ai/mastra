import { PermissionDenied } from '@/domains/auth/components/permission-denied';
import { SessionExpired } from '@/domains/auth/components/session-expired';
import { EmptyState } from '@/ds/components/EmptyState';
import { parseError } from '@/lib/errors';
import { is401UnauthorizedError, is403ForbiddenError } from '@/lib/query-utils';

export interface TracesErrorContentProps {
  /** The error from a useTraces / useTraceLightSpans / etc. query. */
  error: unknown;
  /** Passed to PermissionDenied (e.g. 'traces' / 'trace'). */
  resource: string;
  /** Title shown on the generic error fallback. */
  errorTitle: string;
}

/**
 * Renders the appropriate fallback content for a traces-related query error:
 * `<SessionExpired />` for 401, `<PermissionDenied />` for 403, otherwise `<EmptyState tone="error" />`.
 *
 * The consumer wraps it in whatever layout they want (PageLayout for the list page,
 * a centered div for the detail page, etc.) — this component only owns the 3-branch decision.
 */
export function TracesErrorContent({ error, resource, errorTitle }: TracesErrorContentProps) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource={resource} />;
  const parsed = error instanceof Error ? parseError(error) : undefined;
  return <EmptyState tone="error" titleSlot={errorTitle} descriptionSlot={parsed?.error ?? 'Unknown error'} />;
}
