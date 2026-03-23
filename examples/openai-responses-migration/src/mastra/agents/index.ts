import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const memory = new Memory({
  options: {
    lastMessages: 20,
  },
});

const releaseStatusTool = createTool({
  id: 'release-status',
  description: 'Returns a small release readiness snapshot for a named feature.',
  inputSchema: z.object({
    feature: z.string().describe('The feature or launch item to check'),
  }),
  execute: async ({ feature }) => {
    return {
      feature,
      owner: 'platform',
      status: 'on track',
      openItems: [
        'run final regression pass',
        'prepare rollout notes',
        'confirm monitoring alerts',
      ],
    };
  },
});

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: `You are a migration assistant for developers moving from OpenAI's hosted Responses API to Mastra.

Keep answers direct and practical.
Prefer short responses.
If the user asks about migration, explain the smallest working change first.
If a user asks for a story or content task, still answer normally.`,
  model: openai(process.env.AGENT_MODEL ?? 'gpt-4.1-mini'),
  memory,
});

export const toolAgent = new Agent({
  id: 'tool-agent',
  name: 'Tool Agent',
  instructions: `You are a Mastra Responses API demo agent with access to tools.

Use the release-status tool whenever the user asks about launch readiness, rollout state, or feature status.
When you use the tool, summarize the result clearly and keep the response concise.`,
  model: openai(process.env.AGENT_MODEL ?? 'gpt-4.1-mini'),
  memory,
  tools: { releaseStatusTool },
});
