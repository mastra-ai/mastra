import { createTool } from '@mastra/core';
import { Needle } from '@needle-ai/needle/v1';
import { z } from 'zod';

// Initialize Needle client
const needle = new Needle();

export const searchKnowledge = createTool({
  id: 'search_knowledge',
  description: 'Search the knowledge base for relevant information',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant information'),
  }),
  outputSchema: z.object({
    relevant_info: z.string(),
  }),
  execute: async ({ context }) => {
    const results = await needle.collections.search({
      collection_id: process.env.NEEDLE_COLLECTION_ID!,
      text: context.query,
    });

    return {
      relevant_info: results.map(r => r.content).join('\n\n'),
    };
  },
});
