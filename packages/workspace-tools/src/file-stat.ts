import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { FileNotFoundError } from '@mastra/core/workspace';
import { requireFilesystem } from './helpers';

export const fileStatTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
  description:
    'Get file or directory metadata from the workspace. Returns existence, type, size, and modification time.',
  inputSchema: z.object({
    path: z.string().describe('The path to check'),
  }),
  outputSchema: z.object({
    exists: z.boolean().describe('Whether the path exists'),
    type: z.enum(['file', 'directory', 'none']).describe('The type of the path if it exists'),
    size: z.number().optional().describe('Size in bytes (for files)'),
    modifiedAt: z.string().optional().describe('Last modification time (ISO string)'),
  }),
  execute: async ({ path }, context) => {
    const { filesystem } = requireFilesystem(context);

    try {
      const stat = await filesystem.stat(path);
      return {
        exists: true,
        type: stat.type,
        size: stat.size,
        modifiedAt: stat.modifiedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return { exists: false, type: 'none' as const };
      }
      throw error;
    }
  },
});
