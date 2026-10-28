import type { Mastra } from '@mastra/core/mastra';
import type { MCPHttpTransportResult } from '../handlers/mcp';
import { HTTPException } from '../http-exception';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import {
  BUILTIN_MCP_SERVER_ID,
  DEFAULT_BUILTIN_MCP_PATH,
  getBuiltinMCPTransportOptions,
  isBuiltinMCPEnabled,
  resolveBuiltinMCPConfig,
  resolveBuiltinMCPPath,
  warnOnReservedMCPServerId,
} from './config';

// Signs `input_required` continuation state; per process, like MCPServer's own default, without its per-instance warning.
const requestStateKey = globalThis.crypto.getRandomValues(new Uint8Array(32));

/**
 * The only place `@mastra/mcp` is loaded, so apps that never serve the built-in MCP endpoint never load the MCP SDK.
 * The catalogue is loaded here as well: it imports the server adapter, which imports this route.
 */
async function loadBuiltinMCP() {
  const [{ MCPServer }, { buildBuiltinMCPTools }] = await Promise.all([import('@mastra/mcp'), import('./catalogue')]);
  return { MCPServer, buildBuiltinMCPTools };
}

/** Dispatched routes see only the bearer credential, never cookies or the Studio client-type header. */
function bearerOnly(request: Request | undefined): Request | undefined {
  if (!request) return undefined;
  const authorization = request.headers.get('authorization');
  return new Request(request.url, { method: 'GET', headers: authorization ? { authorization } : {} });
}

/**
 * Streamable HTTP endpoint of the built-in Mastra MCP server (`/api/mcp` by default).
 *
 * Every request gets its own protocol engine holding only the tools this caller may use. Tool calls run
 * the backing server routes in-process with this request's RequestContext.
 */
export const BUILTIN_MCP_HTTP_ROUTE: ServerRoute = createRoute({
  method: 'ALL',
  path: DEFAULT_BUILTIN_MCP_PATH,
  responseType: 'mcp-http',
  summary: 'Mastra MCP server',
  description: 'Streamable HTTP endpoint of the built-in MCP server exposing agents, workflows, and tools',
  tags: ['MCP'],
  requiresAuth: true,
  requiresPermission: 'mcp:read',
  authTransport: 'bearer',
  handler: async ({
    mastra,
    requestContext,
    registeredTools,
    taskStore,
    routePrefix,
    abortSignal,
    request,
  }): Promise<MCPHttpTransportResult> => {
    if (!isBuiltinMCPEnabled(mastra)) {
      throw new HTTPException(404, { message: 'Not Found' });
    }
    warnOnReservedMCPServerId(mastra);
    const config = resolveBuiltinMCPConfig(mastra, request);
    const { MCPServer, buildBuiltinMCPTools } = await loadBuiltinMCP();
    const tools = await buildBuiltinMCPTools(
      {
        mastra,
        requestContext,
        registeredTools,
        taskStore,
        routePrefix,
        abortSignal,
        request: bearerOnly(request),
        mcpRoute: BUILTIN_MCP_HTTP_ROUTE,
      },
      config,
    );
    const { serverInfo } = config;
    const server = new MCPServer({
      id: BUILTIN_MCP_SERVER_ID,
      name: serverInfo.name ?? 'Mastra',
      version: serverInfo.version ?? '1.0.0',
      title: serverInfo.title,
      instructions: serverInfo.instructions,
      tools,
      legacy: 'stateless',
      requestState: { key: requestStateKey },
    });
    server.__setLogger(mastra.getLogger());
    return {
      server,
      httpPath: resolveBuiltinMCPPath(mastra),
      mcpOptions: getBuiltinMCPTransportOptions(mastra),
    };
  },
});

/**
 * Returns the route as it is mounted for this Mastra instance: the built-in MCP route moves to
 * `server.mcp.path`; every other route is returned unchanged.
 */
export function resolveServerRoute(route: ServerRoute, mastra: Mastra): ServerRoute {
  if (route !== BUILTIN_MCP_HTTP_ROUTE) return route;
  const path = resolveBuiltinMCPPath(mastra);
  return path === route.path ? route : { ...route, path };
}
