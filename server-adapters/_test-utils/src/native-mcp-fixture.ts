import { MCPServerBase } from '@mastra/core/mcp';
import type { MCPServerHTTPOptions, MCPToolExecutionResultV2 } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import { createTool, isValidationError } from '@mastra/core/tools';
import type { ToolsInput } from '@mastra/core/agent';
import type { InternalCoreTool, MCPToolExecutionContext } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import { z } from 'zod/v4';

const unavailable = (feature: string) => async (): Promise<never> => {
  throw new Error(`${feature} is not available on a 2026-07-28 server`);
};

/** The `context.mcp` a 2026-07-28 server builds: the 1.x shape, with server-initiated requests throwing. */
function requestContext2026(): MCPToolExecutionContext {
  const signal = new AbortController().signal;
  return {
    protocolVersion: '2026-07-28',
    extra: {
      signal,
      requestId: 'rest',
      sendNotification: unavailable('extra.sendNotification'),
      sendRequest: unavailable('extra.sendRequest'),
      mcpReq: {
        id: 'rest',
        method: 'tools/call',
        requestState: () => undefined,
        signal,
        send: unavailable('mcpReq.send'),
        notify: unavailable('mcpReq.notify'),
        log: unavailable('mcpReq.log'),
        elicitInput: unavailable('mcpReq.elicitInput'),
        requestSampling: unavailable('mcpReq.requestSampling'),
      },
    },
    elicitation: { sendRequest: unavailable('elicitation.sendRequest') },
    log: async () => {},
    progress: async () => {},
  };
}

/** Exercises adapter dispatch, not MCP wire-protocol conformance. */
export class NativeMCPFixture extends MCPServerBase {
  override readonly mcpVersion = 2 as const;
  constructor() {
    super({
      id: 'native-fixture',
      name: 'Native fixture',
      version: '2.0.0',
      tools: {
        ordinary: createTool({
          id: 'native-fixture-ordinary',
          description: 'Ordinary execution',
          execute: async (_input, context) => ({
            protocolVersion: context.mcp?.protocolVersion ?? null,
            elicitation: await context
              .mcp!.elicitation.sendRequest({ message: 'x', requestedSchema: { type: 'object', properties: {} } })
              .then(
                () => 'answered',
                (error: Error) => error.message,
              ),
          }),
        }),
        interaction: createTool({
          id: 'native-fixture-interaction',
          description: 'Asks for confirmation',
          inputSchema: z.object({}),
          outputSchema: z.number(),
          suspendSchema: z.object({ phase: z.literal('confirm') }),
          resumeSchema: z.object({ confirmed: z.boolean() }),
          execute: async (_input, context) => {
            if (!context.resumeData) {
              await context.suspend?.({ phase: 'confirm' });
              return;
            }
            return 1;
          },
        }),
      },
    });
  }

  // Converts tools like the 1.x package does; `context.mcp` flows through CoreToolBuilder.
  convertTools(tools: ToolsInput) {
    const converted: Record<string, InternalCoreTool> = {};
    for (const [name, tool] of Object.entries(tools)) {
      converted[name] = makeCoreTool(tool, {
        name,
        requestContext: new RequestContext(),
        mastra: this.mastra,
        logger: this.logger,
      }) as InternalCoreTool;
    }
    return converted;
  }
  async executeTool(
    toolId: string,
    args: unknown,
    executionContext: Parameters<MCPServerBase['executeTool']>[2] = {},
  ): Promise<MCPToolExecutionResultV2> {
    const tool = this.convertedTools[toolId];
    if (!tool?.execute) throw new Error(`Tool ${toolId} not found`);
    let suspension: { payload: unknown } | undefined;
    const mcp = requestContext2026();
    const output = await tool.execute(args, {
      // Same idiom as the 1.x package: an empty toolCallId keeps CoreToolBuilder on the MCP path.
      toolCallId: '',
      messages: [],
      requestContext: executionContext.requestContext,
      abortSignal: mcp.extra.signal,
      mcp,
      suspend: async (payload: unknown) => void (suspension = { payload }),
      resumeData: executionContext.resumeData,
      suspendPayload: executionContext.suspendPayload,
    });
    if (suspension) {
      const original = this.originalTools[toolId];
      const resumeSchema = original && 'resumeSchema' in original ? original.resumeSchema : undefined;
      return {
        status: 'suspended',
        suspendPayload: suspension.payload,
        resumeSchema: resumeSchema ? standardSchemaToJSONSchema(resumeSchema, { io: 'input' }) : undefined,
      };
    }
    // Core reports invalid input/resume data as a validation-error output (the same
    // object agents see); a 2.x server rejects it like any other failed call.
    if (isValidationError(output)) throw new Error(output.message);
    return { status: 'completed', output };
  }

  async startHTTP(options: MCPServerHTTPOptions) {
    options.res.statusCode = 200;
    options.res.setHeader('Content-Type', 'application/json');
    options.res.end(JSON.stringify({ native: true, httpPath: options.httpPath }));
  }
  async startStdio() {}
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      version_detail: { version: this.version, release_date: this.releaseDate, is_latest: this.isLatest },
    };
  }
  getServerDetail() {
    return this.getServerInfo();
  }
  getToolListInfo() {
    return { tools: Object.keys(this.tools()).map(name => ({ name, inputSchema: { type: 'object' } })) };
  }
  getToolInfo(name: string) {
    return this.getToolListInfo().tools.find(tool => tool.name === name);
  }
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}
