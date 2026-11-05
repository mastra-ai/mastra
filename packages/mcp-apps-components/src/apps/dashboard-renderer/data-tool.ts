import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataInputSchema,
  dashboardDataOutputSchema,
} from './data';
import type { DashboardDataOutput } from './data';

export interface DashboardDataToolOptions {
  /** Origin of the Mastra server whose observability API answers the reads, e.g. `http://localhost:4111`. */
  baseUrl: string | URL;
  /** The server's API prefix. Defaults to `/api`, as a Mastra server's `server.apiPrefix` does. */
  apiPrefix?: string;
  /**
   * Headers sent with every read. Without an `authorization` header, the tool forwards the caller's
   * bearer token, so the server answers as the signed-in user.
   */
  headers?: Record<string, string>;
  /** The `fetch` to send reads with. Defaults to the global one. */
  fetch?: typeof fetch;
}

function readBody(text: string, statusText: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || statusText };
  }
}

/**
 * Creates the app-only tool the dashboard reads its data through. Register it next to
 * `dashboardRendererApp`, under the key `dashboardDataTool`, on the MCP server that serves the app.
 * Each read is sent to the matching observability route of the Mastra server at `baseUrl`, so the
 * route's own validation, authentication, permission and FGA checks apply, and the app sees exactly
 * the data the caller can read over HTTP. It only sends the reads in `DASHBOARD_DATA_REQUESTS`, and
 * it ignores a call's `projectId`, since a Mastra server holds one project.
 */
export function createDashboardDataTool({
  baseUrl,
  apiPrefix = '/api',
  headers = {},
  fetch: send = globalThis.fetch,
}: DashboardDataToolOptions) {
  const root = `${String(baseUrl).replace(/\/+$/, '')}${apiPrefix.replace(/\/+$/, '')}`;
  const hasAuthorization = Object.keys(headers).some(name => name.toLowerCase() === 'authorization');

  return createTool({
    id: DASHBOARD_DATA_TOOL_NAME,
    description: 'Reads observability data for the Mastra dashboard app.',
    inputSchema: dashboardDataInputSchema,
    outputSchema: dashboardDataOutputSchema,
    // Apps call it; hosts keep it away from the model.
    mcp: { _meta: { ui: { visibility: ['app'] } } },
    execute: async ({ operation, query, body }, { requestContext, mcp, abortSignal }): Promise<DashboardDataOutput> => {
      const [method, path] = DASHBOARD_DATA_REQUESTS[operation].split(' ') as [string, string];
      const url = new URL(`${root}${path}`);
      for (const [key, value] of Object.entries(query ?? {})) {
        for (const item of [value].flat()) url.searchParams.append(key, item);
      }

      // An MCP transport carries the caller's token on `authInfo`; Studio's tool-execute relay on the request context.
      const token = mcp?.extra.authInfo?.token || requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
      const requestHeaders: Record<string, string> = {
        ...(!hasAuthorization && typeof token === 'string' && token && { authorization: `Bearer ${token}` }),
        ...(body && { 'content-type': 'application/json' }),
        ...headers,
      };

      let response: Response;
      try {
        response = await send(url, {
          method,
          headers: requestHeaders,
          ...(body && { body: JSON.stringify(body) }),
          signal: abortSignal,
        });
      } catch (error) {
        if (abortSignal?.aborted) throw error;
        return {
          status: 502,
          body: { error: `Couldn't reach the Mastra server at ${root}: ${(error as Error).message}` },
        };
      }
      return { status: response.status, body: readBody(await response.text(), response.statusText) };
    },
  });
}
