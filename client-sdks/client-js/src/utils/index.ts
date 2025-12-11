import { RequestContext } from '@mastra/core/request-context';

/**
 * Checks if a value is a "complex" type that needs JSON serialization for query params.
 * Complex types: objects (excluding Date), arrays
 * Primitive types: string, number, boolean, null, undefined, Date
 */
function isComplexValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return false;
  return typeof value === 'object';
}

/**
 * Serializes a value for use in URL query parameters.
 * - Primitives (string, number, boolean): converted to string
 * - Date: converted to ISO string
 * - Complex types (objects, arrays): JSON-stringified
 */
function serializeQueryValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isComplexValue(value)) {
    return JSON.stringify(value, (_key, val) => {
      // Handle Date objects inside nested structures
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val;
    });
  }
  return String(value);
}

/**
 * Converts a nested params object to flat URL query parameters.
 *
 * This mirrors the server's `wrapSchemaForQueryParams` behavior:
 * - Flattens specified nested keys to top-level params
 * - JSON-stringifies complex values (objects, arrays)
 * - Converts primitives to strings
 * - Handles Date objects by converting to ISO strings
 *
 * @param params - The params object to convert
 * @param flattenKeys - Keys whose values should be flattened to top-level params
 *
 * @example
 * ```ts
 * toQueryParams(
 *   {
 *     pagination: { page: 0, perPage: 10 },
 *     filters: { spanType: 'agent_run', startedAt: { start: new Date() } },
 *     orderBy: { field: 'startedAt', direction: 'DESC' }
 *   },
 *   ['filters', 'pagination', 'orderBy']
 * )
 * // Returns: "page=0&perPage=10&spanType=agent_run&startedAt=%7B%22start%22%3A%222024-...%22%7D&field=startedAt&direction=DESC"
 * ```
 */
export function toQueryParams<T extends Record<string, unknown>>(params: T, flattenKeys: (keyof T)[] = []): string {
  const searchParams = new URLSearchParams();
  const keysToFlatten = flattenKeys as string[];

  function addParams(obj: Record<string, unknown>) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      // Flatten specified nested objects
      if (
        keysToFlatten.includes(key) &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        addParams(value as Record<string, unknown>);
      } else {
        searchParams.set(key, serializeQueryValue(value));
      }
    }
  }

  addParams(params);
  return searchParams.toString();
}

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
