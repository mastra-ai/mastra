import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  REQUEST_TOOL_NAME,
  requestToolInputSchema,
  requestToolOutputSchema,
} from '@mastra/mcp-apps-components/request-tool';
import type { RequestToolOutput } from '@mastra/mcp-apps-components/request-tool';
import { SERVER_ROUTES, invokeRoute } from '@mastra/server/server-adapter';

// The read-only observability routes the dashboard app may reach. `visibility: ['app']` only keeps
// the tool away from the model; it doesn't stop a direct call, so this list is what bounds it.
const ALLOWED_ROUTES = new Set([
  'POST /observability/traces/aggregate',
  'POST /observability/spans/aggregate',
  'POST /observability/metrics/aggregate',
  'POST /observability/metrics/breakdown',
  'POST /observability/metrics/timeseries',
  'POST /observability/metrics/percentiles',
  'GET /observability/scores',
  'POST /observability/scores/aggregate',
  'POST /observability/scores/breakdown',
  'POST /observability/scores/timeseries',
  'POST /observability/scores/percentiles',
]);

const routes = SERVER_ROUTES.filter(route => ALLOWED_ROUTES.has(`${route.method} ${route.path}`));
const missing = [...ALLOWED_ROUTES].filter(key => !routes.some(route => `${route.method} ${route.path}` === key));
if (missing.length > 0) throw new Error(`No Mastra route answers ${missing.join(', ')}`);

function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

// The dashboard app sends each request its MastraClient makes through this tool. It runs the matching
// Mastra route in-process as the caller, with the route's own validation and permission checks, so the
// app sees exactly what the signed-in user can read over HTTP.
export const mastraRequestTool = createTool({
  id: REQUEST_TOOL_NAME,
  description: 'Runs a read-only observability route for the dashboard app.',
  inputSchema: requestToolInputSchema,
  outputSchema: requestToolOutputSchema,
  // Apps call it; hosts keep it away from the model.
  mcp: { _meta: { ui: { visibility: ['app'] } } },
  execute: async (
    { method, path, query, body },
    { mastra, requestContext, abortSignal },
  ): Promise<RequestToolOutput> => {
    const route = routes.find(candidate => candidate.method === method && candidate.path === path);
    if (!route) return { status: 404, body: { error: `${method} ${path} is not available to MCP Apps.` } };
    if (!isMastra(mastra)) return { status: 503, body: { error: `${REQUEST_TOOL_NAME} needs a Mastra instance.` } };
    return invokeRoute(route, {
      mastra,
      // Without the caller's context, a server with auth refuses the call.
      requestContext: requestContext ?? new RequestContext(),
      ...(query && { query }),
      ...(body !== undefined && { body }),
      abortSignal,
    });
  },
});
