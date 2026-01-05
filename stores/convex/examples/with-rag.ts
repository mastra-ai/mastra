/**
 * Mastra RAG with Convex Vector Storage
 *
 * Use Convex to store embeddings for retrieval-augmented generation.
 */

import { Mastra } from '@mastra/core';
import { createAgent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { ConvexStore, ConvexVector, COMMON_EMBEDDING_DIMENSIONS } from '@mastra/convex';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Storage adapters
const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

const vectors = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  authToken: process.env.CONVEX_AUTH_TOKEN!,
});

// Embedder
const embedder = openai.embedding('text-embedding-3-small');

// Create a search tool
const searchDocs = createTool({
  id: 'search-docs',
  description: 'Search the knowledge base for relevant documents',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        content: z.string(),
        score: z.number(),
      })
    ),
  }),
  execute: async ({ context, inputData }) => {
    // Get embedding for query
    const { embedding } = await embedder.doEmbed({
      values: [inputData.query],
    });

    // Search Convex vectors
    const results = await vectors.query({
      indexName: 'knowledge-base',
      queryVector: embedding[0],
      topK: 5,
    });

    return {
      results: results.map(r => ({
        content: r.metadata?.content ?? '',
        score: r.score,
      })),
    };
  },
});

// Agent with RAG
const ragAgent = createAgent({
  name: 'rag-assistant',
  instructions: `You are a helpful assistant with access to a knowledge base.
Use the search-docs tool to find relevant information before answering questions.`,
  model: openai('gpt-4o'),
  tools: { searchDocs },
});

// Initialize Mastra
const mastra = new Mastra({
  storage,
  vectors: { default: vectors },
  agents: { 'rag-assistant': ragAgent },
});

// Index documents
async function indexDocuments(docs: { id: string; content: string }[]) {
  // Create index if needed
  try {
    await vectors.createIndex({
      indexName: 'knowledge-base',
      dimension: COMMON_EMBEDDING_DIMENSIONS.OPENAI_3_SMALL,
    });
  } catch {
    // Index exists
  }

  // Embed and upsert
  const embeddings = await Promise.all(
    docs.map(async doc => {
      const { embedding } = await embedder.doEmbed({ values: [doc.content] });
      return embedding[0];
    })
  );

  await vectors.upsert({
    indexName: 'knowledge-base',
    vectors: embeddings,
    ids: docs.map(d => d.id),
    metadata: docs.map(d => ({ content: d.content })),
  });
}

// Chat with RAG
async function chat(question: string) {
  const agent = mastra.getAgent('rag-assistant');
  const response = await agent.generate(question);
  return response.text;
}
