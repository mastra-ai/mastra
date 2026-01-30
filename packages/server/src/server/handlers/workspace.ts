/**
 * Workspace Handlers
 *
 * Unified handlers for workspace operations including:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index)
 * - Skills operations (list, get, search, references)
 */

import { coreFeatures } from '@mastra/core/features';
import type { Workspace, WorkspaceSkills } from '@mastra/core/workspace';

import { HTTPException } from '../http-exception';
import {
  // Workspace info
  workspaceInfoResponseSchema,
  listWorkspacesResponseSchema,
  workspaceIdPathParams,
  // Filesystem schemas
  fsReadQuerySchema,
  fsListQuerySchema,
  fsStatQuerySchema,
  fsDeleteQuerySchema,
  fsWriteBodySchema,
  fsMkdirBodySchema,
  fsReadResponseSchema,
  fsWriteResponseSchema,
  fsListResponseSchema,
  fsDeleteResponseSchema,
  fsMkdirResponseSchema,
  fsStatResponseSchema,
  // Search schemas
  searchQuerySchema,
  searchResponseSchema,
  indexBodySchema,
  indexResponseSchema,
  // Skills schemas
  skillNamePathParams,
  skillReferencePathParams,
  searchSkillsQuerySchema,
  listSkillsResponseSchema,
  getSkillResponseSchema,
  skillReferenceResponseSchema,
  listReferencesResponseSchema,
  searchSkillsResponseSchema,
  // skills.sh proxy schemas
  skillsShSearchQuerySchema,
  skillsShPopularQuerySchema,
  skillsShSearchResponseSchema,
  skillsShListResponseSchema,
  skillsShPreviewQuerySchema,
  skillsShInstallBodySchema,
  skillsShInstallResponseSchema,
  skillsShPreviewResponseSchema,
  skillsShRemoveBodySchema,
  skillsShRemoveResponseSchema,
  skillsShUpdateBodySchema,
  skillsShUpdateResponseSchema,
} from '../schemas/workspace';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an error is a workspace filesystem not-found error.
 * Handles Node.js ENOENT and workspace FileNotFoundError/DirectoryNotFoundError.
 */
function isFilesystemNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for Node.js native ENOENT
  if ('code' in error && error.code === 'ENOENT') return true;

  // Check for workspace FileNotFoundError / DirectoryNotFoundError
  if ('name' in error) {
    const name = error.name;
    if (name === 'FileNotFoundError' || name === 'DirectoryNotFoundError') return true;
  }

  return false;
}

/**
 * Workspace-specific error handler.
 * Converts filesystem not-found errors to 404, then falls back to generic handler.
 */
function handleWorkspaceError(error: unknown, defaultMessage: string): never {
  if (isFilesystemNotFoundError(error)) {
    const message = error instanceof Error ? error.message : 'Not found';
    throw new HTTPException(404, { message });
  }
  return handleError(error, defaultMessage);
}

/**
 * Throws if workspace v1 is not supported by the current version of @mastra/core.
 */
function requireWorkspaceV1Support(): void {
  if (!coreFeatures.has('workspaces-v1')) {
    throw new HTTPException(501, {
      message: 'Workspace v1 not supported by this version of @mastra/core. Please upgrade to a newer version.',
    });
  }
}

/**
 * Get a workspace by ID from Mastra or agents.
 * If no workspaceId is provided, returns the global workspace.
 */
async function getWorkspaceById(mastra: any, workspaceId?: string): Promise<Workspace | undefined> {
  requireWorkspaceV1Support();
  const globalWorkspace = mastra.getWorkspace?.();

  // If no workspaceId specified, return global workspace
  if (!workspaceId) {
    return globalWorkspace;
  }

  // Check if it's the global workspace
  if (globalWorkspace?.id === workspaceId) {
    return globalWorkspace;
  }

  // Search through agents for the workspace
  const agents = mastra.listAgents?.() ?? {};
  for (const agent of Object.values(agents)) {
    if ((agent as any).hasOwnWorkspace?.()) {
      const agentWorkspace = await (agent as any).getWorkspace?.();
      if (agentWorkspace?.id === workspaceId) {
        return agentWorkspace;
      }
    }
  }

  return undefined;
}

/**
 * Get skills from a specific workspace by ID.
 * If no workspaceId is provided, returns skills from the global workspace.
 * Note: getWorkspaceById already checks for workspace v1 support.
 */
async function getSkillsById(mastra: any, workspaceId?: string): Promise<WorkspaceSkills | undefined> {
  const workspace = await getWorkspaceById(mastra, workspaceId);
  return workspace?.skills;
}

// =============================================================================
// List All Workspaces Route
// =============================================================================

export const LIST_WORKSPACES_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces',
  responseType: 'json',
  responseSchema: listWorkspacesResponseSchema,
  summary: 'List all workspaces',
  description: 'Returns all workspaces from both Mastra instance and agents',
  tags: ['Workspace'],
  handler: async ({ mastra }) => {
    try {
      requireWorkspaceV1Support();

      const workspaces: Array<{
        id: string;
        name: string;
        status: string;
        source: 'mastra' | 'agent';
        agentId?: string;
        agentName?: string;
        capabilities: {
          hasFilesystem: boolean;
          hasSandbox: boolean;
          canBM25: boolean;
          canVector: boolean;
          canHybrid: boolean;
          hasSkills: boolean;
        };
        safety: {
          readOnly: boolean;
        };
      }> = [];

      const seenIds = new Set<string>();

      // Get workspace from Mastra instance
      const globalWorkspace = mastra.getWorkspace?.();
      if (globalWorkspace) {
        seenIds.add(globalWorkspace.id);
        workspaces.push({
          id: globalWorkspace.id,
          name: globalWorkspace.name,
          status: globalWorkspace.status,
          source: 'mastra',
          capabilities: {
            hasFilesystem: !!globalWorkspace.filesystem,
            hasSandbox: !!globalWorkspace.sandbox,
            canBM25: globalWorkspace.canBM25,
            canVector: globalWorkspace.canVector,
            canHybrid: globalWorkspace.canHybrid,
            hasSkills: !!globalWorkspace.skills,
          },
          safety: {
            readOnly: globalWorkspace.filesystem?.readOnly ?? false,
          },
        });
      }

      // Get workspaces from agents
      const agents = mastra.listAgents?.() ?? {};
      for (const [agentId, agent] of Object.entries(agents)) {
        if (agent.hasOwnWorkspace?.()) {
          try {
            const agentWorkspace = await agent.getWorkspace?.();
            if (agentWorkspace && !seenIds.has(agentWorkspace.id)) {
              seenIds.add(agentWorkspace.id);
              workspaces.push({
                id: agentWorkspace.id,
                name: agentWorkspace.name,
                status: agentWorkspace.status,
                source: 'agent',
                agentId,
                agentName: agent.name,
                capabilities: {
                  hasFilesystem: !!agentWorkspace.filesystem,
                  hasSandbox: !!agentWorkspace.sandbox,
                  canBM25: agentWorkspace.canBM25,
                  canVector: agentWorkspace.canVector,
                  canHybrid: agentWorkspace.canHybrid,
                  hasSkills: !!agentWorkspace.skills,
                },
                safety: {
                  readOnly: agentWorkspace.filesystem?.readOnly ?? false,
                },
              });
            }
          } catch {
            // Skip agents with dynamic workspaces that fail without thread context
            continue;
          }
        }
      }

      return { workspaces };
    } catch (error) {
      return handleWorkspaceError(error, 'Error listing workspaces');
    }
  },
});

// =============================================================================
// Get Workspace Route
// =============================================================================

export const GET_WORKSPACE_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  responseSchema: workspaceInfoResponseSchema,
  summary: 'Get workspace info',
  description: 'Returns information about a specific workspace and its capabilities',
  tags: ['Workspace'],
  handler: async ({ mastra, workspaceId }) => {
    try {
      const workspace = await getWorkspaceById(mastra, workspaceId);

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
          hasFilesystem: !!workspace.filesystem,
          hasSandbox: !!workspace.sandbox,
          canBM25: workspace.canBM25,
          canVector: workspace.canVector,
          canHybrid: workspace.canHybrid,
          hasSkills: !!workspace.skills,
        },
        safety: {
          readOnly: workspace.filesystem?.readOnly ?? false,
        },
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error getting workspace info');
    }
  },
});

// =============================================================================
// Filesystem Routes
// =============================================================================

export const WORKSPACE_FS_READ_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/fs/read',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: fsReadQuerySchema,
  responseSchema: fsReadResponseSchema,
  summary: 'Read file content',
  description: 'Returns the content of a file at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, encoding, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.filesystem.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      // Read file content
      const content = await workspace.filesystem.readFile(decodedPath, {
        encoding: (encoding as BufferEncoding) || 'utf-8',
      });

      return {
        path: decodedPath,
        content: typeof content === 'string' ? content : content.toString('utf-8'),
        type: 'file' as const,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error reading file');
    }
  },
});

export const WORKSPACE_FS_WRITE_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/fs/write',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: fsWriteBodySchema,
  responseSchema: fsWriteResponseSchema,
  summary: 'Write file content',
  description: 'Writes content to a file at the specified path. Supports base64 encoding for binary files.',
  tags: ['Workspace'],
  handler: async ({ mastra, path, content, encoding, recursive, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path || content === undefined) {
        throw new HTTPException(400, { message: 'Path and content are required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      if (workspace.filesystem?.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is in read-only mode' });
      }

      const decodedPath = decodeURIComponent(path);

      // Handle base64-encoded content for binary files
      let fileContent: string | Buffer = content;
      if (encoding === 'base64') {
        fileContent = Buffer.from(content, 'base64');
      }

      await workspace.filesystem.writeFile(decodedPath, fileContent, { recursive: recursive ?? true });

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error writing file');
    }
  },
});

export const WORKSPACE_FS_LIST_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/fs/list',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: fsListQuerySchema,
  responseSchema: fsListResponseSchema,
  summary: 'List directory contents',
  description: 'Returns a list of files and directories at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        return {
          path: decodeURIComponent(path),
          entries: [],
          error: 'No workspace filesystem configured',
        };
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.filesystem.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      const entries = await workspace.filesystem.readdir(decodedPath, { recursive });

      return {
        path: decodedPath,
        entries: entries.map(entry => ({
          name: entry.name,
          type: entry.type,
          size: entry.size,
        })),
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error listing directory');
    }
  },
});

export const WORKSPACE_FS_DELETE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/workspaces/:workspaceId/fs/delete',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: fsDeleteQuerySchema,
  responseSchema: fsDeleteResponseSchema,
  summary: 'Delete file or directory',
  description: 'Deletes a file or directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, force, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      if (workspace.filesystem?.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is in read-only mode' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists (unless force is true)
      const exists = await workspace.filesystem.exists(decodedPath);
      if (!exists && !force) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      if (exists) {
        // Try to delete as file first, then as directory
        try {
          await workspace.filesystem.deleteFile(decodedPath, { force });
        } catch {
          await workspace.filesystem.rmdir(decodedPath, { recursive, force });
        }
      }

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error deleting path');
    }
  },
});

export const WORKSPACE_FS_MKDIR_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/fs/mkdir',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: fsMkdirBodySchema,
  responseSchema: fsMkdirResponseSchema,
  summary: 'Create directory',
  description: 'Creates a directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      if (workspace.filesystem?.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is in read-only mode' });
      }

      const decodedPath = decodeURIComponent(path);

      await workspace.filesystem.mkdir(decodedPath, { recursive: recursive ?? true });

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error creating directory');
    }
  },
});

export const WORKSPACE_FS_STAT_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/fs/stat',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: fsStatQuerySchema,
  responseSchema: fsStatResponseSchema,
  summary: 'Get file/directory info',
  description: 'Returns metadata about a file or directory',
  tags: ['Workspace'],
  handler: async ({ mastra, path, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.filesystem) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.filesystem.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      const stat = await workspace.filesystem.stat(decodedPath);

      return {
        path: stat.path,
        type: stat.type,
        size: stat.size,
        createdAt: stat.createdAt?.toISOString(),
        modifiedAt: stat.modifiedAt?.toISOString(),
        mimeType: stat.mimeType,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error getting file info');
    }
  },
});

// =============================================================================
// Search Routes
// =============================================================================

export const WORKSPACE_SEARCH_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/search',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: searchQuerySchema,
  responseSchema: searchResponseSchema,
  summary: 'Search workspace content',
  description: 'Searches across indexed workspace content using BM25, vector, or hybrid search',
  tags: ['Workspace'],
  handler: async ({ mastra, query, topK, mode, minScore, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!query) {
        throw new HTTPException(400, { message: 'Search query is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
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
      return handleWorkspaceError(error, 'Error searching workspace');
    }
  },
});

export const WORKSPACE_INDEX_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/index',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: indexBodySchema,
  responseSchema: indexResponseSchema,
  summary: 'Index content for search',
  description: 'Indexes content for later search operations',
  tags: ['Workspace'],
  handler: async ({ mastra, path, content, metadata, workspaceId }) => {
    try {
      requireWorkspaceV1Support();

      if (!path || content === undefined) {
        throw new HTTPException(400, { message: 'Path and content are required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
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
      return handleWorkspaceError(error, 'Error indexing content');
    }
  },
});

// =============================================================================
// Skills Routes (under /workspaces/:workspaceId/skills)
// =============================================================================

export const WORKSPACE_LIST_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  responseSchema: listSkillsResponseSchema,
  summary: 'List all skills',
  description: 'Returns a list of all discovered skills with their metadata',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId, requestContext }) => {
    try {
      requireWorkspaceV1Support();

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        return { skills: [], isSkillsConfigured: false };
      }

      // Refresh skills with request context (handles dynamic skill resolvers)
      await skills.maybeRefresh({ requestContext });

      const skillsList = await skills.list();

      // Get full skill details to include path in response
      // Handle individual skill fetch failures gracefully to avoid failing the entire list
      const skillsWithPath = await Promise.all(
        skillsList.map(async skillMeta => {
          let path = '';
          try {
            const fullSkill = await skills.get(skillMeta.name);
            path = fullSkill?.path ?? '';
          } catch {
            // Fall back to empty path if skill details can't be loaded
          }
          return {
            name: skillMeta.name,
            description: skillMeta.description,
            license: skillMeta.license,
            compatibility: skillMeta.compatibility,
            metadata: skillMeta.metadata,
            path,
          };
        }),
      );

      return {
        skills: skillsWithPath,
        isSkillsConfigured: true,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error listing skills');
    }
  },
});

export const WORKSPACE_GET_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills/:skillName',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: getSkillResponseSchema,
  summary: 'Get skill details',
  description: 'Returns the full details of a specific skill including instructions and file lists',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, workspaceId, requestContext }) => {
    try {
      requireWorkspaceV1Support();

      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      // Refresh skills with request context (handles dynamic skill resolvers)
      await skills.maybeRefresh({ requestContext });

      const skill = await skills.get(skillName);
      if (!skill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      return {
        name: skill.name,
        description: skill.description,
        license: skill.license,
        compatibility: skill.compatibility,
        metadata: skill.metadata,
        path: skill.path,
        instructions: skill.instructions,
        source: skill.source,
        references: skill.references,
        scripts: skill.scripts,
        assets: skill.assets,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error getting skill');
    }
  },
});

export const WORKSPACE_LIST_SKILL_REFERENCES_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills/:skillName/references',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  responseSchema: listReferencesResponseSchema,
  summary: 'List skill references',
  description: 'Returns a list of all reference file paths for a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, workspaceId, requestContext }) => {
    try {
      requireWorkspaceV1Support();

      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      // Refresh skills with request context (handles dynamic skill resolvers)
      await skills.maybeRefresh({ requestContext });

      const hasSkill = await skills.has(skillName);
      if (!hasSkill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      const references = await skills.listReferences(skillName);

      return {
        skillName,
        references,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error listing skill references');
    }
  },
});

export const WORKSPACE_GET_SKILL_REFERENCE_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills/:skillName/references/:referencePath',
  responseType: 'json',
  pathParamSchema: skillReferencePathParams,
  responseSchema: skillReferenceResponseSchema,
  summary: 'Get skill reference content',
  description: 'Returns the content of a specific reference file from a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, referencePath, workspaceId, requestContext }) => {
    try {
      requireWorkspaceV1Support();

      if (!skillName || !referencePath) {
        throw new HTTPException(400, { message: 'Skill name and reference path are required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

      // Refresh skills with request context (handles dynamic skill resolvers)
      await skills.maybeRefresh({ requestContext });

      // Decode the reference path (it may be URL encoded)
      const decodedPath = decodeURIComponent(referencePath);

      const content = await skills.getReference(skillName, decodedPath);
      if (content === null) {
        throw new HTTPException(404, { message: `Reference "${decodedPath}" not found in skill "${skillName}"` });
      }

      return {
        skillName,
        referencePath: decodedPath,
        content,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error getting skill reference');
    }
  },
});

export const WORKSPACE_SEARCH_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills/search',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: searchSkillsQuerySchema,
  responseSchema: searchSkillsResponseSchema,
  summary: 'Search skills',
  description: 'Searches across all skills content using BM25 keyword search',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, query, topK, minScore, skillNames, includeReferences, workspaceId, requestContext }) => {
    try {
      requireWorkspaceV1Support();

      if (!query) {
        throw new HTTPException(400, { message: 'Search query is required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        return {
          results: [],
          query,
        };
      }

      // Refresh skills with request context (handles dynamic skill resolvers)
      await skills.maybeRefresh({ requestContext });

      // Parse comma-separated skill names if provided
      const skillNamesList = skillNames ? skillNames.split(',').map((s: string) => s.trim()) : undefined;

      const results = await skills.search(query, {
        topK: topK || 5,
        minScore,
        skillNames: skillNamesList,
        includeReferences: includeReferences ?? true,
      });

      return {
        results: results.map(r => ({
          skillName: r.skillName,
          source: r.source,
          content: r.content,
          score: r.score,
          lineRange: r.lineRange,
          scoreDetails: r.scoreDetails,
        })),
        query,
      };
    } catch (error) {
      return handleWorkspaceError(error, 'Error searching skills');
    }
  },
});

// =============================================================================
// skills.sh Proxy Routes
// =============================================================================

const SKILLS_SH_API_URL = 'https://skills-api-production.up.railway.app';

export const WORKSPACE_SKILLS_SH_SEARCH_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills-sh/search',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: skillsShSearchQuerySchema,
  responseSchema: skillsShSearchResponseSchema,
  summary: 'Search skills on skills.sh',
  description: 'Proxies search requests to skills.sh API to avoid CORS issues',
  tags: ['Workspace', 'Skills'],
  handler: async ({ q, limit }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${SKILLS_SH_API_URL}/api/skills?query=${encodeURIComponent(q)}&pageSize=${limit}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HTTPException(502, {
          message: `Skills API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as {
        skills: Array<{
          skillId: string;
          name: string;
          installs: number;
          source: string;
          owner: string;
          repo: string;
          githubUrl: string;
          displayName: string;
        }>;
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
      return {
        query: q,
        searchType: 'query',
        skills: data.skills.map(s => ({ id: s.skillId, name: s.name, installs: s.installs, topSource: s.source })),
        count: data.total,
      };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error searching skills');
    }
  },
});

export const WORKSPACE_SKILLS_SH_POPULAR_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills-sh/popular',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: skillsShPopularQuerySchema,
  responseSchema: skillsShListResponseSchema,
  summary: 'Get popular skills from skills.sh',
  description: 'Proxies popular skills requests to skills.sh API to avoid CORS issues',
  tags: ['Workspace', 'Skills'],
  handler: async ({ limit, offset }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const page = offset > 0 ? Math.floor(offset / limit) + 1 : 1;
      const url = `${SKILLS_SH_API_URL}/api/skills/top?pageSize=${limit}&page=${page}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HTTPException(502, {
          message: `Skills API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as {
        skills: Array<{
          skillId: string;
          name: string;
          installs: number;
          source: string;
          owner: string;
          repo: string;
          githubUrl: string;
          displayName: string;
        }>;
        total: number;
      };
      return {
        skills: data.skills.map(s => ({ id: s.skillId, name: s.name, installs: s.installs, topSource: s.source })),
        count: data.total,
        limit,
        offset,
      };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error fetching popular skills');
    }
  },
});

// =============================================================================
// Skills API helpers
// =============================================================================

/**
 * Validate skill name to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-_]*$/i;

function assertSafeSkillName(name: string): string {
  if (!SKILL_NAME_REGEX.test(name)) {
    throw new HTTPException(400, {
      message: `Invalid skill name "${name}". Names must start with alphanumeric and contain only letters, numbers, hyphens, and underscores.`,
    });
  }
  return name;
}

/**
 * Validate that a file path is safe (no traversal, no absolute paths).
 * Prevents malicious API responses from writing files outside the skill directory.
 */
function assertSafeFilePath(filePath: string): string {
  // Reject absolute paths
  if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
    throw new HTTPException(400, {
      message: `Invalid file path "${filePath}". Absolute paths are not allowed.`,
    });
  }
  // Reject path traversal attempts
  const segments = filePath.split('/');
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new HTTPException(400, {
        message: `Invalid file path "${filePath}". Path traversal is not allowed.`,
      });
    }
  }
  return filePath;
}

interface SkillFileEntry {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

interface SkillFilesResponse {
  skillId: string;
  owner: string;
  repo: string;
  branch: string;
  files: SkillFileEntry[];
}

/**
 * Fetch skill files from the Skills API.
 * Returns all files for a skill with their content.
 */
async function fetchSkillFiles(owner: string, repo: string, skillName: string): Promise<SkillFilesResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for file downloads

  const url = `${SKILLS_SH_API_URL}/api/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillName)}/files`;
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Skills API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as SkillFilesResponse;
}

// =============================================================================
// skills.sh Preview Route
// =============================================================================

export const WORKSPACE_SKILLS_SH_PREVIEW_ROUTE = createRoute({
  method: 'GET',
  path: '/workspaces/:workspaceId/skills-sh/preview',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  queryParamSchema: skillsShPreviewQuerySchema,
  responseSchema: skillsShPreviewResponseSchema,
  summary: 'Preview skill content',
  description: 'Fetches the skill content from the Skills API.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ owner, repo, path: skillName }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${SKILLS_SH_API_URL}/api/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skillName)}/content`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" for ${owner}/${repo}`,
        });
      }

      const data = (await response.json()) as { instructions: string; raw: string };
      const content = data.instructions || data.raw || '';

      if (!content) {
        throw new HTTPException(404, {
          message: `No content available for skill "${skillName}"`,
        });
      }

      return { content };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error fetching skill preview');
    }
  },
});

// =============================================================================
// skills.sh Install Route
// =============================================================================

export const WORKSPACE_SKILLS_SH_INSTALL_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/skills-sh/install',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: skillsShInstallBodySchema,
  responseSchema: skillsShInstallResponseSchema,
  summary: 'Install skill from Skills API',
  description: 'Installs a skill by fetching files from the Skills API and writing to workspace filesystem.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId, owner, repo, skillName }) => {
    try {
      requireWorkspaceV1Support();

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace) {
        throw new HTTPException(404, { message: 'Workspace not found' });
      }

      if (!workspace.filesystem) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      if (workspace.filesystem.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      // Fetch skill files from the Skills API
      const result = await fetchSkillFiles(owner, repo, skillName);
      if (!result || result.files.length === 0) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" in ${owner}/${repo}.`,
        });
      }

      // Validate skill name to prevent path traversal
      const safeSkillId = assertSafeSkillName(result.skillId);
      const installPath = `.agents/skills/${safeSkillId}`;

      // Ensure the skills directory exists
      try {
        await workspace.filesystem.mkdir(installPath, { recursive: true });
      } catch {
        // Directory might already exist
      }

      // Write all files to the workspace
      let filesWritten = 0;
      for (const file of result.files) {
        // Validate file path to prevent path traversal from API response
        const safePath = assertSafeFilePath(file.path);
        const filePath = `${installPath}/${safePath}`;

        // Create subdirectory if needed
        if (safePath.includes('/')) {
          const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
          try {
            await workspace.filesystem.mkdir(dirPath, { recursive: true });
          } catch {
            // Directory might already exist
          }
        }

        const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
        await workspace.filesystem.writeFile(filePath, content);
        filesWritten++;
      }

      // Write metadata file for update support
      const metadata = {
        skillName: result.skillId,
        owner: result.owner,
        repo: result.repo,
        branch: result.branch,
        installedAt: new Date().toISOString(),
      };
      await workspace.filesystem.writeFile(`${installPath}/.meta.json`, JSON.stringify(metadata, null, 2));
      filesWritten++;

      return {
        success: true,
        skillName: result.skillId,
        installedPath: installPath,
        filesWritten,
      };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error installing skill');
    }
  },
});

/**
 * Interface for skill metadata stored in .meta.json
 */
interface SkillMetaFile {
  skillName: string;
  owner: string;
  repo: string;
  branch: string;
  installedAt: string;
}

export const WORKSPACE_SKILLS_SH_REMOVE_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/skills-sh/remove',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: skillsShRemoveBodySchema,
  responseSchema: skillsShRemoveResponseSchema,
  summary: 'Remove an installed skill',
  description: 'Removes an installed skill by deleting its directory. Does not require sandbox.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId, skillName }) => {
    try {
      requireWorkspaceV1Support();

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace) {
        throw new HTTPException(404, { message: 'Workspace not found' });
      }

      if (!workspace.filesystem) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      if (workspace.filesystem.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      // Validate skill name to prevent path traversal
      const safeSkillName = assertSafeSkillName(skillName);
      const skillPath = `.agents/skills/${safeSkillName}`;

      // Check if skill exists
      try {
        await workspace.filesystem.stat(skillPath);
      } catch {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found at ${skillPath}` });
      }

      // Delete the skill directory
      await workspace.filesystem.rmdir(skillPath, { recursive: true });

      return {
        success: true,
        skillName,
        removedPath: skillPath,
      };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error removing skill');
    }
  },
});

export const WORKSPACE_SKILLS_SH_UPDATE_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/skills-sh/update',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: skillsShUpdateBodySchema,
  responseSchema: skillsShUpdateResponseSchema,
  summary: 'Update installed skills',
  description:
    'Updates installed skills by re-fetching from GitHub. Specify skillName to update one, or omit to update all.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId, skillName }) => {
    try {
      requireWorkspaceV1Support();

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace) {
        throw new HTTPException(404, { message: 'Workspace not found' });
      }

      if (!workspace.filesystem) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      if (workspace.filesystem.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      const skillsPath = '.agents/skills';
      const results: Array<{
        skillName: string;
        success: boolean;
        filesWritten?: number;
        error?: string;
      }> = [];

      // Get list of skills to update
      let skillsToUpdate: string[];
      if (skillName) {
        // Validate skill name to prevent path traversal
        skillsToUpdate = [assertSafeSkillName(skillName)];
      } else {
        try {
          const entries = await workspace?.filesystem?.readdir(skillsPath);
          skillsToUpdate = entries?.filter(e => e.type === 'directory').map(e => e.name) ?? [];
        } catch {
          // Skills directory doesn't exist or isn't readable - no skills to update
          // This is expected when no skills have been installed yet
          return { updated: [] };
        }
      }

      for (const skill of skillsToUpdate) {
        // Validate each skill name for safety
        try {
          assertSafeSkillName(skill);
        } catch {
          results.push({
            skillName: skill,
            success: false,
            error: 'Invalid skill name',
          });
          continue;
        }
        const metaPath = `${skillsPath}/${skill}/.meta.json`;
        try {
          const metaContent = await workspace?.filesystem?.readFile(metaPath, { encoding: 'utf-8' });
          const meta: SkillMetaFile = JSON.parse(metaContent as string);

          // Re-fetch skill files from the Skills API
          const fetchResult = await fetchSkillFiles(meta.owner, meta.repo, meta.skillName);

          if (!fetchResult || fetchResult.files.length === 0) {
            results.push({
              skillName: skill,
              success: false,
              error: 'No files found in skill directory',
            });
            continue;
          }

          const installPath = `${skillsPath}/${skill}`;
          let filesWritten = 0;

          for (const file of fetchResult.files) {
            // Validate file path to prevent path traversal from API response
            const safePath = assertSafeFilePath(file.path);
            const filePath = `${installPath}/${safePath}`;

            if (safePath.includes('/')) {
              const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
              try {
                await workspace.filesystem.mkdir(dirPath, { recursive: true });
              } catch {
                // Directory might already exist
              }
            }

            const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content;
            await workspace.filesystem.writeFile(filePath, content);
            filesWritten++;
          }

          // Update metadata with new install time and branch
          const updatedMeta: SkillMetaFile = {
            ...meta,
            branch: fetchResult.branch,
            installedAt: new Date().toISOString(),
          };
          await workspace.filesystem.writeFile(metaPath, JSON.stringify(updatedMeta, null, 2));
          filesWritten++;

          results.push({
            skillName: skill,
            success: true,
            filesWritten,
          });
        } catch (error) {
          results.push({
            skillName: skill,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { updated: results };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error updating skills');
    }
  },
});

export const WORKSPACE_SKILLS_SH_ROUTES = [
  WORKSPACE_SKILLS_SH_SEARCH_ROUTE,
  WORKSPACE_SKILLS_SH_POPULAR_ROUTE,
  WORKSPACE_SKILLS_SH_PREVIEW_ROUTE,
  WORKSPACE_SKILLS_SH_INSTALL_ROUTE,
  WORKSPACE_SKILLS_SH_REMOVE_ROUTE,
  WORKSPACE_SKILLS_SH_UPDATE_ROUTE,
];

// =============================================================================
// Route Collections
// =============================================================================

export const WORKSPACE_FS_ROUTES = [
  WORKSPACE_FS_READ_ROUTE,
  WORKSPACE_FS_WRITE_ROUTE,
  WORKSPACE_FS_LIST_ROUTE,
  WORKSPACE_FS_DELETE_ROUTE,
  WORKSPACE_FS_MKDIR_ROUTE,
  WORKSPACE_FS_STAT_ROUTE,
];

export const WORKSPACE_SEARCH_ROUTES = [WORKSPACE_SEARCH_ROUTE, WORKSPACE_INDEX_ROUTE];

// IMPORTANT: Search route must come before the parameterized routes
// to avoid /api/workspace/skills/search being matched as /api/workspace/skills/:skillName
export const WORKSPACE_SKILLS_ROUTES = [
  WORKSPACE_SEARCH_SKILLS_ROUTE,
  WORKSPACE_LIST_SKILLS_ROUTE,
  WORKSPACE_GET_SKILL_ROUTE,
  WORKSPACE_LIST_SKILL_REFERENCES_ROUTE,
  WORKSPACE_GET_SKILL_REFERENCE_ROUTE,
];
