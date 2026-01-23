/**
 * Workspace Handlers
 *
 * Unified handlers for workspace operations including:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index, unindex)
 * - Skills operations (list, get, search, references)
 */

import type { Workspace, WorkspaceSkills } from '@mastra/core/workspace';
import { HTTPException } from '../http-exception';
import {
  // Workspace info
  workspaceInfoResponseSchema,
  listWorkspacesResponseSchema,
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
  unindexQuerySchema,
  unindexResponseSchema,
  // Skills schemas
  skillNamePathParams,
  skillReferencePathParams,
  listSkillsQuerySchema,
  getSkillQuerySchema,
  searchSkillsQuerySchema,
  listSkillsResponseSchema,
  getSkillResponseSchema,
  skillReferenceResponseSchema,
  listReferencesResponseSchema,
  searchSkillsResponseSchema,
} from '../schemas/workspace';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a workspace by ID from Mastra or agents.
 * If no workspaceId is provided, returns the global workspace.
 */
async function getWorkspaceById(mastra: any, workspaceId?: string): Promise<Workspace | undefined> {
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
 * Get the workspace from Mastra (legacy helper for backwards compatibility).
 */
function getWorkspace(mastra: any): Workspace | undefined {
  return mastra.getWorkspace?.();
}

/**
 * Get skills from a specific workspace by ID.
 * If no workspaceId is provided, returns skills from the global workspace.
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
        });
      }

      // Get workspaces from agents
      const agents = mastra.listAgents?.() ?? {};
      for (const [agentId, agent] of Object.entries(agents)) {
        if (agent.hasOwnWorkspace?.()) {
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
            });
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
// Workspace Info Route
// =============================================================================

export const WORKSPACE_INFO_ROUTE = createRoute({
  method: 'GET',
  path: '/workspace',
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

// =============================================================================
// Filesystem Routes
// =============================================================================

export const WORKSPACE_FS_READ_ROUTE = createRoute({
  method: 'GET',
  path: '/workspace/fs/read',
  responseType: 'json',
  queryParamSchema: fsReadQuerySchema,
  responseSchema: fsReadResponseSchema,
  summary: 'Read file content',
  description: 'Returns the content of a file at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, encoding, workspaceId }) => {
    try {
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
  path: '/workspace/fs/write',
  responseType: 'json',
  bodySchema: fsWriteBodySchema,
  responseSchema: fsWriteResponseSchema,
  summary: 'Write file content',
  description: 'Writes content to a file at the specified path. Supports base64 encoding for binary files.',
  tags: ['Workspace'],
  handler: async ({ mastra, path, content, encoding, recursive, workspaceId }) => {
    try {
      if (!path || content === undefined) {
        throw new HTTPException(400, { message: 'Path and content are required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
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
  path: '/workspace/fs/list',
  responseType: 'json',
  queryParamSchema: fsListQuerySchema,
  responseSchema: fsListResponseSchema,
  summary: 'List directory contents',
  description: 'Returns a list of files and directories at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, workspaceId }) => {
    try {
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
  path: '/workspace/fs/delete',
  responseType: 'json',
  queryParamSchema: fsDeleteQuerySchema,
  responseSchema: fsDeleteResponseSchema,
  summary: 'Delete file or directory',
  description: 'Deletes a file or directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, force, workspaceId }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
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
  path: '/workspace/fs/mkdir',
  responseType: 'json',
  bodySchema: fsMkdirBodySchema,
  responseSchema: fsMkdirResponseSchema,
  summary: 'Create directory',
  description: 'Creates a directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, workspaceId }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = await getWorkspaceById(mastra, workspaceId);
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
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
  path: '/workspace/fs/stat',
  responseType: 'json',
  queryParamSchema: fsStatQuerySchema,
  responseSchema: fsStatResponseSchema,
  summary: 'Get file/directory info',
  description: 'Returns metadata about a file or directory',
  tags: ['Workspace'],
  handler: async ({ mastra, path, workspaceId }) => {
    try {
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
  path: '/workspace/search',
  responseType: 'json',
  queryParamSchema: searchQuerySchema,
  responseSchema: searchResponseSchema,
  summary: 'Search workspace content',
  description: 'Searches across indexed workspace content using BM25, vector, or hybrid search',
  tags: ['Workspace'],
  handler: async ({ mastra, query, topK, mode, minScore, workspaceId }) => {
    try {
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
  path: '/workspace/index',
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
  path: '/workspace/unindex',
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

// =============================================================================
// Skills Routes (under /workspace/skills)
// =============================================================================

export const WORKSPACE_LIST_SKILLS_ROUTE = createRoute({
  method: 'GET',
  path: '/workspace/skills',
  responseType: 'json',
  queryParamSchema: listSkillsQuerySchema,
  responseSchema: listSkillsResponseSchema,
  summary: 'List all skills',
  description: 'Returns a list of all discovered skills with their metadata',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, workspaceId }) => {
    try {
      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        return { skills: [], isSkillsConfigured: false };
      }

      const skillsList = await skills.list();

      return {
        skills: skillsList.map(skill => ({
          name: skill.name,
          description: skill.description,
          license: skill.license,
          compatibility: skill.compatibility,
          metadata: skill.metadata,
          allowedTools: skill.allowedTools,
        })),
        isSkillsConfigured: true,
      };
    } catch (error) {
      return handleError(error, 'Error listing skills');
    }
  },
});

export const WORKSPACE_GET_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/workspace/skills/:skillName',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  queryParamSchema: getSkillQuerySchema,
  responseSchema: getSkillResponseSchema,
  summary: 'Get skill details',
  description: 'Returns the full details of a specific skill including instructions and file lists',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, workspaceId }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

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
        allowedTools: skill.allowedTools,
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
  path: '/workspace/skills/:skillName/references',
  responseType: 'json',
  pathParamSchema: skillNamePathParams,
  queryParamSchema: getSkillQuerySchema,
  responseSchema: listReferencesResponseSchema,
  summary: 'List skill references',
  description: 'Returns a list of all reference file paths for a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, workspaceId }) => {
    try {
      if (!skillName) {
        throw new HTTPException(400, { message: 'Skill name is required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

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
  path: '/workspace/skills/:skillName/references/:referencePath',
  responseType: 'json',
  pathParamSchema: skillReferencePathParams,
  queryParamSchema: getSkillQuerySchema,
  responseSchema: skillReferenceResponseSchema,
  summary: 'Get skill reference content',
  description: 'Returns the content of a specific reference file from a skill',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, skillName, referencePath, workspaceId }) => {
    try {
      if (!skillName || !referencePath) {
        throw new HTTPException(400, { message: 'Skill name and reference path are required' });
      }

      const skills = await getSkillsById(mastra, workspaceId);
      if (!skills) {
        throw new HTTPException(404, { message: 'No workspace with skills configured' });
      }

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
  path: '/workspace/skills/search',
  responseType: 'json',
  queryParamSchema: searchSkillsQuerySchema,
  responseSchema: searchSkillsResponseSchema,
  summary: 'Search skills',
  description: 'Searches across all skills content using BM25 keyword search',
  tags: ['Workspace', 'Skills'],
  handler: async ({ mastra, query, topK, minScore, skillNames, includeReferences, workspaceId }) => {
    try {
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

export const WORKSPACE_SEARCH_ROUTES = [WORKSPACE_SEARCH_ROUTE, WORKSPACE_INDEX_ROUTE, WORKSPACE_UNINDEX_ROUTE];

// IMPORTANT: Search route must come before the parameterized routes
// to avoid /api/workspace/skills/search being matched as /api/workspace/skills/:skillName
export const WORKSPACE_SKILLS_ROUTES = [
  WORKSPACE_SEARCH_SKILLS_ROUTE,
  WORKSPACE_LIST_SKILLS_ROUTE,
  WORKSPACE_GET_SKILL_ROUTE,
  WORKSPACE_LIST_SKILL_REFERENCES_ROUTE,
  WORKSPACE_GET_SKILL_REFERENCE_ROUTE,
];
