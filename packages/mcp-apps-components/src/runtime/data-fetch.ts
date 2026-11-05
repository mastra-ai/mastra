import type { App } from '@modelcontextprotocol/ext-apps';
import type { McpAppUi } from '../define-mcp-app-ui';
import { matchRead, mcpAppDataOutputSchema, parseReads } from '../reads';
import { firstText, structuredOutput } from './tool-result';

// MastraClient builds absolute URLs; only their path and query matter here.
const ORIGIN = 'http://mastra.internal';

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
function errorMessage(text: string | undefined, dataTool: string) {
  if (!text) return `The ${dataTool} tool failed.`;
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
 * A `fetch` for `MastraClient` that turns each request the UI makes into one of its reads, sent to
 * the server's app-only data tool over the host's MCP connection.
 */
export function createMcpAppDataFetch(
  app: App,
  { ui, projectId }: { ui: Pick<McpAppUi, 'name' | 'dataTool' | 'reads'>; projectId?: string },
): typeof fetch {
  const reads = parseReads(ui.reads);
  const missingTool = `The MCP server serving this app has no ${ui.dataTool} tool. Build the app with \`createMcpApp\` from @mastra/mcp-apps-components, which registers it.`;

  return async (input, init) => {
    const isRequest = input instanceof Request;
    const url = new URL(isRequest ? input.url : String(input), ORIGIN);
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const request = `${method} ${url.pathname}`;
    const match = matchRead(reads, method, url.pathname);
    if (!match) return failure(`${ui.name} doesn't read ${request}.`, 404);

    const call: Record<string, unknown> = { read: match.read, ...(projectId && { projectId }) };
    if (Object.keys(match.params).length) call.params = match.params;
    if (method === 'GET') {
      if (url.searchParams.size) call.query = queryArguments(url.searchParams);
    } else {
      const body = parseBody(init?.body);
      if (!body) return failure(`${request} needs a JSON object body.`, 400);
      call.body = body;
    }

    let result: Awaited<ReturnType<App['callServerTool']>>;
    try {
      result = await app.callServerTool({ name: ui.dataTool, arguments: call }, { signal: init?.signal ?? undefined });
    } catch (error) {
      if (isUnknownTool(error)) return failure(`${missingTool} The host said: ${(error as Error).message}`, 404);
      throw error;
    }
    // The tool answers a route's failures in-band with their status, so `isError` means it rejected
    // its input or broke. Neither changes on a retry, so fail with a status MastraClient won't retry.
    if (result.isError) return failure(errorMessage(firstText(result.content), ui.dataTool), 400);

    const parsed = mcpAppDataOutputSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${ui.dataTool} tool returned an unexpected result.`, 502);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
