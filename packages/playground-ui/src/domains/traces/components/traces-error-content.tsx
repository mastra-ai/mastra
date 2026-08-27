import { QueryError } from '@/ds/components/QueryError';

export interface TracesErrorContentProps {
  /** The error from a useTraces / useTraceLightSpans / etc. query. */
  error: unknown;
  /** Passed to PermissionDenied (e.g. 'traces' / 'trace'). */
  resource: string;
  /** Title shown on the generic error fallback. */
  errorTitle: string;
}

/** @deprecated Use `<QueryError />` — this only maps the traces prop names onto it. */
export function TracesErrorContent({ error, resource, errorTitle }: TracesErrorContentProps) {
  return <QueryError error={error} resource={resource} title={errorTitle} />;
}
