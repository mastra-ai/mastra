import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { MCPToolExecutionContext, ToolAction, ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod';
import type { McpAppUi } from './define-mcp-app-ui';
import { MCP_APP_CONTEXT_KEY, mcpAppDataInputSchema, mcpAppDataOutputSchema, parseReads, readPath } from './reads';
import type { McpAppContextSchema, McpAppDataOutput, McpAppReads, McpAppRouteParams } from './reads';
import type { McpAppResource } from './types';

/** One read from the UI, as `prepareRequest` sees it. */
export type McpAppRequest<
  Reads extends McpAppReads = McpAppReads,
  Context extends McpAppContextSchema = McpAppContextSchema,
> = {
  [Read in Extract<keyof Reads, string>]: {
    read: Read;
    /** The route's parameters, decoded. */
    params: Record<McpAppRouteParams<Reads[Read]>, string>;
    /** The route path with its parameters encoded, without the API prefix, e.g. `/observability/metrics/aggregate`. */
    path: string;
    /**
     * The context the tool returned when it opened the UI, checked against the tool's `context`
     * schema. The UI sends it back with each read, so it's not trusted: check the caller may use it.
     */
    context: z.output<Context>;
    /** The caller's bearer token, which is sent as `authorization` unless the returned headers set one. */
    token?: string;
    /** The MCP call's context, with the caller's `authInfo`. Absent when Studio relays the call. */
    mcp?: MCPToolExecutionContext;
    requestContext?: RequestContext;
    abortSignal?: AbortSignal;
  };
}[Extract<keyof Reads, string>];

/** Where to send a read, or the answer to give without sending it. */
export type McpAppPreparedRequest =
  | { url: string | URL; headers?: Record<string, string> }
  | { response: McpAppDataOutput };

/**
 * What the tool returns when it opens the UI: the UI's input, and the context each of the UI's
 * reads carries to `prepareRequest`. `context` is required when its schema has required fields.
 */
export type McpAppOpening<UiInput extends z.ZodObject, Context extends McpAppContextSchema> = {
  input: z.input<UiInput>;
} & ({} extends z.input<Context> ? { context?: z.input<Context> } : { context: z.input<Context> });

/** The tool the model calls to open the UI. */
export interface McpAppTool<
  InputSchema extends z.ZodType,
  UiInput extends z.ZodObject,
  Context extends McpAppContextSchema = z.ZodObject<{}>,
> {
  id: string;
  description: string;
  /** What the model can ask for. */
  inputSchema: InputSchema;
  /**
   * What the UI's reads need beyond the read itself, e.g. the project they're for. The tool
   * returns it with the UI's input, the UI sends it back with each read, and `prepareRequest`
   * receives it. The model sees it in the tool result, so keep secrets out of it.
   */
  context?: Context;
  /** Turns the model's request into the UI's input and the context its reads carry. */
  execute: (
    input: z.output<InputSchema>,
    context: ToolExecutionContext,
  ) => McpAppOpening<UiInput, Context> | Promise<McpAppOpening<UiInput, Context>>;
}

export interface CreateMcpAppOptions<
  UiInput extends z.ZodObject,
  Reads extends McpAppReads,
  InputSchema extends z.ZodType,
  Context extends McpAppContextSchema = z.ZodObject<{}>,
> {
  ui: McpAppUi<UiInput, Reads>;
  tool: McpAppTool<InputSchema, UiInput, Context>;
  /**
   * Decides, for each read, the URL to send it to and the headers to add, or answers it with
   * `{ response }` without sending anything. The method, query parameters and JSON body come from the read.
   */
  prepareRequest: (request: McpAppRequest<Reads, Context>) => McpAppPreparedRequest | Promise<McpAppPreparedRequest>;
}

function readBody(text: string, statusText: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || statusText };
  }
}

/**
 * Builds an MCP App from its UI, the tool that opens it, and how its reads reach your API. Spread
 * the result into `MCPServer`'s `appResources` and `tools`. Use it once per UI on a server: the
 * data tool's name is built into the UI, so a second app would replace the first one's.
 */
export function createMcpApp<
  UiInput extends z.ZodObject,
  Reads extends McpAppReads,
  InputSchema extends z.ZodType,
  Context extends McpAppContextSchema = z.ZodObject<{}>,
>({
  ui,
  tool,
  prepareRequest,
}: CreateMcpAppOptions<UiInput, Reads, InputSchema, Context>): {
  appResources: Record<string, McpAppResource>;
  // What `MCPServer`'s `tools` takes, keeping each tool's `execute` callable.
  tools: Record<string, ToolAction<any, any, any, any, any>>;
} {
  if (tool.id === ui.dataTool) {
    throw new Error(`The tool can't be named ${ui.dataTool}: ${ui.name} reads its data through a tool of that name.`);
  }
  const reads = parseReads(ui.reads);
  const byName = new Map(reads.map(read => [read.read, read]));
  const contextSchema = tool.context ?? z.object({});

  const displayTool = createTool({
    id: tool.id,
    description: tool.description,
    // Widened so `execute` takes what the schema parsed, which `createTool` checked before calling it.
    inputSchema: tool.inputSchema as z.ZodType,
    // The context rides in the result next to the UI's input, so it reaches the UI through any host.
    outputSchema: tool.context ? ui.input.extend({ [MCP_APP_CONTEXT_KEY]: tool.context }) : ui.input,
    mcp: { _meta: { ui: { resourceUri: ui.uri } } },
    execute: async (input, executionContext) => {
      const opening = await tool.execute(input as z.output<InputSchema>, executionContext);
      return tool.context ? { ...opening.input, [MCP_APP_CONTEXT_KEY]: opening.context ?? {} } : opening.input;
    },
  });

  const dataTool = createTool({
    id: ui.dataTool,
    description: `Reads data for the ${ui.name} app.`,
    inputSchema: mcpAppDataInputSchema(ui.reads, reads, contextSchema),
    outputSchema: mcpAppDataOutputSchema,
    // The UI calls it; hosts keep it away from the model.
    mcp: { _meta: { ui: { visibility: ['app'] } } },
    execute: async ({ read, params = {}, query, body, context }, { requestContext, mcp, abortSignal }) => {
      const route = byName.get(read)!;
      // An MCP transport carries the caller's token on `authInfo`; Studio's tool-execute relay on the request context.
      const caller = mcp?.extra.authInfo?.token || requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
      const token = typeof caller === 'string' && caller ? caller : undefined;

      const prepared = await prepareRequest({
        read,
        params,
        path: readPath(route, params),
        context,
        token,
        mcp,
        requestContext,
        abortSignal,
      } as McpAppRequest<Reads, Context>);
      if ('response' in prepared) return prepared.response;

      const url = new URL(prepared.url);
      for (const [key, value] of Object.entries(query ?? {})) {
        for (const item of [value].flat()) url.searchParams.append(key, item);
      }
      // `Headers` matches names case-insensitively, so `Authorization` replaces the caller's token too.
      const headers = new Headers({
        ...(token && { authorization: `Bearer ${token}` }),
        ...(body && { 'content-type': 'application/json' }),
      });
      for (const [name, value] of Object.entries(prepared.headers ?? {})) headers.set(name, value);

      let response: Response;
      try {
        response = await fetch(url, {
          method: route.method,
          headers,
          ...(body && { body: JSON.stringify(body) }),
          signal: abortSignal,
        });
      } catch (error) {
        if (abortSignal?.aborted) throw error;
        return { status: 502, body: { error: `Couldn't reach ${url.origin}: ${(error as Error).message}` } };
      }
      return { status: response.status, body: readBody(await response.text(), response.statusText) };
    },
  });

  const resource: McpAppResource = { name: ui.name, description: ui.description, html: ui.html };
  return {
    appResources: { [ui.uri]: resource },
    tools: { [tool.id]: displayTool, [ui.dataTool]: dataTool },
  };
}
