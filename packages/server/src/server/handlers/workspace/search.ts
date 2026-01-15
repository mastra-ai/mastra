/**
 * Workspace Search Handlers
 *
 * Provides REST API for workspace search operations.
 */

import type { Workspace } from '@mastra/core/workspace';
import { HTTPException } from '../../http-exception';
import {
  searchQuerySchema,
  searchResponseSchema,
  indexBodySchema,
  indexResponseSchema,
  unindexQuerySchema,
  unindexResponseSchema,
} from '../../schemas/workspace';
import { createRoute } from '../../server-adapter/routes/route-builder';
import { handleError } from '../error';

/**
 * Get the workspace from Mastra.
 */
function getWorkspace(mastra: any): Workspace | undefined {
  return mastra.getWorkspace?.();
}

// =============================================================================
// Search Routes
// =============================================================================

export const WORKSPACE_SEARCH_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/search',
  responseType: 'json',
  queryParamSchema: searchQuerySchema,
  responseSchema: searchResponseSchema,
  summary: 'Search workspace content',
  description: 'Searches across indexed workspace content using BM25, vector, or hybrid search',
  tags: ['Workspace'],
  handler: async ({ mastra, query, topK, mode, minScore }) => {
    try {
      if (!query) {
        throw new HTTPException(400, { message: 'Search query is required' });
      }

      const workspace = getWorkspace(mastra);
      if (!workspace) {
        return {
          results: [],
          query,
          mode: mode || 'bm25',
        };
      }

      // Check search capabilities
      const canSearch = workspace.canBM25 || workspace.canVector;
      if (!canSearch) {
        return {
          results: [],
          query,
          mode: mode || 'bm25',
        };
      }

      // Determine search mode based on capabilities
      let searchMode = mode;
      if (!searchMode) {
        if (workspace.canHybrid) {
          searchMode = 'hybrid';
        } else if (workspace.canVector) {
          searchMode = 'vector';
        } else {
          searchMode = 'bm25';
        }
      }

      const results = await workspace.search(query, {
        topK: topK || 5,
        mode: searchMode,
        minScore,
      });

      return {
        results: results.map(r => ({
          id: r.id,
          content: r.content,
          score: r.score,
          lineRange: r.lineRange,
          scoreDetails: r.scoreDetails,
        })),
        query,
        mode: searchMode,
      };
    } catch (error) {
      return handleError(error, 'Error searching workspace');
    }
  },
});

export const WORKSPACE_INDEX_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workspace/index',
  responseType: 'json',
  bodySchema: indexBodySchema,
  responseSchema: indexResponseSchema,
  summary: 'Index content for search',
  description: 'Indexes content for later search operations',
  tags: ['Workspace'],
  handler: async ({ mastra, path, content, metadata }) => {
    try {
      if (!path || content === undefined) {
        throw new HTTPException(400, { message: 'Path and content are required' });
      }

      const workspace = getWorkspace(mastra);
      if (!workspace) {
        throw new HTTPException(404, { message: 'No workspace configured' });
      }

      const canSearch = workspace.canBM25 || workspace.canVector;
      if (!canSearch) {
        throw new HTTPException(400, { message: 'Workspace does not have search configured' });
      }

      await workspace.index(path, content, { metadata });

      return {
        success: true,
        path,
      };
    } catch (error) {
      return handleError(error, 'Error indexing content');
    }
  },
});

export const WORKSPACE_UNINDEX_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/workspace/unindex',
  responseType: 'json',
  queryParamSchema: unindexQuerySchema,
  responseSchema: unindexResponseSchema,
  summary: 'Remove content from search index',
  description: 'Removes previously indexed content from the search index',
  tags: ['Workspace'],
  handler: async ({ mastra, path }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
      if (!workspace) {
        throw new HTTPException(404, { message: 'No workspace configured' });
      }

      const canSearch = workspace.canBM25 || workspace.canVector;
      if (!canSearch) {
        throw new HTTPException(400, { message: 'Workspace does not have search configured' });
      }

      await workspace.unindex(path);

      return {
        success: true,
        path,
      };
    } catch (error) {
      return handleError(error, 'Error unindexing content');
    }
  },
});

// Export all search routes
export const WORKSPACE_SEARCH_ROUTES = [WORKSPACE_SEARCH_ROUTE, WORKSPACE_INDEX_ROUTE, WORKSPACE_UNINDEX_ROUTE];
