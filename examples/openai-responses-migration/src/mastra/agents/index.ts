import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    lastMessages: 20,
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
  memory
});
