import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MCPConfiguration } from '@mastra/mcp';
import { cookingTool } from '../tools/index.js';

export const chefAgent = new Agent({
  name: 'Chef Agent',
  instructions: `
    YOU MUST USE THE TOOL cooking-tool
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai('gpt-4o-mini'),
  tools: {
    cookingTool,
  },
});

export const chefAgentResponses = new Agent({
  name: 'Chef Agent',
  instructions: `
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai.responses('gpt-4o'),
  tools: {
    web_search_preview: openai.tools.webSearchPreview(),
  },
});

const mcp = new MCPConfiguration({
  servers: {
    registry: {
      command: 'node',
      args: ['/Users/abhiramaiyer/PlatformFirst/mastra/packages/mcp-registry-registry/dist/stdio.js'],
    },
  },
});

export const mcpRegistryAgent = new Agent({
  name: 'MCP Registry Agent',
  instructions: `You are a helpful assistant that provides information about MCP registries. You can search for registries by ID, tag, or name.`,
  model: openai('gpt-4o'),
  tools: await mcp.getTools(),
});
