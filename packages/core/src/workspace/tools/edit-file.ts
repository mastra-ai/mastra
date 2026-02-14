import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { replaceString, StringNotFoundError, StringNotUniqueError } from '../line-utils';
import { requireFilesystem } from './helpers';

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
  outputSchema: z.object({
    success: z.boolean(),
    path: z.string().describe('The path to the edited file'),
    replacements: z.number().describe('Number of replacements made'),
    error: z.string().optional().describe('Error message if the edit failed'),
  }),
  execute: async ({ path, old_string, new_string, replace_all }, context) => {
    const { filesystem } = requireFilesystem(context);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('edit_file');
    }

    try {
      const content = await filesystem.readFile(path, { encoding: 'utf-8' });

      if (typeof content !== 'string') {
        return {
          success: false,
          path,
          replacements: 0,
          error: 'Cannot edit binary files. Use workspace_write_file instead.',
        };
      }

      const result = replaceString(content, old_string, new_string, replace_all);
      await filesystem.writeFile(path, result.content, { overwrite: true });

      return {
        success: true,
        path,
        replacements: result.replacements,
      };
    } catch (error) {
      if (error instanceof StringNotFoundError) {
        return {
          success: false,
          path,
          replacements: 0,
          error: error.message,
        };
      }
      if (error instanceof StringNotUniqueError) {
        return {
          success: false,
          path,
          replacements: 0,
          error: error.message,
        };
      }
      throw error;
    }
  },
});
