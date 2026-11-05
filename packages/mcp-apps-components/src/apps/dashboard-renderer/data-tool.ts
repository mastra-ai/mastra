import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { MCPToolExecutionContext } from '@mastra/core/tools';
import {
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataInputSchema,
  dashboardDataOutputSchema,
} from './data';
import type { DashboardDataOperation, DashboardDataOutput } from './data';

/** One dashboard read, as `prepareRequest` sees it. */
export interface DashboardDataCall {
  operation: DashboardDataOperation;
  /** The Mastra route path for the operation, without the API prefix, e.g. `/observability/metrics/aggregate`. */
  path: string;
  /** The project the app asked for. Not trusted: check the caller can read it. */
  projectId?: string;
  /** The caller's bearer token, which the tool sends as `authorization` unless `headers` sets one. */
  token?: string;
  /** The MCP call's context, with the caller's `authInfo`. Absent when Studio relays the call. */
  mcp?: MCPToolExecutionContext;
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
}

/** Where to send a read, or the answer to give without sending it. */
export type DashboardDataRequest =
  | { url: string | URL; headers?: Record<string, string> }
  | { response: DashboardDataOutput };

export interface DashboardDataToolOptions {
  /**
   * Decides, for each read, the URL to send it to and the headers to send with it, or answers it
   * with `{ response }` without sending anything. The tool adds the operation's method, query
   * parameters and JSON body.
   */
  prepareRequest: (call: DashboardDataCall) => DashboardDataRequest | Promise<DashboardDataRequest>;
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
 * It only sends the reads in `DASHBOARD_DATA_REQUESTS`, each to the URL `prepareRequest` returns,
 * with the caller's bearer token as `authorization` unless the returned headers set their own.
 */
export function createDashboardDataTool({ prepareRequest }: DashboardDataToolOptions) {
  return createTool({
    id: DASHBOARD_DATA_TOOL_NAME,
    description: 'Reads observability data for the Mastra dashboard app.',
    inputSchema: dashboardDataInputSchema,
    outputSchema: dashboardDataOutputSchema,
    // Apps call it; hosts keep it away from the model.
    mcp: { _meta: { ui: { visibility: ['app'] } } },
    execute: async (
      { operation, query, body, projectId },
      { requestContext, mcp, abortSignal },
    ): Promise<DashboardDataOutput> => {
      const [method, path] = DASHBOARD_DATA_REQUESTS[operation].split(' ') as [string, string];
      // An MCP transport carries the caller's token on `authInfo`; Studio's tool-execute relay on the request context.
      const caller = mcp?.extra.authInfo?.token || requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
      const token = typeof caller === 'string' && caller ? caller : undefined;

      const prepared = await prepareRequest({ operation, path, projectId, token, mcp, requestContext, abortSignal });
      if ('response' in prepared) return prepared.response;

      const url = new URL(prepared.url);
      for (const [key, value] of Object.entries(query ?? {})) {
        for (const item of [value].flat()) url.searchParams.append(key, item);
      }
      // `Headers` matches names case-insensitively, so `Authorization` replaces the caller's token too.
      const headers = new Headers({
        ...(token && { authorization: `Bearer ${token}` }),
        ...(body && { 'content-type': 'application/json' }),
      });
      for (const [name, value] of Object.entries(prepared.headers ?? {})) headers.set(name, value);

      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          ...(body && { body: JSON.stringify(body) }),
          signal: abortSignal,
        });
      } catch (error) {
        if (abortSignal?.aborted) throw error;
        return { status: 502, body: { error: `Couldn't reach ${url.origin}: ${(error as Error).message}` } };
      }
      return { status: response.status, body: readBody(await response.text(), response.statusText) };
    },
  });
}
