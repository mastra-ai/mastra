import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { extractLinesWithLimit, formatWithLineNumbers } from '../line-utils';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';

export const readFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
  description:
    'Read the contents of a file from the workspace filesystem. Use offset/limit parameters to read specific line ranges for large files.',
  inputSchema: z.object({
    path: z.string().describe('The path to the file to read (e.g., "/data/config.json")'),
    encoding: z
      .enum(['utf-8', 'utf8', 'base64', 'hex', 'binary'])
      .optional()
      .describe('The encoding to use when reading the file. Defaults to utf-8 for text files.'),
    offset: z
      .number()
      .optional()
      .describe('Line number to start reading from (1-indexed). If omitted, starts from line 1.'),
    limit: z.number().optional().describe('Maximum number of lines to read. If omitted, reads to the end of the file.'),
    showLineNumbers: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to prefix each line with its line number (default: true)'),
  }),
  execute: async ({ path, encoding, offset, limit, showLineNumbers }, context) => {
    const { filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);

    const effectiveEncoding = (encoding as BufferEncoding) ?? 'utf-8';
    const fullContent = await filesystem.readFile(path, { encoding: effectiveEncoding });
    const stat = await filesystem.stat(path);

    const isTextEncoding = !encoding || encoding === 'utf-8' || encoding === 'utf8';

    if (!isTextEncoding) {
      return `${stat.path} (${stat.size} bytes, ${effectiveEncoding})\n${fullContent}`;
    }

    if (typeof fullContent !== 'string') {
      return `${stat.path} (${stat.size} bytes, base64)\n${fullContent.toString('base64')}`;
    }

    const hasLineRange = offset !== undefined || limit !== undefined;
    const result = extractLinesWithLimit(fullContent, offset, limit);

    const shouldShowLineNumbers = showLineNumbers !== false;
    const formattedContent = shouldShowLineNumbers
      ? formatWithLineNumbers(result.content, result.lines.start)
      : result.content;

    let header: string;
    if (hasLineRange) {
      header = `${stat.path} (lines ${result.lines.start}-${result.lines.end} of ${result.totalLines}, ${stat.size} bytes)`;
    } else {
      header = `${stat.path} (${stat.size} bytes)`;
    }

    return `${header}\n${formattedContent}`;
  },
});
