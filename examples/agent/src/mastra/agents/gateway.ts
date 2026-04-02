import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 1. Simple tool — basic tool call round-trip
const helloWorldTool = createTool({
  id: 'hello-world',
  description: 'Returns a hello world greeting',
  inputSchema: z.object({}),
  outputSchema: z.object({ message: z.string() }),
  execute: async () => ({ message: 'Hello, World!' }),
});

// 2. Tool with complex input — tests arg serialization through storage
const lookupUserTool = createTool({
  id: 'lookup-user',
  description: 'Looks up a user by their name and returns profile info',
  inputSchema: z.object({
    name: z.string().describe('The user name to look up'),
    includeDetails: z.boolean().optional().describe('Whether to include extra details'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
  execute: async ({ name, includeDetails }) => ({
    id: 'usr_' + name.toLowerCase().replace(/\s/g, '_'),
    name,
    email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
    role: includeDetails ? 'admin (with full permissions)' : 'user',
  }),
});

// 3. Tool with large output — tests result truncation (gateway truncates to 4000 chars)
const searchDocsTool = createTool({
  id: 'search-docs',
  description: 'Searches documentation and returns matching results. Use this when the user asks about documentation or needs to find information.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Max results to return (default 5)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
    totalCount: z.number(),
  }),
  execute: async ({ query, limit = 5 }) => ({
    results: Array.from({ length: limit }, (_, i) => ({
      title: `Result ${i + 1}: ${query}`,
      snippet: `This is a detailed documentation snippet about "${query}" that contains enough text to test how large tool results are handled when stored and reloaded. `.repeat(10),
      url: `https://docs.example.com/${query.replace(/\s/g, '-').toLowerCase()}/${i + 1}`,
    })),
    totalCount: limit * 10,
  }),
});

// 4. Tool that returns nested JSON — tests complex result serialization
const getWeatherTool = createTool({
  id: 'get-weather',
  description: 'Gets current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    city: z.string(),
    current: z.object({
      temp_f: z.number(),
      condition: z.string(),
      humidity: z.number(),
    }),
    forecast: z.array(z.object({
      day: z.string(),
      high: z.number(),
      low: z.number(),
      condition: z.string(),
    })),
  }),
  execute: async ({ city }) => ({
    city,
    current: { temp_f: 72, condition: 'Partly cloudy', humidity: 55 },
    forecast: [
      { day: 'Tomorrow', high: 75, low: 60, condition: 'Sunny' },
      { day: 'Day after', high: 68, low: 55, condition: 'Rain' },
    ],
  }),
});

// 5. Tool that fails — tests error handling through storage/reload
const unreliableServiceTool = createTool({
  id: 'unreliable-service',
  description: 'Calls an unreliable external service. Use this only when explicitly asked to test error handling.',
  inputSchema: z.object({
    shouldFail: z.boolean().optional().describe('Force a failure for testing'),
  }),
  outputSchema: z.object({ status: z.string(), data: z.string() }),
  execute: async ({ shouldFail }) => {
    if (shouldFail) {
      throw new Error('Service temporarily unavailable (simulated failure)');
    }
    return { status: 'ok', data: 'Service responded successfully' };
  },
});

export const gatewayAgent = new Agent({
  id: 'gateway-agent',
  name: 'Gateway Agent',
  description: 'A test agent with multiple tools for testing tool call persistence through the gateway',
  instructions: `You are a helpful assistant with access to several tools.
When the user asks you to do something, use the appropriate tool.
If the user asks you to do multiple things at once, call multiple tools in parallel.
Always confirm what the tool returned in your response.`,
  model: 'mastra/openai/gpt-5-mini',
  tools: {
    helloWorldTool,
    lookupUserTool,
    searchDocsTool,
    getWeatherTool,
    unreliableServiceTool,
  },
});
