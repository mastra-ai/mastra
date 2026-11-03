import { createTool } from '@mastra/core/tools';
import { AgentMemoryError } from '@surrealdb/memory';
import type { AgentMemory as AgentMemoryClient } from '@surrealdb/memory';
import { z } from 'zod';

/** Run an Agent Memory call for a tool, returning a structured error instead of throwing. */
async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AgentMemoryError) {
      return {
        error: `${err.status} ${err.title}: ${err.detail ?? ''}`.trim(),
      };
    }
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Build a Mastra toolset that lets an agent call Agent Memory explicitly:
 * store facts, semantically recall memory, forget, fetch assembled context,
 * and search the document corpus (RAG).
 *
 * @example
 * const agent = new Agent({ ..., tools: createAgentMemoryTools(client) });
 */
export function createAgentMemoryTools(agentMemory: AgentMemoryClient) {
  return {
    agentMemoryRemember: createTool({
      id: 'agent-memory-remember',
      description: 'Persist a fact or note to long-term memory so it can be recalled later.',
      inputSchema: z.object({
        text: z.string().describe('The fact or note to remember.'),
        labels: z.array(z.string()).optional().describe('Optional key=value labels to tag the memory.'),
      }),
      execute: async input => safe(() => agentMemory.remember(input.text, { labels: input.labels })),
    }),

    agentMemoryRecall: createTool({
      id: 'agent-memory-recall',
      description: 'Semantically recall facts and passages from long-term memory for a query.',
      inputSchema: z.object({
        query: z.string().describe('What to recall.'),
        k: z.number().int().positive().optional().describe('Maximum number of hits to return.'),
      }),
      execute: async input =>
        safe(async () => {
          const res = await agentMemory.recall(input.query, {
            k: input.k,
          });
          return { hits: res.hits };
        }),
    }),

    agentMemoryForget: createTool({
      id: 'agent-memory-forget',
      description: 'Forget memory matching a natural-language query.',
      inputSchema: z.object({
        query: z.string().describe('What to forget.'),
        purge: z.boolean().optional().describe('Hard-delete instead of tombstoning.'),
      }),
      execute: async input => safe(() => agentMemory.forget(input.query, { purge: input.purge })),
    }),

    agentMemoryContext: createTool({
      id: 'agent-memory-context',
      description: 'Retrieve an assembled context block from memory for a query.',
      inputSchema: z.object({
        query: z.string().describe('The query to assemble context for.'),
        k: z.number().int().positive().optional(),
      }),
      execute: async input => safe(() => agentMemory.context(input.query, { k: input.k })),
    }),

    agentMemorySearchDocuments: createTool({
      id: 'agent-memory-search-documents',
      description: 'Search the ingested document corpus (hybrid/vector/BM25) for relevant chunks.',
      inputSchema: z.object({
        query: z.string().describe('The search query.'),
        k: z.number().int().positive().optional(),
        mode: z
          .enum(['hybrid', 'vector', 'bm25', 'hybrid_graph'])
          .optional()
          .describe('Retrieval mode. Defaults to hybrid.'),
      }),
      execute: async input =>
        safe(() =>
          agentMemory.documents.query({
            query: input.query,
            k: input.k,
            mode: input.mode,
          }),
        ),
    }),
  };
}
