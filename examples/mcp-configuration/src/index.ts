import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MCPConfiguration } from '@mastra/mcp';
import chalk from 'chalk';

// start sse server - in real life this would already be running but want to show using sse and stdio in this example
import './mastra/tools/sse';

console.log(chalk.blue(`Creating agent`));
export const stockWeatherAgent = new Agent({
  name: 'Stock + Weather Agent',
  instructions:
    'You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price. You also love to check the weather when your stock market buddies ask you what the weather is.',
  model: openai('gpt-4o'),
});

console.log(chalk.blue(`Creating MCPConfiguration`));
const mcp = new MCPConfiguration({
  servers: {
    stockPrice: {
      command: 'npx',
      args: ['-y', 'tsx', './src/mastra/tools/stock-price.ts'],
      env: {
        FAKE_CREDS: 'let me in!',
      },
    },
    weather: {
      url: new URL('http://localhost:8080/sse'),
    },
  },
});

const toolsets = await mcp.getConnectedToolsets();

console.log({ toolsets });

const prompt = `Whats the weather in Seattle and what is the current stock price of Apple (AAPL)?`;
console.log(chalk.yellow(`Sending prompt:\n"${prompt}"\n\n`));
const response = await stockWeatherAgent.stream(prompt, {
  toolsets,
});

for await (const part of response.fullStream) {
  switch (part.type) {
    case 'error':
      console.error(part.error);
      break;
    case 'text-delta':
      process.stdout.write(chalk.green(part.textDelta));
      break;
    case 'tool-call':
      console.log(`calling tool ${part.toolName} with args ${chalk.red(JSON.stringify(part.args, null, 2))}`);
      break;
    case 'tool-result':
      console.log(`tool result ${chalk.cyan(JSON.stringify(part.result, null, 2))}`);
      break;
  }
}
