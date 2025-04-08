import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { mem0 } from '../integrations';

export const mem0RememberTool = createTool({
  id: 'Mem0-remember',
  description: "Remember your agent memories that you've previously saved using the Mem0-memorize tool.",
  inputSchema: z.object({
    question: z.string().describe('Question used to look up the answer in saved memories.'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Remembered answer'),
  }),
  execute: async ({ context }) => {
    console.log(`Searching memory "${context.question}"`);
    const memory = await mem0.searchMemory(context.question);
    console.log(`\nFound memory "${memory}"\n`);

    return {
      answer: memory,
    };
  },
});

export const mem0MemorizeTool = createTool({
  id: 'Mem0-memorize',
  description: 'Save information to mem0 so you can remember it later using the Mem0-remember tool.',
  inputSchema: z.object({
    statement: z.string().describe('A statement to save into memory'),
  }),
  execute: async ({ context }) => {
    console.log(`\nCreating memory "${context.statement}"\n`);
    // to reduce latency memories can be saved async without blocking tool execution
    void mem0.createMemory(context.statement).then(() => {
      console.log(`\nMemory "${context.statement}" saved.\n`);
    });
    return { success: true };
  },
});
