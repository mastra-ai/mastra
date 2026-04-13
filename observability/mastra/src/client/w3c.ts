/**
 * Hand-rolled W3C Trace Context and Baggage propagation.
 *
 * The full propagators in `@opentelemetry/core` weigh ~27KB gzipped.
 * The W3C specs (https://www.w3.org/TR/trace-context/, https://www.w3.org/TR/baggage/)
 * are simple text formats; for the small subset we need (parse and
 * format `traceparent`, parse and format `baggage`), hand-rolling is
 * cheaper and avoids adding an OTEL dependency to @mastra/observability.
 */

const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceparentParts {
  /** Version, currently always "00". */
  version: string;
  /** 32 hex chars. */
  traceId: string;
  /** 16 hex chars. Refers to the parent span this carrier identifies. */
  spanId: string;
  /** 2 hex chars. Bit 0 is the sampled flag. */
  flags: string;
}

export function parseTraceparent(value: string | undefined): TraceparentParts | null {
  if (!value) return null;
  const m = TRACEPARENT_RE.exec(value.trim());
  if (!m) return null;
  return { version: m[1]!, traceId: m[2]!, spanId: m[3]!, flags: m[4]! };
}

export function formatTraceparent(traceId: string, spanId: string, sampled: boolean): string {
  return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
}

/**
 * Parse a W3C Baggage header value into a Map.
 *
 * Format: `key=value,key2=value2;property=...`
 * Properties (after `;`) are ignored — we don't use them.
 * Values are percent-decoded per the spec.
 */
export function parseBaggage(value: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!value) return out;
  for (const entry of value.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    // Strip optional `;property=...` suffix
    const semi = trimmed.indexOf(';');
    const head = semi === -1 ? trimmed : trimmed.slice(0, semi);
    const eq = head.indexOf('=');
    if (eq === -1) continue;
    const key = head.slice(0, eq).trim();
    const rawValue = head.slice(eq + 1).trim();
    if (!key) continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawValue);
    } catch {
      decoded = rawValue;
    }
    out.set(key, decoded);
  }
  return out;
}

/**
 * Format a Map into a W3C Baggage header value.
 * Values are percent-encoded.
 */
export function formatBaggage(entries: Map<string, string> | Record<string, string>): string {
  const iter = entries instanceof Map ? entries.entries() : Object.entries(entries);
  const parts: string[] = [];
  for (const [key, value] of iter) {
    if (!key) continue;
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join(',');
}
