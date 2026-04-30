import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { emitWorkspaceMetadata, requireWorkspace } from './helpers';
import { startWorkspaceSpan } from './tracing';

export const searchInputSchema = z.object({
  query: z.string().describe('The search query string'),
  topK: z.number().optional().default(5).describe('Maximum number of results to return'),
  mode: z
    .enum(['bm25', 'vector', 'hybrid'])
    .optional()
    .describe('Search mode: bm25 for keyword search, vector for semantic search, hybrid for both combined'),
  minScore: z.number().optional().describe('Minimum score threshold (0-1 for normalized scores)'),
});

export const searchTool = createTool({
  id: WORKSPACE_TOOLS.SEARCH.SEARCH,
  description:
    'Search indexed content in the workspace. Supports keyword (BM25), semantic (vector), and hybrid search modes.',
  inputSchema: searchInputSchema,
  execute: async ({ query, topK, mode, minScore }, context) => {
    const workspace = requireWorkspace(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SEARCH.SEARCH);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'search',
      operation: 'search',
      input: { query, topK, mode, minScore },
      attributes: {},
    });

    try {
      // Resolve effective mode before searching — fall back gracefully if requested
      // mode isn't supported (e.g. 'hybrid' requested but only BM25 configured)
      const effectiveMode =
        mode === 'hybrid' && !workspace.canHybrid
          ? workspace.canVector
            ? 'vector'
            : 'bm25'
          : mode === 'vector' && !workspace.canVector
            ? 'bm25'
            : (mode ?? (workspace.canHybrid ? 'hybrid' : workspace.canVector ? 'vector' : 'bm25'));

      const results = await workspace.search(query, {
        topK,
        mode: effectiveMode as 'bm25' | 'vector' | 'hybrid' | undefined,
        minScore,
      });

      const lines = results.map(r => {
        const lineInfo = r.lineRange ? `:${r.lineRange.start}-${r.lineRange.end}` : '';
        return `${r.id}${lineInfo}: ${r.content}`;
      });

      lines.push('---');
      lines.push(`${results.length} result${results.length !== 1 ? 's' : ''} (${effectiveMode} search)`);

      span.end({ success: true }, { resultCount: results.length });
      return lines.join('\n');
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
