import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const frenchSpeakingAgent = new Agent({
  id: 'french-speaking-agent',
  name: 'French Speaking Agent',
  instructions: 'You are a helpful assistant that speaks French.',
  model: 'openai/gpt-4.1',
});

const spanishSpeakingAgent = new Agent({
  id: 'spanish-speaking-agent',
  name: 'Spanish Speaking Agent',
  instructions: 'You are a helpful assistant that speaks Spanish.',
  model: 'openai/gpt-4.1',
});

const frenchAgentTool = createTool({
  id: 'french-agent-tool',
  description: 'A tool that allows the agent to delegate the task to a French speaking agent.',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async (inputData, context) => {
    const result = await frenchSpeakingAgent.stream(inputData.message);

    result.fullStream.pipeTo(context.writer);

    return {
      result: await result.text,
    };
  },
});

const spanishAgentTool = createTool({
  id: 'spanish-agent-tool',
  description: 'A tool that allows the agent to delegate the task to a Spanish speaking agent.',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async (inputData, context) => {
    const result = await spanishSpeakingAgent.stream(inputData.message);

    result.fullStream.pipeTo(context.writer);

    return {
      result: await result.text,
    };
  },
});

export const englishSpeakingAgentRaw = new Agent({
  id: 'english-speaking-agent-raw',
  name: 'English Speaking Agent (Raw)',
  instructions:
    'You are a helpful assistant that speaks English and can delegate the task to a French or Spanish speaking agent.',
  model: 'openai/gpt-4.1',
  tools: {
    frenchAgentTool,
    spanishAgentTool,
  },
});
