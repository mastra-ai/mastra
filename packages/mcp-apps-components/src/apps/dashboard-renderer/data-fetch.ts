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

const MISSING_TOOL = `The MCP server serving this app has no ${DASHBOARD_DATA_TOOL_NAME} tool. Register it next to the app: \`tools: { ${DASHBOARD_DATA_TOOL_NAME}: createDashboardDataTool({ baseUrl }) }\`, imported from @mastra/mcp-apps-components/dashboard-data-tool.`;

const failure = (error: string, status: number) => Response.json({ error }, { status });

function queryArguments(params: URLSearchParams) {
  const args: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    args[key] = values.length === 1 ? values[0]! : values;
  }
  return args;
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> | undefined {
  if (body == null) return {};
  if (typeof body !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

// Mastra's MCP server reports a tool that threw as its serialized `MastraError`; keep only the message.
function errorMessage(text: string | undefined) {
  if (!text) return `The ${DASHBOARD_DATA_TOOL_NAME} tool failed.`;
  try {
    const parsed: unknown = JSON.parse(text);
    const message = (parsed as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) return message;
  } catch {
    // Plain text, such as an input validation message.
  }
  return text;
}

// The spec makes calling a tool the server doesn't have a protocol error. Hosts phrase it differently
// (Mastra's MCP server says "Unknown tool", Studio names the server), but both answer with JSON-RPC's
// invalid params code. The app only sends arguments its own schema built, so that code means the tool is missing.
const INVALID_PARAMS = -32602;

function isUnknownTool(error: unknown) {
  return (error as { code?: unknown } | null)?.code === INVALID_PARAMS;
}

/**
 * A `fetch` for `MastraClient` that turns each request the dashboard makes into a named read sent
 * to the server's app-only data tool over the host's MCP connection.
 */
export function createDashboardDataFetch(app: App, { projectId }: { projectId?: string } = {}): typeof fetch {
  return async (input, init) => {
    const isRequest = input instanceof Request;
    const url = new URL(isRequest ? input.url : String(input), ORIGIN);
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const request = `${method} ${url.pathname}`;
    const operation = OPERATION_BY_REQUEST.get(request);
    if (!operation) return failure(`The dashboard app doesn't read ${request}.`, 404);

    let call: DashboardDataInput;
    if (operation === 'listScores') {
      call = { operation, query: queryArguments(url.searchParams), ...(projectId && { projectId }) };
    } else {
      const body = parseBody(init?.body);
      if (!body) return failure(`${request} needs a JSON object body.`, 400);
      call = { operation, body, ...(projectId && { projectId }) };
    }

    let result: Awaited<ReturnType<App['callServerTool']>>;
    try {
      result = await app.callServerTool(
        { name: DASHBOARD_DATA_TOOL_NAME, arguments: call },
        { signal: init?.signal ?? undefined },
      );
    } catch (error) {
      if (isUnknownTool(error)) return failure(`${MISSING_TOOL} The host said: ${(error as Error).message}`, 404);
      throw error;
    }
    // The tool answers a route's failures in-band with their status, so `isError` means it rejected
    // its input or broke. Neither changes on a retry, so fail with a status MastraClient won't retry.
    if (result.isError) return failure(errorMessage(firstText(result.content)), 400);

    const parsed = dashboardDataOutputSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${DASHBOARD_DATA_TOOL_NAME} tool returned an unexpected result.`, 502);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
