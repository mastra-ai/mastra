import type { App } from '@modelcontextprotocol/ext-apps';
import { firstText, structuredOutput } from '../../runtime/tool-result';
import {
  DASHBOARD_DATA_OPERATIONS,
  DASHBOARD_DATA_REQUESTS,
  DASHBOARD_DATA_TOOL_NAME,
  dashboardDataOutputSchema,
} from './data';
import type { DashboardDataInput, DashboardDataOperation } from './data';

const OPERATION_BY_REQUEST = new Map<string, DashboardDataOperation>(
  DASHBOARD_DATA_OPERATIONS.map(operation => [DASHBOARD_DATA_REQUESTS[operation], operation]),
);

// MastraClient builds absolute URLs; only their path and query matter here.
const ORIGIN = 'http://mastra.internal';

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
 * A `fetch` for `MastraClient` that turns each request the dashboard makes into a named read sent
 * to the server's app-only data tool over the host's MCP connection.
 */
export function createDashboardDataFetch(app: App): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    const request = `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`;
    const operation = OPERATION_BY_REQUEST.get(request);
    if (!operation) return failure(`The dashboard app doesn't read ${request}.`, 404);

    const call: DashboardDataInput =
      operation === 'listScores'
        ? { operation, query: queryArguments(url.searchParams) }
        : { operation, body: typeof init?.body === 'string' ? JSON.parse(init.body) : {} };
    const result = await app.callServerTool(
      { name: DASHBOARD_DATA_TOOL_NAME, arguments: call },
      { signal: init?.signal ?? undefined },
    );
    if (result.isError) return failure(firstText(result.content) ?? `The ${DASHBOARD_DATA_TOOL_NAME} tool failed.`);

    const parsed = dashboardDataOutputSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${DASHBOARD_DATA_TOOL_NAME} tool returned an unexpected result.`);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
