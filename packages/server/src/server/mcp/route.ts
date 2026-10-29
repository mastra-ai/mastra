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

let requestStateKey: Uint8Array | undefined;

/**
 * Signs `input_required` continuation state. No built-in tool suspends, so the key is never used to resume a
 * request; passing one keeps MCPServer from warning about its per-process default on every request.
 * Created on first use: Cloudflare Workers refuses to start a Worker that generates random values in global scope.
 */
function getRequestStateKey(): Uint8Array {
  return (requestStateKey ??= globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

const MISSING_MCP_MESSAGE = 'Built-in MCP server needs @mastra/mcp: npm install @mastra/mcp';
const reportedMissingMCP = new WeakSet<Mastra>();

/** Whether `error` (or an error it wraps) says `@mastra/mcp` itself can't be resolved, not a module inside it. */
export function isMissingMCPPackage(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (
      (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') &&
      /Cannot find (package|module) '@mastra\/mcp'/.test(current.message)
    ) {
      return true;
    }
    // Cloudflare Workers (workerd) throws a plain Error without a `code`.
    if (/^No such module "@mastra\/mcp"/.test(current.message)) {
      return true;
    }
  }
  return false;
}

/**
 * The only place `@mastra/mcp` (an optional peer dependency) is loaded, so apps that never serve the built-in MCP
 * endpoint never load the MCP SDK. When it isn't installed the endpoint answers 501.
 * The catalogue is loaded here as well: it imports the server adapter, which imports this route.
 */
async function loadBuiltinMCP(mastra: Mastra) {
  let mcp: typeof import('@mastra/mcp');
  try {
    // Keep this import directly inside `try`: bundlers such as wrangler's esbuild only accept an unresolvable
    // dynamic import there, so moving it out breaks builds of apps that don't install @mastra/mcp.
    mcp = await import('@mastra/mcp');
  } catch (error) {
    if (!isMissingMCPPackage(error)) throw error;
    if (!reportedMissingMCP.has(mastra)) {
      reportedMissingMCP.add(mastra);
      mastra.getLogger()?.error(MISSING_MCP_MESSAGE);
    }
    throw new HTTPException(501, {
      message: MISSING_MCP_MESSAGE,
      res: Response.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: MISSING_MCP_MESSAGE } }),
    });
  }
  const { buildBuiltinMCPTools } = await import('./catalogue');
  return { MCPServer: mcp.MCPServer, buildBuiltinMCPTools };
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
    const config = resolveBuiltinMCPConfig(mastra, request);
    const { MCPServer, buildBuiltinMCPTools } = await loadBuiltinMCP(mastra);
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
      requestState: { key: getRequestStateKey() },
    });
    server.__setLogger(mastra.getLogger());
    return {
      server,
      httpPath: getBuiltinMCPMountedPath(mastra),
      mcpOptions: getBuiltinMCPTransportOptions(mastra),
    };
  },
});

const mountedPaths = new WeakMap<Mastra, string>();

/** Path the built-in MCP route is served on (without the API prefix), after collision fallback. */
export function getBuiltinMCPMountedPath(mastra: Mastra): string {
  return mountedPaths.get(mastra) ?? resolveBuiltinMCPPath(mastra);
}

const warnedCollision = new WeakSet<Mastra>();

/** Whether `path` would be served by `route` (`:param` matches one segment, `*` the rest). */
function routeMatches(route: ServerRoute, path: string): boolean {
  const pattern = route.path
    .split('/')
    .map(segment =>
      segment === '*' ? '.*' : segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^${pattern}/?$`).test(path);
}

/**
 * Returns the route as it is mounted for this Mastra instance: the built-in MCP route moves to
 * `server.mcp.path`; every other route is returned unchanged. Adapters call this while registering
 * `routes`, so the reserved-id warning and path collisions are reported at startup. A `server.mcp.path`
 * that any of `routes` would also serve falls back to `/mcp`.
 */
export function resolveServerRoute(
  route: ServerRoute,
  mastra: Mastra,
  routes: readonly ServerRoute[] = [],
): ServerRoute {
  if (route !== BUILTIN_MCP_HTTP_ROUTE) return route;
  warnOnReservedMCPServerId(mastra);
  let path = resolveBuiltinMCPPath(mastra);
  const taken = routes.find(other => other !== BUILTIN_MCP_HTTP_ROUTE && routeMatches(other, path));
  if (taken && path !== DEFAULT_BUILTIN_MCP_PATH) {
    if (!warnedCollision.has(mastra)) {
      warnedCollision.add(mastra);
      mastra
        .getLogger()
        ?.error(
          `server.mcp.path "${path}" collides with the ${taken.method} ${taken.path} route; using "${DEFAULT_BUILTIN_MCP_PATH}".`,
        );
    }
    path = DEFAULT_BUILTIN_MCP_PATH;
  }
  mountedPaths.set(mastra, path);
  return path === route.path ? route : { ...route, path };
}
