/**
 * W3C trace fields carried in MCP request `_meta` (SEP-414).
 *
 * Mastra passes these strings through without creating spans or validating
 * their format. Treat inbound values, especially `baggage`, as untrusted
 * observability data: never use them for authentication or authorization.
 */
export interface MCPTraceContext {
  traceparent: string;
  tracestate?: string;
  baggage?: string;
}

/** `_meta` keys defined by the MCP specification for W3C trace propagation. */
const TRACEPARENT_META_KEY = 'traceparent';
const TRACESTATE_META_KEY = 'tracestate';
const BAGGAGE_META_KEY = 'baggage';

/**
 * Reads the W3C trace fields out of request metadata. Only string values are
 * accepted; a request without a `traceparent` carries no trace context.
 */
export function traceContextFromMeta(meta: Record<string, unknown> | undefined): MCPTraceContext | undefined {
  const traceparent = meta?.[TRACEPARENT_META_KEY];
  if (typeof traceparent !== 'string') return undefined;
  const tracestate = meta?.[TRACESTATE_META_KEY];
  const baggage = meta?.[BAGGAGE_META_KEY];
  return {
    traceparent,
    ...(typeof tracestate === 'string' ? { tracestate } : {}),
    ...(typeof baggage === 'string' ? { baggage } : {}),
  };
}

/** Projects a trace context onto the `_meta` keys the specification defines. */
export function traceContextToMeta(traceContext: MCPTraceContext): Record<string, string> {
  return {
    [TRACEPARENT_META_KEY]: traceContext.traceparent,
    ...(traceContext.tracestate !== undefined ? { [TRACESTATE_META_KEY]: traceContext.tracestate } : {}),
    ...(traceContext.baggage !== undefined ? { [BAGGAGE_META_KEY]: traceContext.baggage } : {}),
  };
}
