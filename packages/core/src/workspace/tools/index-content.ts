import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { requireWorkspace } from './helpers';

export const indexContentTool = createTool({
  id: WORKSPACE_TOOLS.SEARCH.INDEX,
  description: 'Index content for search. The path becomes the document ID in search results.',
  inputSchema: z.object({
    path: z.string().describe('The document ID/path for search results'),
    content: z.string().describe('The text content to index'),
    metadata: z.record(z.unknown()).optional().describe('Optional metadata to store with the document'),
  }),
  execute: async ({ path, content, metadata }, context) => {
    const workspace = requireWorkspace(context);

    await workspace.index(path, content, { metadata });

    await context?.writer?.custom({
      type: 'data-workspace-metadata',
      data: {
        toolName: WORKSPACE_TOOLS.SEARCH.INDEX,
        path,
        workspace: { id: workspace.id, name: workspace.name },
      },
    });

    return `Indexed ${path}`;
  },
});
