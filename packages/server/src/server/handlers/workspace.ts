/**
 * Workspace Handlers
 *
 * Unified handlers for workspace operations including:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index)
 * - Skills operations (list, get, search, references)
 */

import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { coreFeatures } from '@mastra/core/features';
import type { Workspace, WorkspaceSkills } from '@mastra/core/workspace';
import * as tar from 'tar';
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

      // Get full skill details to include path in response
      const skillsWithPath = await Promise.all(
        skillsList.map(async skillMeta => {
          const fullSkill = await skills.get(skillMeta.name);
          return {
            name: skillMeta.name,
            description: skillMeta.description,
            license: skillMeta.license,
            compatibility: skillMeta.compatibility,
            metadata: skillMeta.metadata,
            path: fullSkill?.path ?? '',
          };
        }),
      );

      return {
        skills: skillsWithPath,
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
// Tarball-based GitHub helpers for skills.sh routes
// =============================================================================

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
 * Download and extract a GitHub repo tarball to a temp directory.
 * Streams directly from fetch → gunzip → extract (no intermediate file).
 * Returns the path to the extracted directory containing the repo contents.
 */
async function downloadAndExtractTarball(owner: string, repo: string, branch: string): Promise<string> {
  const tarballUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.tar.gz`;
  const response = await fetch(tarballUrl, {
    headers: { 'User-Agent': 'Mastra-Skills-Installer' },
  });

  if (!response.ok) {
    throw new Error(`Failed to download tarball: ${response.status} ${response.statusText}`);
  }

  // Create temp directory
  const tempDir = mkdtempSync(join(tmpdir(), 'mastra-skill-'));

  // Stream directly: fetch → gunzip → tar extract
  await pipeline(Readable.fromWeb(response.body as any), createGunzip(), tar.extract({ cwd: tempDir }));

  // GitHub tarballs extract to {repo}-{branch}/ directory
  const extractedDir = join(tempDir, `${repo}-${branch}`);
  return extractedDir;
}

/**
 * Recursively read all files from a directory.
 */
function readDirectoryRecursive(dirPath: string, basePath: string = ''): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const relativePath = basePath ? `${basePath}/${entry}` : entry;
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...readDirectoryRecursive(fullPath, relativePath));
    } else if (stat.isFile()) {
      const content = readFileSync(fullPath, 'utf-8');
      files.push({ path: relativePath, content });
    }
  }

  return files;
}

/**
 * Find SKILL.md files in extracted tarball and match by frontmatter name.
 */
function findSkillInExtractedRepo(
  extractedDir: string,
  skillName: string,
): { skillDir: string; frontmatterName: string } | null {
  const nameVariations = getNameVariations(skillName);

  // Recursively find all SKILL.md files
  function findSkillMdFiles(dir: string, relativePath: string = ''): string[] {
    const results: string[] = [];
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relPath = relativePath ? `${relativePath}/${entry}` : entry;
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            results.push(...findSkillMdFiles(fullPath, relPath));
          } else if (entry === 'SKILL.md') {
            results.push(relPath);
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    return results;
  }

  const skillMdPaths = findSkillMdFiles(extractedDir);

  for (const skillMdPath of skillMdPaths) {
    const fullPath = join(extractedDir, skillMdPath);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const frontmatter = parseSkillFrontmatter(content);

      if (frontmatter.name && nameVariations.includes(frontmatter.name)) {
        // Return the directory containing SKILL.md
        const skillDir = skillMdPath.replace(/\/?SKILL\.md$/, '') || '.';
        return { skillDir, frontmatterName: frontmatter.name };
      }
    } catch {
      // Continue to next file
    }
  }

  return null;
}

/**
 * Download repo as tarball and extract skill files.
 * Returns skill files and metadata, cleaning up temp directory afterward.
 */
async function fetchSkillFromTarball(
  owner: string,
  repo: string,
  skillName: string,
): Promise<{ files: Array<{ path: string; content: string }>; installName: string; branch: string } | null> {
  const branches = ['main', 'master'];

  for (const branch of branches) {
    let extractedDir: string | null = null;
    try {
      extractedDir = await downloadAndExtractTarball(owner, repo, branch);

      const skillMatch = findSkillInExtractedRepo(extractedDir, skillName);
      if (!skillMatch) {
        continue; // Try next branch
      }

      // Read all files from the skill directory
      const skillFullPath = skillMatch.skillDir === '.' ? extractedDir : join(extractedDir, skillMatch.skillDir);
      const files = readDirectoryRecursive(skillFullPath);

      return {
        files,
        installName: skillMatch.frontmatterName,
        branch,
      };
    } catch {
      // Try next branch
    } finally {
      // Clean up temp directory
      if (extractedDir) {
        try {
          // Get parent temp dir (extractedDir is {tempDir}/{repo}-{branch})
          const tempDir = join(extractedDir, '..');
          rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  return null;
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
      // 1. Remove all class attributes (we apply our own styles)
      // 2. Remove inline styles
      // 3. Fix relative URLs
      content = content
        // Remove all class attributes
        .replace(/\s*class="[^"]*"/g, '')
        // Remove inline styles
        .replace(/\s*style="[^"]*"/g, '')
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

      if (!workspace.filesystem) {
        throw new HTTPException(400, { message: 'Workspace filesystem not available' });
      }

      // Check if workspace is read-only
      if (workspace.filesystem.readOnly) {
        throw new HTTPException(403, { message: 'Workspace is read-only' });
      }

      // Download tarball and extract skill files
      const result = await fetchSkillFromTarball(owner, repo, skillName);
      if (!result) {
        throw new HTTPException(404, {
          message: `Could not find skill "${skillName}" in ${owner}/${repo}. Tried main and master branches.`,
        });
      }

      const { files, installName, branch } = result;

      if (files.length === 0) {
        throw new HTTPException(404, { message: 'No files found in skill directory' });
      }

      const installPath = `.agents/skills/${installName}`;

      // Ensure the skills directory exists
      try {
        await workspace.filesystem.mkdir(installPath, { recursive: true });
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
            await workspace.filesystem.mkdir(dirPath, { recursive: true });
          } catch {
            // Directory might already exist
          }
        }

        await workspace.filesystem.writeFile(filePath, file.content);
        filesWritten++;
      }

      // Write metadata file for update support
      const metadata = {
        skillName: installName,
        owner,
        repo,
        branch,
        installedAt: new Date().toISOString(),
      };
      await workspace.filesystem.writeFile(`${installPath}/.meta.json`, JSON.stringify(metadata, null, 2));
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

      const skillPath = `.agents/skills/${skillName}`;

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
        skillsToUpdate = [skillName];
      } else {
        try {
          const entries = await workspace?.filesystem?.readdir(skillsPath);
          skillsToUpdate = entries?.filter(e => e.type === 'directory').map(e => e.name) ?? [];
        } catch {
          return { updated: [] };
        }
      }

      for (const skill of skillsToUpdate) {
        const metaPath = `${skillsPath}/${skill}/.meta.json`;
        try {
          const metaContent = await workspace?.filesystem?.readFile(metaPath, { encoding: 'utf-8' });
          const meta: SkillMetaFile = JSON.parse(metaContent as string);

          // Re-fetch skill files via tarball
          const fetchResult = await fetchSkillFromTarball(meta.owner, meta.repo, meta.skillName);

          if (!fetchResult || fetchResult.files.length === 0) {
            results.push({
              skillName: skill,
              success: false,
              error: 'No files found in skill directory',
            });
            continue;
          }

          const { files, branch } = fetchResult;
          const installPath = `${skillsPath}/${skill}`;
          let filesWritten = 0;

          for (const file of files) {
            const filePath = `${installPath}/${file.path}`;

            if (file.path.includes('/')) {
              const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
              try {
                await workspace.filesystem.mkdir(dirPath, { recursive: true });
              } catch {
                // Directory might already exist
              }
            }

            await workspace.filesystem.writeFile(filePath, file.content);
            filesWritten++;
          }

          // Update metadata with new install time and branch
          const updatedMeta: SkillMetaFile = {
            ...meta,
            branch,
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
