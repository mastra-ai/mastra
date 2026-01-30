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
  // Sandbox schemas
  sandboxExecuteBodySchema,
  sandboxExecuteResponseSchema,
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
            hasFilesystem: !!globalWorkspace.fs,
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
                  hasFilesystem: !!agentWorkspace.fs,
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
      return handleError(error, 'Error listing workspaces');
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
          hasFilesystem: !!workspace.fs,
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
      return handleError(error, 'Error getting workspace info');
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
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.fs.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      // Read file content
      const content = await workspace.fs.readFile(decodedPath, {
        encoding: (encoding as BufferEncoding) || 'utf-8',
      });

      return {
        path: decodedPath,
        content: typeof content === 'string' ? content : content.toString('utf-8'),
        type: 'file' as const,
      };
    } catch (error) {
      return handleError(error, 'Error reading file');
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
      if (!workspace?.fs) {
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

      await workspace.fs.writeFile(decodedPath, fileContent, { recursive: recursive ?? true });

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleError(error, 'Error writing file');
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
      if (!workspace?.fs) {
        return {
          path: decodeURIComponent(path),
          entries: [],
          error: 'No workspace filesystem configured',
        };
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.fs.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      const entries = await workspace.fs.readdir(decodedPath, { recursive });

      return {
        path: decodedPath,
        entries: entries.map(entry => ({
          name: entry.name,
          type: entry.type,
          size: entry.size,
        })),
      };
    } catch (error) {
      return handleError(error, 'Error listing directory');
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
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      if (workspace.filesystem?.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is in read-only mode' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists (unless force is true)
      const exists = await workspace.fs.exists(decodedPath);
      if (!exists && !force) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      if (exists) {
        // Try to delete as file first, then as directory
        try {
          await workspace.fs.deleteFile(decodedPath, { force });
        } catch {
          await workspace.fs.rmdir(decodedPath, { recursive, force });
        }
      }

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleError(error, 'Error deleting path');
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
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      if (workspace.filesystem?.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is in read-only mode' });
      }

      const decodedPath = decodeURIComponent(path);

      await workspace.fs.mkdir(decodedPath, { recursive: recursive ?? true });

      return {
        success: true,
        path: decodedPath,
      };
    } catch (error) {
      return handleError(error, 'Error creating directory');
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
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
      }

      const decodedPath = decodeURIComponent(path);

      // Check if path exists
      if (!(await workspace.fs.exists(decodedPath))) {
        throw new HTTPException(404, { message: `Path "${decodedPath}" not found` });
      }

      const stat = await workspace.fs.stat(decodedPath);

      return {
        path: stat.path,
        type: stat.type,
        size: stat.size,
        createdAt: stat.createdAt?.toISOString(),
        modifiedAt: stat.modifiedAt?.toISOString(),
        mimeType: stat.mimeType,
      };
    } catch (error) {
      return handleError(error, 'Error getting file info');
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
      return handleError(error, 'Error searching workspace');
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
      return handleError(error, 'Error indexing content');
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

      // Determine which skills are from .agents/skills/ (downloaded from skills.sh)
      // We need to get full skill details to check the path
      const skillsWithGitHubInfo = await Promise.all(
        skillsList.map(async skillMeta => {
          // Get full skill to access path
          const fullSkill = await skills.get(skillMeta.name);
          // Skills installed via skills.sh live in .agents/skills/
          const isDownloaded = fullSkill?.path?.includes('.agents/skills/') ?? false;

          return {
            name: skillMeta.name,
            description: skillMeta.description,
            license: skillMeta.license,
            compatibility: skillMeta.compatibility,
            metadata: skillMeta.metadata,
            isDownloaded,
          };
        }),
      );

      return {
        skills: skillsWithGitHubInfo,
        isSkillsConfigured: true,
      };
    } catch (error) {
      return handleError(error, 'Error listing skills');
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
      return handleError(error, 'Error getting skill');
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
      return handleError(error, 'Error listing skill references');
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
      return handleError(error, 'Error getting skill reference');
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
      return handleError(error, 'Error searching skills');
    }
  },
});

// =============================================================================
// Sandbox Routes
// =============================================================================

export const WORKSPACE_SANDBOX_EXECUTE_ROUTE = createRoute({
  method: 'POST',
  path: '/workspaces/:workspaceId/sandbox/execute',
  responseType: 'json',
  pathParamSchema: workspaceIdPathParams,
  bodySchema: sandboxExecuteBodySchema,
  responseSchema: sandboxExecuteResponseSchema,
  summary: 'Execute command in sandbox',
  description: 'Executes a command in the workspace sandbox environment',
  tags: ['Workspace', 'Sandbox'],
  handler: async ({ mastra, workspaceId, command, args, cwd, timeout }) => {
    try {
      requireWorkspaceV1Support();

      if (!command) {
        throw new HTTPException(400, { message: 'Command is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace) {
        throw new HTTPException(404, { message: 'Workspace not found' });
      }

      if (!workspace.sandbox?.executeCommand) {
        throw new HTTPException(400, { message: 'Workspace sandbox not available' });
      }

      const startTime = Date.now();
      const result = await workspace.sandbox.executeCommand(command, args ?? [], { cwd, timeout });
      const executionTimeMs = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTimeMs,
      };
    } catch (error) {
      return handleError(error, 'Error executing sandbox command');
    }
  },
});

// =============================================================================
// skills.sh Proxy Routes
// =============================================================================

const SKILLS_SH_API_URL = 'https://skills.sh/api';

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
      const url = `${SKILLS_SH_API_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new HTTPException(502, {
          message: `skills.sh API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as {
        query: string;
        searchType: string;
        skills: Array<{ id: string; name: string; installs: number; topSource: string }>;
        count: number;
      };
      return data;
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error searching skills.sh');
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
      const url = `${SKILLS_SH_API_URL}/skills?limit=${limit}&offset=${offset}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new HTTPException(502, {
          message: `skills.sh API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as {
        skills: Array<{ id: string; name: string; installs: number; topSource: string }>;
        count: number;
        limit: number;
        offset: number;
      };
      return data;
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error fetching popular skills from skills.sh');
    }
  },
});

// =============================================================================
// GitHub API Helpers for skills.sh routes
// =============================================================================

interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/**
 * Parse YAML frontmatter from a SKILL.md file to extract the name field.
 */
function parseSkillFrontmatter(content: string): { name?: string } {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = frontmatterMatch?.[1];
  if (!frontmatter) {
    return {};
  }

  const result: { name?: string } = {};

  // Simple YAML parsing for the name field
  const nameMatch = frontmatter.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (nameMatch?.[1]) {
    result.name = nameMatch[1].trim();
  }

  return result;
}

/**
 * Generate possible name variations for matching.
 * skills.sh names often have vendor prefixes that the actual SKILL.md might not have.
 */
function getNameVariations(skillName: string): string[] {
  const variations = [skillName];

  // Common vendor prefixes used by skills.sh
  const vendorPrefixes = ['vercel-', 'anthropic-', 'anthropics-'];

  // If skillName has a vendor prefix, also try without it
  for (const prefix of vendorPrefixes) {
    if (skillName.startsWith(prefix)) {
      variations.push(skillName.slice(prefix.length));
    }
  }

  // Also try adding vendor prefixes (in case skills.sh name doesn't have it but frontmatter does)
  for (const prefix of vendorPrefixes) {
    if (!skillName.startsWith(prefix)) {
      variations.push(`${prefix}${skillName}`);
    }
  }

  return variations;
}

/**
 * Find the actual skill path in a GitHub repo by searching for SKILL.md files
 * and matching on the `name` field in frontmatter.
 *
 * Uses GitHub's Tree API to find all SKILL.md files, then fetches each one's
 * frontmatter to find the matching skill name.
 */
async function findSkillPath(
  owner: string,
  repo: string,
  skillName: string,
): Promise<{ path: string; branch: string } | null> {
  const branches = ['main', 'master'];
  const nameVariations = getNameVariations(skillName);

  for (const branch of branches) {
    try {
      // Get the entire repo tree to find all SKILL.md files
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const treeResponse = await fetch(treeUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Mastra-Skills-Installer',
        },
      });

      if (!treeResponse.ok) {
        continue; // Try next branch
      }

      const tree = (await treeResponse.json()) as GitHubTreeResponse;

      // Find all SKILL.md files (both in subdirectories and at root level)
      const skillFiles = tree.tree.filter(
        item => item.type === 'blob' && (item.path.endsWith('/SKILL.md') || item.path === 'SKILL.md'),
      );

      // Check each SKILL.md's frontmatter for matching name
      for (const skillFile of skillFiles) {
        const contentUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillFile.path}`;
        try {
          const contentResponse = await fetch(contentUrl);
          if (!contentResponse.ok) continue;

          const content = await contentResponse.text();
          const frontmatter = parseSkillFrontmatter(content);

          // Match on the name field in frontmatter (try multiple variations)
          if (frontmatter.name && nameVariations.includes(frontmatter.name)) {
            // Return the directory path (remove /SKILL.md from the end, or empty for root)
            const dirPath = skillFile.path.replace(/\/?SKILL\.md$/, '') || '.';
            return { path: dirPath, branch };
          }
        } catch {
          // Continue to next file
        }
      }
    } catch {
      // Continue to next branch
    }
  }

  return null;
}

/**
 * Recursively fetch all files from a GitHub directory using the Contents API.
 */
async function fetchGitHubDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<Array<{ path: string; content: string }>> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Mastra-Skills-Installer',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const items = (await response.json()) as GitHubContentItem[];
  const files: Array<{ path: string; content: string }> = [];

  for (const item of items) {
    if (item.type === 'file' && item.download_url) {
      // Fetch file content
      const fileResponse = await fetch(item.download_url);
      if (fileResponse.ok) {
        const content = await fileResponse.text();
        // Get relative path from the skill folder - use item.name for the filename
        files.push({ path: item.name, content });
      }
    } else if (item.type === 'dir') {
      // Recursively fetch subdirectory
      const subFiles = await fetchGitHubDirectoryContents(owner, repo, item.path, branch);
      // Preserve subdirectory structure
      const dirName = item.name;
      for (const subFile of subFiles) {
        files.push({ path: `${dirName}/${subFile.path}`, content: subFile.content });
      }
    }
  }

  return files;
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
  summary: 'Preview skill from skills.sh',
  description: 'Fetches the skill page from skills.sh and extracts the main content HTML.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ owner, repo, path: skillName }) => {
    try {
      // Fetch the skills.sh page directly
      const skillsShUrl = `https://skills.sh/${owner}/${repo}/${skillName}`;
      const response = await fetch(skillsShUrl, {
        headers: {
          'User-Agent': 'Mastra-Skills-Preview',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" on skills.sh`,
        });
      }

      const html = await response.text();

      // Extract the main content - look for the article or main content div
      // skills.sh uses a prose class for the markdown content
      let content = '';

      // Try to find the main content area - typically in an article or div with prose class
      const proseMatch = html.match(/<article[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
      if (proseMatch) {
        content = proseMatch[0];
      } else {
        // Fallback: look for any element with prose class
        const anyProseMatch = html.match(
          /<(?:div|section|article)[^>]*class="[^"]*prose[^"]*"[^>]*>[\s\S]*?<\/(?:div|section|article)>/i,
        );
        if (anyProseMatch) {
          content = anyProseMatch[0];
        } else {
          // Last fallback: look for main content area
          const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
          if (mainMatch?.[1]) {
            content = mainMatch[1];
          }
        }
      }

      if (!content) {
        throw new HTTPException(404, {
          message: `Could not extract content from skills.sh page`,
        });
      }

      // Clean up the HTML:
      // 1. Remove their custom classes except 'prose' related ones
      // 2. Remove inline styles
      // 3. Fix relative URLs
      content = content
        // Remove class attributes except prose
        .replace(/class="([^"]*)"/g, (match, classes) => {
          const proseClasses = classes
            .split(' ')
            .filter((c: string) => c.includes('prose'))
            .join(' ');
          return proseClasses ? `class="${proseClasses}"` : '';
        })
        // Remove empty class attributes
        .replace(/class=""\s*/g, '')
        // Remove inline styles
        .replace(/style="[^"]*"/g, '')
        // Fix relative URLs to point to skills.sh
        .replace(/href="\//g, 'href="https://skills.sh/')
        .replace(/src="\//g, 'src="https://skills.sh/');

      return { content };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error fetching skill preview from skills.sh');
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
  summary: 'Install skill from GitHub',
  description:
    'Installs a skill by fetching files from GitHub and writing to workspace filesystem. Does not require sandbox.',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId, owner, repo, skillName }) => {
    try {
      requireWorkspaceV1Support();

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace) {
        throw new HTTPException(404, { message: 'Workspace not found' });
      }

      if (!workspace.fs) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      // Check if workspace is read-only
      if (workspace.fs.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      // Find the actual skill path in the repo
      const skillLocation = await findSkillPath(owner, repo, skillName);
      if (!skillLocation) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" in ${owner}/${repo}. Tried multiple path patterns.`,
        });
      }

      // Fetch all files from the skill directory
      const files = await fetchGitHubDirectoryContents(owner, repo, skillLocation.path, skillLocation.branch);

      if (files.length === 0) {
        throw new HTTPException(404, { message: 'No files found in skill directory' });
      }

      // Get the skill name from SKILL.md frontmatter for the install directory name
      const skillMdFile = files.find(f => f.path === 'SKILL.md');
      let installName = skillName; // fallback to the skills.sh name
      if (skillMdFile) {
        const frontmatter = parseSkillFrontmatter(skillMdFile.content);
        if (frontmatter.name) {
          installName = frontmatter.name;
        }
      }

      const installPath = `.agents/skills/${installName}`;

      // Ensure the skills directory exists
      try {
        await workspace.fs.mkdir(installPath, { recursive: true });
      } catch {
        // Directory might already exist
      }

      // Write all files to the workspace
      let filesWritten = 0;
      for (const file of files) {
        const filePath = `${installPath}/${file.path}`;

        // Create subdirectory if needed
        if (file.path.includes('/')) {
          const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
          try {
            await workspace.fs.mkdir(dirPath, { recursive: true });
          } catch {
            // Directory might already exist
          }
        }

        await workspace.fs.writeFile(filePath, file.content);
        filesWritten++;
      }

      // Write metadata file for check/update support
      const metadata = {
        skillName: installName,
        owner,
        repo,
        branch: skillLocation.branch,
        path: skillLocation.path,
        installedAt: new Date().toISOString(),
      };
      await workspace.fs.writeFile(`${installPath}/.meta.json`, JSON.stringify(metadata, null, 2));
      filesWritten++;

      return {
        success: true,
        skillName: installName,
        installedPath: installPath,
        filesWritten,
      };
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      return handleError(error, 'Error installing skill from GitHub');
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
  path: string;
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

      if (!workspace.fs) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      if (workspace.fs.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      const skillPath = `.agents/skills/${skillName}`;

      // Check if skill exists
      try {
        await workspace.fs.stat(skillPath);
      } catch {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found at ${skillPath}` });
      }

      // Delete the skill directory
      await workspace.fs.rmdir(skillPath, { recursive: true });

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

      if (!workspace.fs) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      if (workspace.fs.readOnly) {
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
        skillsToUpdate = [skillName];
      } else {
        try {
          const entries = await workspace.fs.readdir(skillsPath);
          skillsToUpdate = entries.filter(e => e.type === 'directory').map(e => e.name);
        } catch {
          return { updated: [] };
        }
      }

      for (const skill of skillsToUpdate) {
        const metaPath = `${skillsPath}/${skill}/.meta.json`;
        try {
          const metaContent = await workspace.fs.readFile(metaPath, { encoding: 'utf-8' });
          const meta: SkillMetaFile = JSON.parse(metaContent as string);

          // Re-fetch all files from GitHub
          const files = await fetchGitHubDirectoryContents(meta.owner, meta.repo, meta.path, meta.branch);

          if (files.length === 0) {
            results.push({
              skillName: skill,
              success: false,
              error: 'No files found in skill directory',
            });
            continue;
          }

          const installPath = `${skillsPath}/${skill}`;
          let filesWritten = 0;

          for (const file of files) {
            const filePath = `${installPath}/${file.path}`;

            if (file.path.includes('/')) {
              const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
              try {
                await workspace.fs.mkdir(dirPath, { recursive: true });
              } catch {
                // Directory might already exist
              }
            }

            await workspace.fs.writeFile(filePath, file.content);
            filesWritten++;
          }

          // Update metadata with new install time
          const updatedMeta = {
            ...meta,
            installedAt: new Date().toISOString(),
          };
          await workspace.fs.writeFile(metaPath, JSON.stringify(updatedMeta, null, 2));
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

export const WORKSPACE_SANDBOX_ROUTES = [WORKSPACE_SANDBOX_EXECUTE_ROUTE];
