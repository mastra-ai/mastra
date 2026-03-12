import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { emitWorkspaceMetadata, requireWorkspace } from './helpers';

export const indexContentTool = createTool({
  id: WORKSPACE_TOOLS.SEARCH.INDEX,
  description: 'Index content for search. The path becomes the document ID in search results.',
  inputSchema: z.object({
    path: z.string().describe('The document ID/path for search results'),
    content: z.string().describe('The text content to index'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata to store with the document'),
  }),
  execute: async ({ path, content, metadata }, context) => {
    const workspace = requireWorkspace(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SEARCH.INDEX);

    await workspace.index(path, content, { metadata });
    return `Indexed ${path}`;
  },
});
