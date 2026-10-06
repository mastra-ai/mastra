import { resolveCurrentSpan, SpanType } from '@mastra/core/observability';
import type { AnySpan, Span } from '@mastra/core/observability';

/**
 * Observability for outbound connect HTTP: every platform API call and every
 * vendor call routed through the connection proxy gets a GENERIC child span
 * under the ambient current span (the TOOL_CALL span during tool execution,
 * or whatever span is active during resolver refreshes).
 *
 * Resolution uses core's browser-safe `resolveCurrentSpan`, which returns
 * `undefined` until the Mastra constructor initializes context storage — so
 * apps without observability configured pay nothing and nothing throws.
 *
 * Privacy invariant: spans carry method, normalized path, connection id, and
 * response status only. Never record query strings, headers, request bodies,
 * or response bodies — proxy traffic routinely contains vendor data and the
 * credentials endpoint returns secrets.
 */

export interface PlatformCallDescriptor {
  method: string;
  /** Request path with the query string stripped. */
  path: string;
  /** Path with the connection/project id segment replaced, for grouping. */
  normalizedPath: string;
  connectionId?: string;
  projectId?: string;
}

const ID_SEGMENT_ROUTES = [
  { prefix: '/v2/connections/', placeholder: '{connectionId}', key: 'connectionId' as const },
  { prefix: '/v2/projects/', placeholder: '{projectId}', key: 'projectId' as const },
];

/** Describes a platform request path for span naming without leaking query params. */
export function describePlatformCall(method: string, rawPath: string): PlatformCallDescriptor {
  const path = rawPath.split('?')[0]!;
  const descriptor: PlatformCallDescriptor = { method, path, normalizedPath: path };
  for (const route of ID_SEGMENT_ROUTES) {
    if (!path.startsWith(route.prefix)) continue;
    const rest = path.slice(route.prefix.length);
    const slash = rest.indexOf('/');
    const id = slash === -1 ? rest : rest.slice(0, slash);
    const tail = slash === -1 ? '' : rest.slice(slash);
    descriptor[route.key] = safeDecode(id);
    descriptor.normalizedPath = `${route.prefix}${route.placeholder}${tail}`;
    break;
  }
  return descriptor;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Starts a GENERIC child span for an outbound connect HTTP call, or returns
 * `undefined` when no ambient span is active. Span creation failures are
 * swallowed: instrumentation must never break a request.
 */
export function startPlatformCallSpan(descriptor: PlatformCallDescriptor): Span<SpanType.GENERIC> | undefined {
  let parent: AnySpan | undefined;
  try {
    parent = resolveCurrentSpan();
    if (!parent) return undefined;
    const isProxy = descriptor.normalizedPath.includes('/proxy/');
    return parent.createChildSpan({
      type: SpanType.GENERIC,
      name: `connect.${isProxy ? 'proxy' : 'platform'} ${descriptor.method} ${descriptor.normalizedPath}`,
      metadata: {
        method: descriptor.method,
        path: descriptor.path,
        ...(descriptor.connectionId ? { connectionId: descriptor.connectionId } : {}),
        ...(descriptor.projectId ? { projectId: descriptor.projectId } : {}),
      },
    });
  } catch {
    return undefined;
  }
}

/** Ends a platform-call span with the response status. Never throws. */
export function endPlatformCallSpan(span: Span<SpanType.GENERIC> | undefined, status: number): void {
  if (!span) return;
  try {
    span.end({ metadata: { status } });
  } catch {
    // instrumentation must never break a request
  }
}

/** Records a transport-level failure on a platform-call span. Never throws. */
export function errorPlatformCallSpan(span: Span<SpanType.GENERIC> | undefined, error: unknown): void {
  if (!span) return;
  try {
    span.error({
      error: error instanceof Error ? error : new Error(String(error)),
      endSpan: true,
    });
  } catch {
    // instrumentation must never break a request
  }
}
