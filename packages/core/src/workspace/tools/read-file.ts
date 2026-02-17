import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { extractLinesWithLimit, formatWithLineNumbers } from '../line-utils';
import { requireFilesystem } from './helpers';

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
    const { workspace, filesystem } = requireFilesystem(context);

    const effectiveEncoding = (encoding as BufferEncoding) ?? 'utf-8';
    const fullContent = await filesystem.readFile(path, { encoding: effectiveEncoding });
    const stat = await filesystem.stat(path);

    const isTextEncoding = !encoding || encoding === 'utf-8' || encoding === 'utf8';

    if (!isTextEncoding) {
      await context?.writer?.custom({
        type: 'data-workspace-metadata',
        data: {
          toolName: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
          path: stat.path,
          size: stat.size,
          encoding: effectiveEncoding,
          workspace: { id: workspace.id, name: workspace.name },
          filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
        },
      });
      return `${stat.path} (${stat.size} bytes, ${effectiveEncoding})\n${fullContent}`;
    }

    if (typeof fullContent !== 'string') {
      await context?.writer?.custom({
        type: 'data-workspace-metadata',
        data: {
          toolName: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
          path: stat.path,
          size: stat.size,
          encoding: 'base64',
          workspace: { id: workspace.id, name: workspace.name },
          filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
        },
      });
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

    await context?.writer?.custom({
      type: 'data-workspace-metadata',
      data: {
        toolName: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
        path: stat.path,
        size: stat.size,
        ...(hasLineRange && { lines: result.lines, totalLines: result.totalLines }),
        workspace: { id: workspace.id, name: workspace.name },
        filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
      },
    });

    return `${header}\n${formattedContent}`;
  },
});
