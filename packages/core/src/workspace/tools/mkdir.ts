import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { requireFilesystem } from './helpers';

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
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string(),
  }),
  execute: async ({ path, recursive }, context) => {
    const { filesystem } = requireFilesystem(context);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('mkdir');
    }

    await filesystem.mkdir(path, { recursive });
    return { success: true, path };
  },
});
