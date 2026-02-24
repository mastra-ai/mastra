import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { replaceString, StringNotFoundError, StringNotUniqueError } from '../line-utils';
import { emitWorkspaceMetadata, getEditDiagnosticsText, requireFilesystem } from './helpers';

export const editFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
  description: `Edit a file by replacing specific text. The old_string must match exactly and be unique in the file.

Usage:
- Read the file first to get the exact text to replace.
- By default, ${WORKSPACE_TOOLS.FILESYSTEM.READ_FILE} output includes line number prefixes (e.g., "     1→"). Ensure you preserve the exact indentation as it appears AFTER the arrow. Never include any part of the line number prefix in old_string or new_string.
- Include enough surrounding context (multiple lines) to make old_string unique. If it still isn't unique, include more lines.
- Use replace_all only when intentionally replacing all occurrences.`,
  inputSchema: z.object({
    path: z.string().describe('The path to the file to edit'),
    old_string: z.string().describe('The exact text to find and replace. Must be unique in the file.'),
    new_string: z.string().describe('The text to replace old_string with'),
    replace_all: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, replace all occurrences. If false (default), old_string must be unique.'),
  }),
  execute: async ({ path, old_string, new_string, replace_all }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('edit_file');
    }

    try {
      const content = await filesystem.readFile(path, { encoding: 'utf-8' });

      if (typeof content !== 'string') {
        return `Cannot edit binary files. Use ${WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE} instead.`;
      }

      const result = replaceString(content, old_string, new_string, replace_all);
      await filesystem.writeFile(path, result.content, { overwrite: true });

      let output = `Replaced ${result.replacements} occurrence${result.replacements !== 1 ? 's' : ''} in ${path}`;
      output += await getEditDiagnosticsText(workspace, path, result.content);
      return output;
    } catch (error) {
      if (error instanceof StringNotFoundError) {
        return error.message;
      }
      if (error instanceof StringNotUniqueError) {
        return error.message;
      }
      throw error;
    }
  },
});
