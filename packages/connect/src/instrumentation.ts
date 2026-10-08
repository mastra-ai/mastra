import { AsyncLocalStorage } from 'node:async_hooks';

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
 * Privacy invariant: spans carry method, a safe route template, connection id,
 * and response status only. Never record query strings, headers, request
 * bodies, response bodies, or vendor path segments — proxy paths are built by
 * generated templates and can embed credentials or resource identifiers (e.g.
 * HubSpot's whoami interpolates the access token into its endpoint path).
 */

export interface PlatformCallDescriptor {
  method: string;
  /**
   * Safe route template: connection/project ids replaced with placeholders
   * and everything after `/proxy/` collapsed to `*` so vendor-controlled
   * path segments (which may embed secrets or PII) never enter spans.
   */
  route: string;
  isProxy: boolean;
  connectionId?: string;
  projectId?: string;
}

const ID_SEGMENT_ROUTES = [
  { prefix: '/v2/connections/', placeholder: '{connectionId}', key: 'connectionId' as const },
  { prefix: '/v2/projects/', placeholder: '{projectId}', key: 'projectId' as const },
];

const PROXY_SEGMENT = '/proxy/';

/** Describes a platform request for span naming without leaking query params, ids, or vendor path segments. */
export function describePlatformCall(method: string, rawPath: string): PlatformCallDescriptor {
  const path = rawPath.split('?')[0]!;
  let route = path;
  const descriptor: PlatformCallDescriptor = { method, route, isProxy: false };
  for (const idRoute of ID_SEGMENT_ROUTES) {
    if (!path.startsWith(idRoute.prefix)) continue;
    const rest = path.slice(idRoute.prefix.length);
    const slash = rest.indexOf('/');
    const id = slash === -1 ? rest : rest.slice(0, slash);
    const tail = slash === -1 ? '' : rest.slice(slash);
    descriptor[idRoute.key] = safeDecode(id);
    route = `${idRoute.prefix}${idRoute.placeholder}${tail}`;
    break;
  }
  const proxyIndex = route.indexOf(PROXY_SEGMENT);
  if (proxyIndex !== -1) {
    descriptor.isProxy = true;
    route = `${route.slice(0, proxyIndex + PROXY_SEGMENT.length)}*`;
  }
  descriptor.route = route;
  return descriptor;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const untraced = new AsyncLocalStorage<true>();

export function runUntraced<T>(fn: () => T): T {
  return untraced.run(true, fn);
}

/**
 * Starts a GENERIC child span for an outbound connect HTTP call, or returns
 * `undefined` when no ambient span is active. Span creation failures are
 * swallowed: instrumentation must never break a request.
 */
export function startPlatformCallSpan(descriptor: PlatformCallDescriptor): Span<SpanType.GENERIC> | undefined {
  let parent: AnySpan | undefined;
  if (untraced.getStore()) return undefined;
  try {
    parent = resolveCurrentSpan();
    if (!parent) return undefined;
    return parent.createChildSpan({
      type: SpanType.GENERIC,
      name: `connect.${descriptor.isProxy ? 'proxy' : 'platform'} ${descriptor.method} ${descriptor.route}`,
      metadata: {
        method: descriptor.method,
        route: descriptor.route,
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

/**
 * Records a transport-level failure on a platform-call span. Nothing from the
 * original error is recorded — fetch failures can embed the request URL in
 * both `message` and `name`, which may carry secret query params — so the
 * span gets a fixed, constant error. Never throws.
 */
export function errorPlatformCallSpan(span: Span<SpanType.GENERIC> | undefined, _error: unknown): void {
  if (!span) return;
  try {
    span.error({ error: new Error('connect request failed'), endSpan: true });
  } catch {
    // instrumentation must never break a request
  }
}
