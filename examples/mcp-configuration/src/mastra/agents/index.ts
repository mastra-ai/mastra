import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MCPConfiguration } from '@mastra/mcp';

// start sse server - in real life this would already be running but want to show using sse and stdio in this example
import '../tools/sse';

const mcp = new MCPConfiguration({
  servers: {
    stockPrice: {
      command: 'npx',
      args: ['-y', 'tsx', '../../src/mastra/tools/stock-price.ts'],
      env: {
        FAKE_CREDS: 'let me in!',
      },
    },
    weather: {
      url: new URL('http://localhost:8080/sse'),
    },
  },
});

export const stockWeatherAgent = new Agent({
  name: 'Stock + Weather Agent',
  instructions:
    'You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price. You also love to check the weather when your stock market buddies ask you what the weather is.',
  model: openai('gpt-4o'),
  tools: await mcp.getTools(),
});
