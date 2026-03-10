import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError } from '../errors';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';

export const fileStatTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
  description:
    'Get file or directory metadata from the workspace. Returns existence, type, size, and modification time.',
  inputSchema: z.object({
    path: z.string().describe('The path to check'),
  }),
  execute: async ({ path }, context) => {
    const { filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);

    try {
      const stat = await filesystem.stat(path);
      const modifiedAt = stat.modifiedAt.toISOString();

      const parts = [`${path}`, `Type: ${stat.type}`];
      if (stat.size !== undefined) parts.push(`Size: ${stat.size} bytes`);
      parts.push(`Modified: ${modifiedAt}`);
      return parts.join(' ');
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return `${path}: not found`;
      }
      throw error;
    }
  },
});
