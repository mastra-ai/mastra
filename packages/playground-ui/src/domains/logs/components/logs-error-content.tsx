import { CircleSlashIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { SessionExpired } from '@/ds/components/SessionExpired';
import {
  is401UnauthorizedError,
  is403ForbiddenError,
  isObservabilityUnavailableError,
  isUnsupportedObservabilityOperationError,
} from '@/lib/query-utils';

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
  if (isObservabilityUnavailableError(error)) {
    return (
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="Observability storage is not available"
        descriptionSlot="The observability storage domain is disabled or not configured. Enable it in your storage configuration to view logs in Studio."
      />
    );
  }
  if (isUnsupportedObservabilityOperationError(error, 'logs')) {
    return (
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="Logs are not available with your current storage"
        descriptionSlot="The configured observability storage provider does not support listing logs. Switch to a storage provider with logs support to view runtime logs in Studio."
      />
    );
  }
  const message = error instanceof Error ? error.message : undefined;
  return <ErrorState title={errorTitle} message={message ?? 'Unknown error'} />;
}
