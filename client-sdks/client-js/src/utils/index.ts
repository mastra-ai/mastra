import { RuntimeContext } from '@mastra/core/runtime-context';

export function parseClientRuntimeContext(runtimeContext?: RuntimeContext | Record<string, any>) {
  if (runtimeContext) {
    if (runtimeContext instanceof RuntimeContext) {
      return Object.fromEntries(runtimeContext.entries());
    }
    return runtimeContext;
  }
  return undefined;
}

export function base64RuntimeContext(runtimeContext?: Record<string, any>): string | undefined {
  if (runtimeContext) {
    return btoa(JSON.stringify(runtimeContext));
  }
  return undefined;
}

/**
 * Converts a runtime context to a query string
 * @param runtimeContext - The runtime context to convert
 * @param delimiter - The delimiter to use in the query string
 * @returns The query string
 */
export function runtimeContextQueryString(
  runtimeContext?: RuntimeContext | Record<string, any>,
  delimiter: string = '?',
): string {
  const runtimeContextParam = base64RuntimeContext(parseClientRuntimeContext(runtimeContext));
  if (!runtimeContextParam) return '';
  const searchParams = new URLSearchParams();
  searchParams.set('runtimeContext', runtimeContextParam);
  const queryString = searchParams.toString();
  return queryString ? `${delimiter}${queryString}` : '';
}
