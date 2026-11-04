import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { OBSERVABILITY_APP_TOOLS, routeQuerySchema, routeResponseSchema } from '@mastra/mcp-apps-components/observability-protocol';
import type { ObservabilityAppToolName, RouteResponse } from '@mastra/mcp-apps-components/observability-protocol';
import { SERVER_ROUTES, invokeRoute } from '@mastra/server/server-adapter';

function isMastra(value: unknown): value is Mastra {
  return typeof (value as Partial<Mastra> | undefined)?.getServer === 'function';
}

// The dashboard app reads its data through these tools, by the names and routes the contract gives.
// Each one runs its Mastra route in-process as the caller, with the route's own validation and
// permission checks, so the app sees exactly what the signed-in user can read over HTTP.
function routeTool(id: ObservabilityAppToolName) {
  const { method, path } = OBSERVABILITY_APP_TOOLS[id];
  const route = SERVER_ROUTES.find(candidate => candidate.method === method && candidate.path === path);
  if (!route) throw new Error(`No Mastra route answers ${method} ${path}`);
  const readsQuery = method === 'GET';

  return createTool({
    id,
    description: route.openapi?.summary ?? `${method} ${path}`,
    inputSchema: readsQuery ? routeQuerySchema : route.bodySchema,
    outputSchema: routeResponseSchema,
    // Apps call it; hosts keep it away from the model.
    mcp: { _meta: { ui: { visibility: ['app'] } } },
    execute: async (input, { mastra, requestContext, abortSignal }): Promise<RouteResponse> => {
      if (!isMastra(mastra)) return { status: 503, body: { error: `${id} needs a Mastra instance.` } };
      return invokeRoute(route, {
        mastra,
        // Without the caller's context, a server with auth refuses the call.
        requestContext: requestContext ?? new RequestContext(),
        ...(readsQuery ? { query: routeQuerySchema.parse(input) } : { body: input }),
        abortSignal,
      });
    },
  });
}

export const observabilityAppTools = Object.fromEntries(
  (Object.keys(OBSERVABILITY_APP_TOOLS) as ObservabilityAppToolName[]).map(id => [id, routeTool(id)]),
) as Record<ObservabilityAppToolName, ReturnType<typeof routeTool>>;
