import { RequestContext } from '@mastra/core/request-context';

export function parseClientRequestContext(requestContext?: RequestContext | Record<string, any>) {
  if (requestContext) {
    if (requestContext instanceof RequestContext) {
      return Object.fromEntries(requestContext.entries());
    }
    return requestContext;
  }
  return undefined;
}

export function base64RequestContext(requestContext?: Record<string, any>): string | undefined {
  if (requestContext) {
    return btoa(JSON.stringify(requestContext));
  }
  return undefined;
}

/**
 * Converts a request context to a query string
 * @param requestContext - The request context to convert
 * @param delimiter - The delimiter to use in the query string
 * @returns The query string
 */
export function requestContextQueryString(
  requestContext?: RequestContext | Record<string, any>,
  delimiter: string = '?',
): string {
  const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));
  if (!requestContextParam) return '';
  const searchParams = new URLSearchParams();
  searchParams.set('requestContext', requestContextParam);
  const queryString = searchParams.toString();
  return queryString ? `${delimiter}${queryString}` : '';
}
