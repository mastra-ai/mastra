import type { App } from '@modelcontextprotocol/ext-apps';
import { OBSERVABILITY_APP_TOOLS, routeResponseSchema } from '../observability-protocol';
import type { ObservabilityAppToolName } from '../observability-protocol';
import { firstText, structuredOutput } from './tool-result';

// MastraClient builds absolute URLs; only their path and query pick the tool.
const ORIGIN = 'http://mastra.internal';

const TOOL_BY_ROUTE = new Map(
  Object.entries(OBSERVABILITY_APP_TOOLS).map(([name, { method, path }]) => [
    `${method} ${path}`,
    name as ObservabilityAppToolName,
  ]),
);

const failure = (error: string, status = 502) => Response.json({ error }, { status });

function queryArguments(params: URLSearchParams) {
  const args: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    args[key] = values.length === 1 ? values[0]! : values;
  }
  return args;
}

/**
 * A `fetch` for `MastraClient` that answers each observability request by calling the server's
 * matching app-only tool over the host's MCP connection, with the route's own status and body.
 * Requests no tool covers fail without leaving the iframe.
 */
export function createObservabilityFetch(app: App): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    const method = (init?.method ?? 'GET').toUpperCase();
    const name = TOOL_BY_ROUTE.get(`${method} ${url.pathname}`);
    if (!name) return failure(`${method} ${url.pathname} isn't available to MCP Apps.`, 404);

    const result = await app.callServerTool(
      {
        name,
        arguments:
          method === 'GET'
            ? queryArguments(url.searchParams)
            : typeof init?.body === 'string'
              ? JSON.parse(init.body)
              : {},
      },
      { signal: init?.signal ?? undefined },
    );
    if (result.isError) return failure(firstText(result.content) ?? `The ${name} tool failed.`);

    const parsed = routeResponseSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${name} tool returned an unexpected result.`);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
