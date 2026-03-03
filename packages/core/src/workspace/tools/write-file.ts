import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { emitWorkspaceMetadata, getEditDiagnosticsText, requireFilesystem } from './helpers';

export const writeFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
  description: 'Write content to a file in the workspace filesystem. Creates parent directories if needed.',
  inputSchema: z.object({
    path: z.string().describe('The path where to write the file (e.g., "/data/output.txt")'),
    content: z.string().describe('The content to write to the file'),
    overwrite: z.boolean().optional().default(true).describe('Whether to overwrite the file if it already exists'),
  }),
  execute: async ({ path, content, overwrite }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('write_file');
    }

    await filesystem.writeFile(path, content, { overwrite });

    const size = Buffer.byteLength(content, 'utf-8');
    let output = `Wrote ${size} bytes to ${path}`;
    output += await getEditDiagnosticsText(workspace, path, content);
    return output;
  },
});
