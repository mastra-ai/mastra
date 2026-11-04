import { createTool } from '@mastra/core/tools';
import { embed } from 'ai';
import { z } from 'zod';
import { EMBED_DIMENSION, embeddingModel } from '../bedrock.js';
import { VECTOR_INDEX, VECTOR_STORE_NAME } from '../mongo.js';

/**
 * RAG tool with visible, streamed status so the demo shows exactly when each
 * system engages: Bedrock (embed the query) → MongoDB Atlas (vector search) →
 * back to Bedrock (generate the answer). Unlike the generic vector-query tool,
 * this returns BOTH the rendered page URL and the raw .md URL for each source.
 */
export const docsSearchTool = createTool({
  id: 'docsSearchTool',
  description:
    'Search the Mastra documentation stored in MongoDB Atlas Vector Search. ' +
    'Call this before answering any Mastra question, then cite the returned sources.',
  inputSchema: z.object({
    query: z.string().describe('What to look up in the Mastra documentation'),
    topK: z.number().int().min(1).max(10).default(5).describe('How many passages to retrieve'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        pageUrl: z.string(),
        mdUrl: z.string(),
        score: z.number(),
        text: z.string(),
      }),
    ),
  }),
  /** Embed the question at the corpus dimension and return linked passages from Atlas Vector Search. */
  execute: async ({ query, topK }, ctx) => {
    const writer = ctx?.writer;

    // 1) Bedrock: embed the query.
    await writer?.write({ type: 'status', stage: 'embedding', message: '🟠 Bedrock Titan — embedding your question…' });
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: { bedrock: { dimensions: EMBED_DIMENSION } },
    });

    // 2) MongoDB: Atlas Vector Search.
    await writer?.write({ type: 'status', stage: 'retrieving', message: '🍃 MongoDB Atlas — running vector search…' });
    const store = ctx?.mastra?.getVector(VECTOR_STORE_NAME);
    if (!store) throw new Error(`Vector store "${VECTOR_STORE_NAME}" is not registered on the Mastra instance`);
    const hits = await store.query({ indexName: VECTOR_INDEX, queryVector: embedding, topK: topK ?? 5 });

    await writer?.write({
      type: 'status',
      stage: 'retrieved',
      message: `🍃 MongoDB Atlas — returned ${hits.length} passage(s). Handing off to Bedrock Claude to answer…`,
    });

    return {
      results: hits.map(h => ({
        title: (h.metadata?.title as string) ?? 'Mastra docs',
        pageUrl: (h.metadata?.pageUrl as string) ?? '',
        mdUrl: (h.metadata?.mdUrl as string) ?? '',
        score: h.score,
        text: (h.metadata?.text as string) ?? '',
      })),
    };
  },
});
