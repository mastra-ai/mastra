import { describeSpanError } from '@mastra/core/observability';
import { useSpanDetail } from '@mastra/react/hooks/traces';
import { asCoreSpan } from './span-payload/span-payload-registry';
import { TraceErrorSummary } from './trace-error-summary';

export interface TraceErrorDetailsProps {
  traceId: string;
  spanId: string;
  errorPreview: string;
}

/**
 * The full error of a failed span. Mounted only while the hover card is open, so the span is
 * fetched on first hover (and cached for the trace drawer); the stored preview shows until then.
 */
export function TraceErrorDetails({ traceId, spanId, errorPreview }: TraceErrorDetailsProps) {
  const { data, isError } = useSpanDetail({ traceId, spanId });
  const error = data && describeSpanError(asCoreSpan(data.span));

  if (error) return <TraceErrorSummary name={error.name ?? 'Error'} message={error.message} />;

  if (isError) {
    return <TraceErrorSummary name="Error" message={errorPreview} notice="Couldn't load the full error." />;
  }

  return <TraceErrorSummary name="Error" message={errorPreview} />;
}
