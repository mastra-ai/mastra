import { formatTraceparent, parseTraceparent, resolveExportedSpanId } from '@mastra/core/observability';
import type { AnySpan, SpanLink } from '@mastra/core/observability';

/**
 * W3C trace fields carried in MCP request `_meta` (SEP-414).
 *
 * `tracestate` and `baggage` are passed through as opaque strings. Treat inbound
 * values, especially `baggage`, as untrusted observability data: never use them
 * for authentication or authorization.
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

/**
 * Request params without the W3C trace fields in `_meta`. They are removed
 * whenever present, valid or not: a valid caller span is recorded as a link,
 * and `tracestate` and `baggage` are untrusted data the span doesn't need.
 */
export function withoutTraceContext(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const meta = params?._meta;
  if (
    !meta ||
    typeof meta !== 'object' ||
    Array.isArray(meta) ||
    ![TRACEPARENT_META_KEY, TRACESTATE_META_KEY, BAGGAGE_META_KEY].some(key => key in meta)
  ) {
    return params;
  }
  const {
    [TRACEPARENT_META_KEY]: _traceparent,
    [TRACESTATE_META_KEY]: _tracestate,
    [BAGGAGE_META_KEY]: _baggage,
    ...restMeta
  } = meta as Record<string, unknown>;
  const { _meta, ...rest } = params!;
  return Object.keys(restMeta).length > 0 ? { ...rest, _meta: restMeta } : rest;
}

/** A caller's W3C trace context, read from a request that named a valid `traceparent`. */
export interface CallerTraceContext {
  /** The caller's span, as a link target. */
  link: SpanLink;
  /** The `traceparent` the caller sent. */
  traceparent: string;
  /** The `tracestate` sent with it, capped with {@link capTracestate}. */
  tracestate?: string;
}

/**
 * Reads the caller's trace context from a `traceparent` and its `tracestate`.
 * A `traceparent` that doesn't parse yields nothing, and its `tracestate` is
 * ignored with it, as the W3C spec requires.
 */
export function callerTraceContext(traceparent: unknown, tracestate: unknown): CallerTraceContext | undefined {
  const parts = parseTraceparent(traceparent);
  if (!parts) return undefined;
  const cappedTracestate = typeof tracestate === 'string' ? capTracestate(tracestate) : undefined;
  return {
    link: { traceId: parts.traceId, spanId: parts.spanId },
    traceparent: (traceparent as string).trim(),
    ...(cappedTracestate ? { tracestate: cappedTracestate } : {}),
  };
}

const TRACESTATE_MAX_LENGTH = 512;
const TRACESTATE_MAX_MEMBERS = 32;
const TRACESTATE_LONG_MEMBER = 128;

/**
 * Caps a `tracestate` at 512 characters the way the W3C spec asks: keep at most
 * 32 entries, drop entries longer than 128 characters first, then drop entries
 * from the end. Entries are never cut in the middle.
 * @see https://www.w3.org/TR/trace-context/#tracestate-limits
 */
export function capTracestate(value: string): string | undefined {
  let members = value
    .split(',')
    .map(member => member.trim())
    .filter(Boolean)
    .slice(0, TRACESTATE_MAX_MEMBERS);
  const length = () => members.join(',').length;
  if (length() > TRACESTATE_MAX_LENGTH) {
    members = members.filter(member => member.length <= TRACESTATE_LONG_MEMBER);
  }
  while (members.length > 0 && length() > TRACESTATE_MAX_LENGTH) members.pop();
  return members.length > 0 ? members.join(',') : undefined;
}

/**
 * The trace context that makes `span` the parent of an outgoing request. A span
 * that is not recorded, or whose ids are not W3C-sized, propagates nothing. A
 * span hidden from exporters is replaced by its closest exported ancestor.
 */
export function traceContextFromSpan(span: AnySpan | undefined): MCPTraceContext | undefined {
  if (!span?.isValid) return undefined;
  const traceparent = formatTraceparent(span.traceId, resolveExportedSpanId(span) ?? '', true);
  return parseTraceparent(traceparent) ? { traceparent } : undefined;
}

/**
 * Reply `_meta` key under which a Mastra server returns the `traceparent` of the
 * span that served the request, so the caller can link back to it.
 */
const MASTRA_META_KEY = 'mastra';
const SERVER_TRACEPARENT_KEY = 'traceparent';

/**
 * Adds the `traceparent` of `span`, the span serving the request, to the reply
 * `_meta`. Only callers that sent their own trace context get it back.
 */
export function withServerTraceContext<T>(result: T, span: AnySpan | undefined, callerSentTrace: boolean): T {
  const traceparent = callerSentTrace ? traceContextFromSpan(span)?.traceparent : undefined;
  if (!traceparent || !result || typeof result !== 'object' || Array.isArray(result)) return result;
  const meta = (result as { _meta?: Record<string, unknown> })._meta ?? {};
  const mastraMeta = meta[MASTRA_META_KEY];
  return {
    ...result,
    _meta: {
      ...meta,
      [MASTRA_META_KEY]: {
        ...(mastraMeta && typeof mastraMeta === 'object' ? mastraMeta : {}),
        [SERVER_TRACEPARENT_KEY]: traceparent,
      },
    },
  };
}

/**
 * Splits the server's span out of a reply: returns the span the server named in
 * its reply `_meta`, if any, and the reply without that key.
 */
export function takeServerTraceContext<T>(result: T): { result: T; serverSpan?: SpanLink } {
  const meta = (result as { _meta?: Record<string, unknown> } | undefined)?._meta;
  const mastraMeta = meta?.[MASTRA_META_KEY];
  if (!mastraMeta || typeof mastraMeta !== 'object' || !(SERVER_TRACEPARENT_KEY in mastraMeta)) return { result };
  const { [SERVER_TRACEPARENT_KEY]: traceparent, ...restMastra } = mastraMeta as Record<string, unknown>;
  const { [MASTRA_META_KEY]: _mastra, ...restMeta } = meta!;
  const nextMeta = Object.keys(restMastra).length > 0 ? { ...restMeta, [MASTRA_META_KEY]: restMastra } : restMeta;
  const { _meta, ...rest } = result as Record<string, unknown>;
  const parts = parseTraceparent(traceparent);
  return {
    result: (Object.keys(nextMeta).length > 0 ? { ...rest, _meta: nextMeta } : rest) as T,
    ...(parts ? { serverSpan: { traceId: parts.traceId, spanId: parts.spanId } } : {}),
  };
}
