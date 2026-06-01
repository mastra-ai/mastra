import { createTool } from '@mastra/core/tools';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { z } from 'zod';
import { vector } from '../index';

export const KNOWLEDGE_INDEX = 'company_knowledge';

export const searchKnowledge = createTool({
  id: 'search-knowledge',
  description:
    'Semantic search over indexed Linear issues and Notion pages. Use this BEFORE falling back to live Linear/Notion lookups or web search.',
  inputSchema: z.object({
    query: z.string().describe('Natural-language question or keywords.'),
    topK: z.number().int().min(1).max(20).default(8).optional(),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        score: z.number(),
        source: z.string(),
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
  }),
  execute: async input => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: input.query,
    });

    const results = await vector.query({
      indexName: KNOWLEDGE_INDEX,
      queryVector: embedding,
      topK: input.topK ?? 8,
    });

    return {
      results: results.map(r => ({
        score: r.score,
        source: String(r.metadata?.source ?? ''),
        title: String(r.metadata?.title ?? ''),
        url: String(r.metadata?.url ?? ''),
        snippet: String(r.metadata?.text ?? '').slice(0, 500),
      })),
    };
  },
});
