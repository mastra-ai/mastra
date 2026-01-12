import { RequestContext } from '@mastra/core/request-context';

/**
 * Builds a RequestContext from a plain object.
 * This extracts the common context building logic.
 */
export function buildRequestContext(contextData?: Record<string, unknown>): RequestContext {
  const requestContext = new RequestContext();

  if (contextData) {
    Object.entries(contextData).forEach(([key, value]) => {
      requestContext.set(key as keyof RequestContext, value);
    });
  }

  return requestContext;
}
