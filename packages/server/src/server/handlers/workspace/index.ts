/**
 * Workspace Handlers
 *
 * Unified handlers for workspace operations including:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index, unindex)
 * - Skills operations (list, get, search, references)
 */

import type { Workspace } from '@mastra/core/workspace';
import { workspaceInfoResponseSchema } from '../../schemas/workspace';
import { createRoute } from '../../server-adapter/routes/route-builder';
import { handleError } from '../error';

// Re-export all workspace routes
export { WORKSPACE_FS_ROUTES } from './fs';
export { WORKSPACE_SEARCH_ROUTES } from './search';
export { WORKSPACE_SKILLS_ROUTES } from './skills';

/**
 * Get the workspace from Mastra.
 */
function getWorkspace(mastra: any): Workspace | undefined {
  return mastra.getWorkspace?.();
}

// =============================================================================
// Workspace Info Route
// =============================================================================

export const WORKSPACE_INFO_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace',
  responseType: 'json',
  responseSchema: workspaceInfoResponseSchema,
  summary: 'Get workspace info',
  description: 'Returns information about the configured workspace and its capabilities',
  tags: ['Workspace'],
  handler: async ({ mastra }) => {
    try {
      const workspace = getWorkspace(mastra);

      if (!workspace) {
        return {
          isWorkspaceConfigured: false,
        };
      }

      return {
        isWorkspaceConfigured: true,
        id: workspace.id,
        name: workspace.name,
        status: workspace.status,
        capabilities: {
          hasFilesystem: !!workspace.fs,
          hasSandbox: !!workspace.sandbox,
          canBM25: workspace.canBM25,
          canVector: workspace.canVector,
          canHybrid: workspace.canHybrid,
          hasSkills: !!workspace.skills,
        },
      };
    } catch (error) {
      return handleError(error, 'Error getting workspace info');
    }
  },
});
