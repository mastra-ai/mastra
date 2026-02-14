import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { requireFilesystem } from './helpers';

export const deleteFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.DELETE,
  description: 'Delete a file or directory from the workspace filesystem',
  inputSchema: z.object({
    path: z.string().describe('The path to the file or directory to delete'),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, delete directories and their contents recursively. Required for non-empty directories.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  execute: async ({ path, recursive }, context) => {
    const { filesystem } = requireFilesystem(context);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('delete');
    }

    const stat = await filesystem.stat(path);
    if (stat.type === 'directory') {
      await filesystem.rmdir(path, { recursive, force: recursive });
    } else {
      await filesystem.deleteFile(path);
    }
    return { success: true, path };
  },
});
