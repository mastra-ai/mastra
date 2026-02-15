import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { requireWorkspace } from './helpers';

export const searchTool = createTool({
  id: WORKSPACE_TOOLS.SEARCH.SEARCH,
  description:
    'Search indexed content in the workspace. Supports keyword (BM25), semantic (vector), and hybrid search modes.',
  inputSchema: z.object({
    query: z.string().describe('The search query string'),
    topK: z.number().optional().default(5).describe('Maximum number of results to return'),
    mode: z
      .enum(['bm25', 'vector', 'hybrid'])
      .optional()
      .describe('Search mode: bm25 for keyword search, vector for semantic search, hybrid for both combined'),
    minScore: z.number().optional().describe('Minimum score threshold (0-1 for normalized scores)'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string().describe('Document/file path'),
        content: z.string().describe('The matching content'),
        score: z.number().describe('Relevance score'),
        lineRange: z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .optional()
          .describe('Line range where query terms were found'),
      }),
    ),
    count: z.number().describe('Number of results returned'),
    mode: z.string().describe('The search mode that was used'),
  }),
  execute: async ({ query, topK, mode, minScore }, context) => {
    const workspace = requireWorkspace(context);

    const results = await workspace.search(query, {
      topK,
      mode: mode as 'bm25' | 'vector' | 'hybrid' | undefined,
      minScore,
    });

    return {
      results: results.map(r => ({
        id: r.id,
        content: r.content,
        score: r.score,
        lineRange: r.lineRange,
      })),
      count: results.length,
      mode: mode ?? (workspace.canHybrid ? 'hybrid' : workspace.canVector ? 'vector' : 'bm25'),
    };
  },
});
