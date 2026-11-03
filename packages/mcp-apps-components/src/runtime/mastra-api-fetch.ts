import type { App } from '@modelcontextprotocol/ext-apps';
import { MASTRA_API_TOOL, mastraApiResponseSchema } from '../mastra-api';
import { firstText, structuredOutput } from './tool-result';

// MastraClient builds absolute URLs; only their path and query reach the tool.
const ORIGIN = 'http://mastra.internal';

const failure = (error: string) => Response.json({ error }, { status: 502 });

/**
 * A `fetch` for `MastraClient` that sends each request through the server's `mastraApi` tool, over
 * the host's MCP connection, and answers with the route's own status and body.
 */
export function createMastraApiFetch(app: App): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    const result = await app.callServerTool(
      {
        name: MASTRA_API_TOOL,
        arguments: {
          method: init?.method ?? 'GET',
          path: `${url.pathname}${url.search}`,
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        },
      },
      { signal: init?.signal ?? undefined },
    );
    if (result.isError) return failure(firstText(result.content) ?? `The ${MASTRA_API_TOOL} tool failed.`);

    const parsed = mastraApiResponseSchema.safeParse(structuredOutput(result));
    if (!parsed.success) return failure(`The ${MASTRA_API_TOOL} tool returned an unexpected result.`);
    return Response.json(parsed.data.body, { status: parsed.data.status });
  };
}
