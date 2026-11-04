import type { App } from '@modelcontextprotocol/ext-apps';
import { REQUEST_TOOL_NAME, requestToolOutputSchema } from '../request-tool';
import type { RequestToolInput } from '../request-tool';
import { firstText, structuredOutput } from './tool-result';

// MastraClient builds absolute URLs; only their path and query travel to the tool.
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
 * A `fetch` for `MastraClient` that sends each request, as is, to the server's app-only request
 * tool over the host's MCP connection, and answers with the route's own status and body.
 */
export function createRequestToolFetch(app: App): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    const request: RequestToolInput = {
      method: (init?.method ?? 'GET').toUpperCase() as RequestToolInput['method'],
      path: url.pathname,
      ...(url.searchParams.size > 0 && { query: queryArguments(url.searchParams) }),
      ...(typeof init?.body === 'string' && { body: JSON.parse(init.body) }),
    };

    const result = await app.callServerTool(
      { name: REQUEST_TOOL_NAME, arguments: request },
      { signal: init?.signal ?? undefined },
    );
    if (result.isError) return failure(firstText(result.content) ?? `The ${REQUEST_TOOL_NAME} tool failed.`);

    const parsed = requestToolOutputSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${REQUEST_TOOL_NAME} tool returned an unexpected result.`);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
