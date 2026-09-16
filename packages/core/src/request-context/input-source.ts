import type { RequestContext } from './index';

/** @internal */
export const REQUEST_CONTEXT_INPUT_SOURCE = Symbol.for('mastra.core.request-context.input-source');

type RequestContextWithInputSource = RequestContext & {
  [REQUEST_CONTEXT_INPUT_SOURCE]?: RequestContext;
};

/**
 * Returns the input-form context that schema validation should consume.
 *
 * Schema-transformed execution views retain their source through a global
 * symbol so forwarding a view across tools or duplicated module instances does
 * not validate already-decoded values again.
 *
 * @internal
 */
export function getRequestContextInputSource(requestContext?: RequestContext): RequestContext | undefined {
  let current = requestContext as RequestContextWithInputSource | undefined;
  const seen = new Set<RequestContext>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const source = current[REQUEST_CONTEXT_INPUT_SOURCE];
    if (!source) {
      return current;
    }
    current = source as RequestContextWithInputSource;
  }

  return current;
}

/** @internal */
export function getRequestContextInputValues(requestContext?: RequestContext): Record<string, any> {
  return getRequestContextInputSource(requestContext)?.all ?? {};
}
