import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError } from '../errors';
import { requireFilesystem } from './helpers';

export const fileStatTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
  description:
    'Get file or directory metadata from the workspace. Returns existence, type, size, and modification time.',
  inputSchema: z.object({
    path: z.string().describe('The path to check'),
  }),
  execute: async ({ path }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);

    try {
      const stat = await filesystem.stat(path);
      const modifiedAt = stat.modifiedAt.toISOString();

      await context?.writer?.custom({
        type: 'data-workspace-metadata',
        data: {
          toolName: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
          path,
          exists: true,
          type: stat.type,
          size: stat.size,
          modifiedAt,
          workspace: { id: workspace.id, name: workspace.name },
          filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
        },
      });

      const parts = [`${path}`, `Type: ${stat.type}`];
      if (stat.size !== undefined) parts.push(`Size: ${stat.size} bytes`);
      parts.push(`Modified: ${modifiedAt}`);
      return parts.join(' ');
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        await context?.writer?.custom({
          type: 'data-workspace-metadata',
          data: {
            toolName: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
            path,
            exists: false,
            workspace: { id: workspace.id, name: workspace.name },
            filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
          },
        });

        return `${path}: not found`;
      }
      throw error;
    }
  },
});
