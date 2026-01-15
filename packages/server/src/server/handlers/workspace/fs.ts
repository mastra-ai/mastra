/**
 * Workspace Filesystem Handlers
 *
 * Provides REST API for workspace filesystem operations.
 */

import type { Workspace } from '@mastra/core/workspace';
import { HTTPException } from '../../http-exception';
import {
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
// Filesystem Routes
// =============================================================================

export const WORKSPACE_FS_READ_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workspace/fs/read',
  responseType: 'json',
  queryParamSchema: fsReadQuerySchema,
  responseSchema: fsReadResponseSchema,
  summary: 'Read file content',
  description: 'Returns the content of a file at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, encoding }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
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
  path: '/api/workspace/fs/write',
  responseType: 'json',
  bodySchema: fsWriteBodySchema,
  responseSchema: fsWriteResponseSchema,
  summary: 'Write file content',
  description: 'Writes content to a file at the specified path. Supports base64 encoding for binary files.',
  tags: ['Workspace'],
  handler: async ({ mastra, path, content, encoding, recursive }) => {
    try {
      if (!path || content === undefined) {
        throw new HTTPException(400, { message: 'Path and content are required' });
      }

      const workspace = getWorkspace(mastra);
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
  path: '/api/workspace/fs/list',
  responseType: 'json',
  queryParamSchema: fsListQuerySchema,
  responseSchema: fsListResponseSchema,
  summary: 'List directory contents',
  description: 'Returns a list of files and directories at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
      if (!workspace?.fs) {
        throw new HTTPException(404, { message: 'No workspace filesystem configured' });
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
  path: '/api/workspace/fs/delete',
  responseType: 'json',
  queryParamSchema: fsDeleteQuerySchema,
  responseSchema: fsDeleteResponseSchema,
  summary: 'Delete file or directory',
  description: 'Deletes a file or directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive, force }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
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
  path: '/api/workspace/fs/mkdir',
  responseType: 'json',
  bodySchema: fsMkdirBodySchema,
  responseSchema: fsMkdirResponseSchema,
  summary: 'Create directory',
  description: 'Creates a directory at the specified path',
  tags: ['Workspace'],
  handler: async ({ mastra, path, recursive }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
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
  path: '/api/workspace/fs/stat',
  responseType: 'json',
  queryParamSchema: fsStatQuerySchema,
  responseSchema: fsStatResponseSchema,
  summary: 'Get file/directory info',
  description: 'Returns metadata about a file or directory',
  tags: ['Workspace'],
  handler: async ({ mastra, path }) => {
    try {
      if (!path) {
        throw new HTTPException(400, { message: 'Path is required' });
      }

      const workspace = getWorkspace(mastra);
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

// Export all FS routes
export const WORKSPACE_FS_ROUTES = [
  WORKSPACE_FS_READ_ROUTE,
  WORKSPACE_FS_WRITE_ROUTE,
  WORKSPACE_FS_LIST_ROUTE,
  WORKSPACE_FS_DELETE_ROUTE,
  WORKSPACE_FS_MKDIR_ROUTE,
  WORKSPACE_FS_STAT_ROUTE,
];
