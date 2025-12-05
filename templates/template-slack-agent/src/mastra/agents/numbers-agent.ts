import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const textToNumbersTool = createTool({
  id: 'text-to-numbers',
  description: 'Converts text to numbers where a=1, b=2, c=3, etc.',
  inputSchema: z.object({
    text: z.string().describe('The text to convert to numbers'),
  }),
  execute: async ({ context }) => {
    const text = context.text.toLowerCase();
    const result: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);

      // Check if it's a letter (a-z)
      if (code >= 97 && code <= 122) {
        const position = code - 96; // a=1, b=2, etc.
        result.push(position.toString());
      } else if (char === ' ') {
        result.push(' ');
      } else {
        // Keep non-letter characters as-is
        result.push(char);
      }
    }

    return result.join(' ');
  },
});

export const numbersAgent = new Agent({
  name: 'numbers-agent',
  description: 'Converts letters to numbers (a=1, b=2, etc.)',
  instructions: `You are a text-to-numbers conversion agent. When the user sends you text, use the text-to-numbers tool to convert each letter to its position in the alphabet (a=1, b=2, c=3, etc.), then return ONLY the converted numbers with no extra commentary.

IMPORTANT: When calling tools or workflows, only pass the text from the user's CURRENT message. Do not include previous conversation history. Extract just the relevant text to transform.

Examples:
- User: "abc" → You: "1 2 3"
- User: "hello" → You: "8 5 12 12 15"
- User: "hi there" → You: "8 9   20 8 5 18 5"`,
  model: 'openai/gpt-4o-mini',
  tools: { textToNumbersTool },
  memory: new Memory({
    options: {
      lastMessages: 20, // Keep last 20 messages in context
    },
  }),
});
