import { CircleSlashIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';
import { QueryError } from '@/ds/components/QueryError';
import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '@/lib/query-utils';

export interface LogsErrorContentProps {
  /** The error from a useLogs query. */
  error: unknown;
  /** Passed to PermissionDenied (usually 'logs'). */
  resource: string;
  /** Title shown on the generic error fallback. */
  errorTitle: string;
}

/**
 * `<QueryError />` plus the two storage-capability arms that only logs can hit.
 */
export function LogsErrorContent({ error, resource, errorTitle }: LogsErrorContentProps) {
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

  return <QueryError error={error} resource={resource} title={errorTitle} />;
}
