/**
 * W3C Trace Context `traceparent` parsing and formatting.
 * @see https://www.w3.org/TR/trace-context/#traceparent-header
 */

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/** The parts of a W3C `traceparent`. */
export interface TraceparentParts {
  /** Version, currently always "00". */
  version: string;
  /** 32 hex chars. */
  traceId: string;
  /** 16 hex chars. The span this `traceparent` names. */
  spanId: string;
  /** 2 hex chars. Bit 0 is the sampled flag. */
  flags: string;
}

/** Parses a W3C `traceparent`. Values that aren't strings, are malformed, or use all-zero IDs yield `null`. */
export function parseTraceparent(value: unknown): TraceparentParts | null {
  if (typeof value !== 'string') return null;
  const match = TRACEPARENT_RE.exec(value.trim());
  if (!match) return null;
  const [, version, traceId, spanId, flags] = match as unknown as [string, string, string, string, string];
  if (version === 'ff' || /^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;
  return { version, traceId, spanId, flags };
}

/** Formats a W3C `traceparent` for a span. */
export function formatTraceparent(traceId: string, spanId: string, sampled: boolean): string {
  return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
}
