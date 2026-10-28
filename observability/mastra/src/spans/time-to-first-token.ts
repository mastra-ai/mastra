import { SpanType } from '@mastra/core/observability';

/**
 * Time to first token in milliseconds: from the start of the first MODEL_INFERENCE
 * to its first streamed chunk. A MODEL_INFERENCE span measures from its own start;
 * spans above it read the `inferenceStartTime` the tracker copied up. Undefined
 * when either clock is missing.
 */
export function getTimeToFirstTokenMs(span: {
  type: SpanType;
  startTime: Date | string;
  attributes?: object | undefined;
}): number | undefined {
  const attributes = span.attributes as
    | { inferenceStartTime?: Date | string; completionStartTime?: Date | string }
    | undefined;
  const start = span.type === SpanType.MODEL_INFERENCE ? span.startTime : attributes?.inferenceStartTime;
  const end = attributes?.completionStartTime;
  if (!start || !end) return undefined;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  // Clock skew between workers (durable runs) can put the first chunk before the start.
  return Number.isNaN(ms) ? undefined : Math.max(0, ms);
}
