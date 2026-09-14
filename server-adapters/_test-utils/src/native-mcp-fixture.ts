import { MCPServerBaseV2 } from '@mastra/core/mcp';
import type { MCPServerHTTPOptions, MCPToolExecutionContextV2, MCPToolExecutionResultV2 } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { ToolsInput } from '@mastra/core/agent';
import type { InternalCoreTool } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import { z } from 'zod/v4';

/** Exercises adapter dispatch, not MCP wire-protocol conformance. */
export class NativeMCPFixture extends MCPServerBaseV2 {
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
            protocolVersion: context.mcpv2?.protocolVersion ?? null,
            hasLegacyContext: 'mcp' in context,
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
            if (!context.mcpv2?.resumeData) {
              await context.mcpv2?.suspend({ phase: 'confirm' });
              return;
            }
            return 1;
          },
        }),
      },
    });
  }

  // Converts tools like the 1.x package does; the mcpv2 context flows through CoreToolBuilder.
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
    executionContext: Parameters<MCPServerBaseV2['executeTool']>[2] = {},
  ): Promise<MCPToolExecutionResultV2> {
    const tool = this.convertedTools[toolId];
    if (!tool?.execute) throw new Error(`Tool ${toolId} not found`);
    let suspension: { payload: unknown } | undefined;
    const round: Omit<MCPToolExecutionContextV2, 'suspend'> = executionContext.mcpv2 ?? {
      protocolVersion: '2026-07-28',
      requestId: 'rest',
      signal: new AbortController().signal,
      metadata: {},
      log: async () => {},
      progress: async () => {},
    };
    const output = await tool.execute(args, {
      toolCallId: String(round.requestId),
      messages: [],
      requestContext: executionContext.requestContext,
      abortSignal: round.signal,
      mcpv2: { ...round, suspend: async payload => void (suspension = { payload }) },
    });
    if (suspension) {
      const original = this.originalTools[toolId];
      const resumeSchema = original && 'resumeSchema' in original ? original.resumeSchema : undefined;
      return {
        status: 'suspended',
        suspendPayload: suspension.payload,
        resumeSchema: resumeSchema ? z.toJSONSchema(resumeSchema as z.ZodType) : undefined,
      };
    }
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
