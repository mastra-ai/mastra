import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { weatherAgent } from '../agents';
import { weatherTool } from '../tools';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // Or your database URL
  }),
});

const agent1 = new Agent({
  name: 'agent1',
  instructions:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  description:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  model: openai('gpt-4o'),
});

const agent2 = new Agent({
  name: 'agent2',
  description: 'This agent is used to do text synthesis on researched material. It writes articles in full paragraphs.',
  instructions:
    'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles.',
  model: openai('gpt-4o'),
});

const agentStep1 = createStep({
  id: 'agent-workflow-step-1',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    city: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent1.generate(inputData.city, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

const agentStep2 = createStep({
  id: 'agent-workflow-step-2',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    text: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent2.generate(inputData.text, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

export const workflow1 = createWorkflow({
  id: 'workflow1',
  description: 'This workflow is perfect for researching a specific city.',
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(agentStep1)
  .then(agentStep2)
  .commit();

export const v_nextNetwork = new NewAgentNetwork({
  id: 'test-network',
  name: 'Test Network',
  instructions:
    'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material. You can also get weather information. workflow1 is the best primitive for researching an *individual* city and it should always be used when running multiple primitives to accomplish a task.',
  model: openai('gpt-4o'),
  agents: {
    agent1,
    agent2,
    // weatherAgent,
  },
  tools: {
    weatherTool,
  },
  workflows: {
    workflow1,
  },
  memory: memory,
});
