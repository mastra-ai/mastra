import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';

export type TraceInvestigateProps = {
  traceId: string;
};

/** Loads the full trace (all spans, with their heavy fields) for a single traceId. */
export function TraceInvestigate({ traceId }: TraceInvestigateProps) {
  const { data, isLoading, isError, error } = useTraceSpans(traceId);

  if (isLoading) {
    return (
      <div className="p-2" data-testid="trace-investigate-loading">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-accent2 text-ui-sm" data-testid="trace-investigate-error">
        {error?.message ?? `Failed to load trace ${traceId}.`}
      </div>
    );
  }

  return (
    <div data-testid="trace-investigate" className="flex flex-col gap-1">
      <span className="text-icon3 text-ui-sm">{traceId}</span>
      {(data?.spans ?? []).map(span => (
        <span key={span.spanId} className="text-icon6 text-ui-md">
          {span.name}
        </span>
      ))}
    </div>
  );
}
