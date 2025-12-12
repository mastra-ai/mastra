import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherInfo } from './mastra/tools';

const agent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4o'),
  tools: {
    weatherInfo,
  },
});

const result = await agent.generate('Yo whats up', {
  prepareStep: ({ stepNumber }) => {
    if (stepNumber === 0) {
      return {
        toolChoice: 'required',
      };
    }
  },
});

console.log(result.text);
