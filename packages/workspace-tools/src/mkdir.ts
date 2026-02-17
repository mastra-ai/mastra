import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { WorkspaceReadOnlyError } from '@mastra/core/workspace';
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
  execute: async ({ path, recursive }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('mkdir');
    }

    await filesystem.mkdir(path, { recursive });

    await context?.writer?.custom({
      type: 'data-workspace-metadata',
      data: {
        toolName: WORKSPACE_TOOLS.FILESYSTEM.MKDIR,
        path,
        workspace: { id: workspace.id, name: workspace.name },
        filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
      },
    });

    return `Created directory ${path}`;
  },
});
