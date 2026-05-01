import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { startWorkspaceSpan } from './tracing';

export const mkdirTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.MKDIR,
  description: 'Create a directory in the workspace filesystem',
  inputSchema: z.object({
    path: z.string().describe('The path of the directory to create'),
    recursive: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to create parent directories if they do not exist'),
  }),
  execute: async ({ path, recursive }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.MKDIR);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'mkdir',
      input: { path, recursive },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      if (filesystem.readOnly) {
        throw new WorkspaceReadOnlyError('mkdir');
      }

      await filesystem.mkdir(path, { recursive });
      span.end({ success: true });
      return `Created directory ${path}`;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
