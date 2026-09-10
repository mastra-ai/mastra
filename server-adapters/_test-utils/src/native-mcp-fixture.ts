import { MCPServerBaseV2, createMCPTool } from '@mastra/core/mcp';
import type { MCPServerHTTPOptionsV2 } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
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
          id: 'native-fixture-business',
          description: 'Business execution',
          execute: async (_input, context) => ({ hasLegacyContext: 'mcp' in context }),
        }),
        interaction: createMCPTool({
          id: 'native-fixture-interaction',
          description: 'Native interaction',
          inputSchema: z.object({}),
          outputSchema: z.number(),
          execute: () => ({ kind: 'input_required', result: { resultType: 'input_required', requestState: 'next' } }),
        }),
      },
    });
  }

  async startHTTP(options: MCPServerHTTPOptionsV2) {
    options.res.statusCode = 200;
    options.res.setHeader('Content-Type', 'application/json');
    options.res.end(JSON.stringify({ native: true, hasLegacyOptions: 'options' in options }));
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
