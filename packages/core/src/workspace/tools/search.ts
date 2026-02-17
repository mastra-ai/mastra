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
  execute: async ({ query, topK, mode, minScore }, context) => {
    const workspace = requireWorkspace(context);

    const results = await workspace.search(query, {
      topK,
      mode: mode as 'bm25' | 'vector' | 'hybrid' | undefined,
      minScore,
    });

    const effectiveMode = mode ?? (workspace.canHybrid ? 'hybrid' : workspace.canVector ? 'vector' : 'bm25');

    await context?.writer?.custom({
      type: 'data-workspace-metadata',
      data: {
        toolName: WORKSPACE_TOOLS.SEARCH.SEARCH,
        count: results.length,
        mode: effectiveMode,
        workspace: { id: workspace.id, name: workspace.name },
      },
    });

    const lines = results.map(r => {
      const lineInfo = r.lineRange ? `:${r.lineRange.start}-${r.lineRange.end}` : '';
      return `${r.id}${lineInfo}: ${r.content}`;
    });

    lines.push('---');
    lines.push(`${results.length} result${results.length !== 1 ? 's' : ''} (${effectiveMode} search)`);

    return lines.join('\n');
  },
});
