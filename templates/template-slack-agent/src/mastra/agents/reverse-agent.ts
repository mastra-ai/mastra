import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reverseWorkflow } from '../workflows/reverse-workflow';

const reverseTextTool = createTool({
  id: 'reverse-text',
  description: 'Reverses a text string character by character',
  inputSchema: z.object({
    text: z.string().describe('The text to reverse'),
  }),
  execute: async ({ text }) => {
    return text.split('').reverse().join('');
  },
});

export const reverseAgent = new Agent({
  id: 'reverse-agent',
  name: 'reverse-agent',
  description: 'Reverses text character by character, with an optional fancy transformation workflow',
  instructions: `You are a text reversal agent. You have two capabilities:

1. **Simple reverse**: Use the reverse-text tool to quickly reverse text.
2. **Fancy transform**: Use the reverse-workflow for a full transformation that analyzes, reverses, uppercases, and formats text with decorative borders.

When the user asks for a simple reverse, use the tool. When they want something fancy or formatted, use the workflow.

IMPORTANT: When calling tools or workflows, only pass the text from the user's CURRENT message. Do not include previous conversation history. Extract just the relevant text to transform.

Examples:
- User: "hello" → Use tool with text="hello" → "olleh"
- User: "reverse hello but make it fancy" → Use workflow with text="hello" → formatted output`,
  model: 'openai/gpt-4o-mini',
  tools: { reverseTextTool },
  workflows: { reverseWorkflow },
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
});
