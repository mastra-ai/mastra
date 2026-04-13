import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError } from '../errors';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { startWorkspaceSpan } from './tracing';

export const fileStatTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
  description:
    'Get file or directory metadata from the workspace. Returns existence, type, size, and modification time.',
  inputSchema: z.object({
    path: z.string().describe('The path to check'),
  }),
  execute: async ({ path }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'stat',
      input: { path },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      const stat = await filesystem.stat(path);
      const modifiedAt = stat.modifiedAt.toISOString();

      const parts = [`${path}`, `Type: ${stat.type}`];
      if (stat.size !== undefined) parts.push(`Size: ${stat.size} bytes`);
      parts.push(`Modified: ${modifiedAt}`);
      span.end({ success: true }, { bytesTransferred: stat.size });
      return parts.join(' ');
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        span.end({ success: false });
        return `${path}: not found`;
      }
      span.error(error);
      throw error;
    }
  },
});
