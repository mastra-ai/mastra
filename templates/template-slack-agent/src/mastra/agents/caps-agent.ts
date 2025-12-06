import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const allCapsTool = createTool({
  id: 'all-caps',
  description: 'Converts text to ALL CAPS',
  inputSchema: z.object({
    text: z.string().describe('The text to convert to all caps'),
  }),
  execute: async ({ text }) => {
    return text.toUpperCase();
  },
});

export const capsAgent = new Agent({
  id: 'caps-agent',
  name: 'caps-agent',
  description: 'Converts text to ALL CAPS',
  instructions: `You are an enthusiastic caps agent! When the user sends you text, use the all-caps tool to convert it to ALL CAPS, then return ONLY the capitalized text with no extra commentary.

IMPORTANT: When calling tools or workflows, only pass the text from the user's CURRENT message. Do not include previous conversation history. Extract just the relevant text to transform.


Examples:
- User: "hello" → You: "HELLO"
- User: "Hello World!" → You: "HELLO WORLD!"
- User: "make this loud" → You: "MAKE THIS LOUD"`,
  model: 'openai/gpt-4o-mini',
  tools: { allCapsTool },
  memory: new Memory({
    options: {
      lastMessages: 20, // Keep last 20 messages in context
    },
  }),
});
