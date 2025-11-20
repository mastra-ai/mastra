import { AgentNetwork } from '@mastra/core/network';
import { weatherAgent } from '../agents';
import { openai } from '@ai-sdk/openai';

export const myNetwork = new AgentNetwork({
  name: 'myNetwork',
  agents: [weatherAgent],
  model: openai('gpt-4o'),
  instructions: `
        You are a helpful supervisor agent that can help users with a variety of tasks.
    `,
});
