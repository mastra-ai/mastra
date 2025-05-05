import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({
  servers: {
    registry: {
      command: 'node',
      args: ['../../packages/mcp-registry-registry/dist/stdio.js'],
    },
  },
});

export const mcpRegistryAgent = new Agent({
  name: 'MCP Registry Agent',
  instructions: `You are a helpful assistant that provides information about MCP registries. You can search for registries by ID, tag, or name.`,
  model: openai('gpt-4o'),
  tools: await mcp.getTools(),
});
