import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { WorkspaceReadOnlyError } from '../errors';
import { charRangeToLineRange, replaceString, StringNotFoundError, StringNotUniqueError } from '../line-utils';
import { emitWorkspaceMetadata, getEditDiagnosticsText, requireFilesystem } from './helpers';
import { startWorkspaceSpan } from './tracing';

function getEditedLineRanges(content: string, oldString: string, newString: string, replaceAll: boolean): string {
  if (!oldString) return '';
  const ranges: string[] = [];
  let position = 0;

  while ((position = content.indexOf(oldString, position)) !== -1) {
    const range = charRangeToLineRange(content, position, position + Math.max(oldString.length, 1));
    if (range) {
      const newLineCount = newString.split('\n').length;
      const end = range.start + Math.max(newLineCount, range.end - range.start + 1) - 1;
      ranges.push(end === range.start ? String(range.start) : `${range.start}-${end}`);
    }
    position += oldString.length;
    if (!replaceAll) break;
  }

  if (ranges.length === 0) return '';
  return ranges.length === 1 ? ` (lines ${ranges[0]})` : ` (lines ${ranges.join(', ')})`;
}

export const editFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
  description: `Edit a file by replacing specific text. The old_string must match exactly and be unique in the file.

Usage:
- Read the file first to get the exact text to replace.
- By default, read file output includes line number prefixes (e.g., "     1→"). Ensure you preserve the exact indentation as it appears AFTER the arrow. Never include any part of the line number prefix in old_string or new_string.
- Include enough surrounding context (multiple lines) to make old_string unique. If it still isn't unique, include more lines.
- Use replace_all only when intentionally replacing all occurrences.`,
  outputSchema: z.string(),
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

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'editFile',
      input: { path, replace_all },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      if (filesystem.readOnly) {
        throw new WorkspaceReadOnlyError('edit_file');
      }

      const content = await filesystem.readFile(path, { encoding: 'utf-8' });

      if (typeof content !== 'string') {
        span.end({ success: false });
        return `Cannot edit binary files. Use the write file tool instead.`;
      }

      const shouldReplaceAll = replace_all ?? false;
      const lineRanges = getEditedLineRanges(content, old_string, new_string, shouldReplaceAll);
      const result = replaceString(content, old_string, new_string, shouldReplaceAll);
      await filesystem.writeFile(path, result.content, {
        overwrite: true,
        expectedMtime: (context as any)?.__expectedMtime,
      });

      let output = `Replaced ${result.replacements} occurrence${result.replacements !== 1 ? 's' : ''} in ${path}${lineRanges}`;
      output += await getEditDiagnosticsText(workspace, path, result.content);
      span.end({ success: true }, { bytesTransferred: Buffer.byteLength(result.content, 'utf-8') });
      return output;
    } catch (error) {
      if (error instanceof StringNotFoundError) {
        span.end({ success: false });
        return error.message;
      }
      if (error instanceof StringNotUniqueError) {
        span.end({ success: false });
        return error.message;
      }
      span.error(error);
      throw error;
    }
  },
});
