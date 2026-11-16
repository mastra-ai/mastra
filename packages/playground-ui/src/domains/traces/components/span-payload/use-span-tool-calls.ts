import { useTraceSpans } from '@mastra/react/hooks/traces';
import type { SpanRecord } from '../../types';
import { formatSpanToolCallMessages } from '../format-trace-thread-messages';

/** The tool calls a span requested, paired with the results their tool spans recorded. */
export function useSpanToolCalls(span: SpanRecord) {
  // The results live on the tool spans, which the trace panel has usually loaded already.
  const { data } = useTraceSpans({ traceId: span.traceId, passive: true });
  return formatSpanToolCallMessages(span, data?.spans ?? []);
}
