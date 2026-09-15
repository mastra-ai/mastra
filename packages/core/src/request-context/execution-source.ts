import type { RequestContext } from './index';

// Only native context views carry this in-process lineage. Context entries,
// schema forwarding symbols, and serialized snapshots cannot grant it.
const executionSources = new WeakMap<RequestContext, RequestContext>();

/** @internal */
export function registerRequestContextExecutionSource(view: RequestContext, source: RequestContext): void {
  executionSources.set(view, getRequestContextExecutionSource(source)!);
}

/** @internal */
export function getRequestContextExecutionSource(context?: RequestContext): RequestContext | undefined {
  return context ? (executionSources.get(context) ?? context) : undefined;
}
