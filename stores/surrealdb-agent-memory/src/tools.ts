import { createTool } from '@mastra/core/tools';
import { AgentMemoryError } from '@surrealdb/memory';
import type { AgentMemory as AgentMemoryClient } from '@surrealdb/memory';
import { z } from 'zod';
import { memoryLens } from './scopes';

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

export interface AgentMemoryToolsOptions {
  /** Scope prefix for the agent's resource and thread. Match `AgentMemory`'s `scopePrefix`. Defaults to `'mastra'`. */
  scopePrefix?: string;
  /**
   * Let the tools read and write the whole Agent Memory context when the agent
   * call has no resource or thread. Only for a context that serves a single user.
   * Defaults to `false`: such calls return an error instead.
   */
  allowUnscoped?: boolean;
}

const MISSING_IDENTITY = {
  error:
    'Agent Memory tools need the agent to run with memory (a resourceId or threadId). Set allowUnscoped to use the whole context.',
} as const;

type ToolContext = { agent?: { resourceId?: string; threadId?: string } } | undefined;

/**
 * Build a Mastra toolset that lets an agent call Agent Memory explicitly:
 * store facts, semantically recall memory, forget, fetch assembled context,
 * and search the document corpus (RAG).
 *
 * When an agent with memory runs a tool, writes are tagged with, and reads are
 * narrowed to, the scopes of the agent's current resource and thread, the same
 * region `AgentMemory` uses.
 *
 * @example
 * const agent = new Agent({ ..., tools: createAgentMemoryTools(client) });
 */
export function createAgentMemoryTools(agentMemory: AgentMemoryClient, options: AgentMemoryToolsOptions = {}) {
  const prefix = options.scopePrefix ?? 'mastra';
  /**
   * Runs `fn` with the agent's scopes. Without an identity the call would reach
   * every user's facts in a shared context, so it is refused unless opted into.
   */
  const scoped = <T>(context: ToolContext, fn: (scopes: string[][] | undefined) => Promise<T>) => {
    const scopes = memoryLens(prefix, context?.agent?.resourceId, context?.agent?.threadId);
    if (!scopes && !options.allowUnscoped) return Promise.resolve(MISSING_IDENTITY);
    return safe(() => fn(scopes));
  };

  return {
    agentMemoryRemember: createTool({
      id: 'agent-memory-remember',
      description: 'Persist a fact or note to long-term memory so it can be recalled later.',
      inputSchema: z.object({
        text: z.string().describe('The fact or note to remember.'),
        labels: z.array(z.string()).optional().describe('Optional key=value labels to tag the memory.'),
      }),
      execute: async (input, context) =>
        scoped(context, scopes => agentMemory.remember(input.text, { labels: input.labels, scopes })),
    }),

    agentMemoryRecall: createTool({
      id: 'agent-memory-recall',
      description: 'Semantically recall facts and passages from long-term memory for a query.',
      inputSchema: z.object({
        query: z.string().describe('What to recall.'),
        k: z.number().int().positive().optional().describe('Maximum number of hits to return.'),
      }),
      execute: async (input, context) =>
        scoped(context, async lens => {
          const res = await agentMemory.recall(input.query, { k: input.k, lens });
          return { hits: res.hits };
        }),
    }),

    agentMemoryForget: createTool({
      id: 'agent-memory-forget',
      description: 'Forget memory matching a natural-language query across the whole memory context.',
      inputSchema: z.object({
        query: z.string().describe('What to forget.'),
        purge: z.boolean().optional().describe('Hard-delete instead of tombstoning.'),
      }),
      // Agent Memory's forget cannot be scoped, so it always reaches the whole context.
      execute: async input =>
        options.allowUnscoped
          ? safe(() => agentMemory.forget(input.query, { purge: input.purge }))
          : {
              error:
                'agentMemoryForget acts on the whole Agent Memory context. Set allowUnscoped to enable it for a single-user context.',
            },
    }),

    agentMemoryContext: createTool({
      id: 'agent-memory-context',
      description: 'Retrieve an assembled context block from memory for a query.',
      inputSchema: z.object({
        query: z.string().describe('The query to assemble context for.'),
        k: z.number().int().positive().optional(),
      }),
      execute: async (input, context) =>
        scoped(context, lens => agentMemory.context(input.query, { k: input.k, lens })),
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
