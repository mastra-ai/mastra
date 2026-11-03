import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { MASTRA_API_TOOL, mastraApiRequestSchema, mastraApiResponseSchema } from './mastra-api-protocol';
import type { MastraApiResponse } from './mastra-api-protocol';

export { MASTRA_API_TOOL } from './mastra-api-protocol';
export type { MastraApiRequest, MastraApiResponse } from './mastra-api-protocol';

/** The read-only routes the shipped apps need. Everything else is refused. */
const READABLE_ROUTES = new Set([
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

// Only the path and query of a request are used; the origin is a placeholder.
const ORIGIN = 'http://mastra.internal';

type ServerApp = { fetch: (request: Request) => Response | Promise<Response> };

function apiPrefix(prefix = '/api') {
  const trimmed = prefix.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

/**
 * The caller's auth token. Calls over the MCP transport carry it in `authInfo`; calls through
 * Mastra's own tool-execute route carry it under `MASTRA_AUTH_TOKEN_KEY`.
 */
function callerToken(requestContext: RequestContext | undefined): string | undefined {
  const authInfo = requestContext?.get('authInfo');
  if (authInfo && typeof authInfo === 'object' && 'token' in authInfo) {
    if (typeof authInfo.token === 'string' && authInfo.token) return authInfo.token;
  }
  const token = requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
  return typeof token === 'string' && token ? token : undefined;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Answers the Mastra API requests of apps from this package by calling the server's own routes
 * in-process, as the caller: their auth token is forwarded, so the routes' auth and permission
 * checks still apply. Register it on the same `MCPServer` as the app's tool, under
 * `MASTRA_API_TOOL`. It's marked app-only, so hosts keep it away from the model.
 */
export const mastraApiTool = createTool({
  id: MASTRA_API_TOOL,
  description: "Reads this Mastra server's observability data for the MCP Apps it serves.",
  inputSchema: mastraApiRequestSchema,
  outputSchema: mastraApiResponseSchema,
  mcp: { _meta: { ui: { visibility: ['app'] } } },
  execute: async ({ method, path, body }, { mastra, requestContext }): Promise<MastraApiResponse> => {
    // Parsing resolves `..` segments before the route is checked.
    const url = new URL(path, ORIGIN);
    if (!READABLE_ROUTES.has(`${method} ${url.pathname}`)) {
      return { status: 403, body: { error: `${method} ${url.pathname} isn't readable from MCP Apps.` } };
    }

    const server = mastra?.getServerApp<ServerApp>();
    if (!mastra || !server) {
      return { status: 503, body: { error: 'The Mastra server is not running.' } };
    }

    const headers = new Headers({ 'content-type': 'application/json' });
    const token = callerToken(requestContext);
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await server.fetch(
      new Request(`${ORIGIN}${apiPrefix(mastra.getServer()?.apiPrefix)}${url.pathname}${url.search}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { status: response.status, body: await readBody(response) };
  },
});
