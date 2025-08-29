export function safelyParseJSON(input: any): any {
  // If already an object (and not null), return as-is
  if (input && typeof input === 'object') return input;
  if (input == null) return {};
  // If it's a string, try to parse
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  // For anything else (number, boolean, etc.), return empty object
  return {};
}

// HTTP instrumentation spans are root spans but add noise to trace visualization.
// Remove them entirely and promote their direct children to root spans for cleaner UI display.
export function removeHttpInstrumentationParents(spans: any[]): any[] {
  const httpInstrumentationSpanIds = new Set(
    spans
      .filter(span => span.instrumentationScope?.name?.name === '@opentelemetry/instrumentation-http') // Find them
      .map(span => span.spanId),
  );

  return spans
    .filter(span => span.instrumentationScope?.name?.name !== '@opentelemetry/instrumentation-http')
    .map(span => ({
      ...span,
      parentSpanId: httpInstrumentationSpanIds.has(span.parentSpanId || '') ? null : span.parentSpanId,
    }));
}
