import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { extractLinesWithLimit, formatWithLineNumbers } from '../line-utils';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { applyTokenLimit } from './output-helpers';

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.ico',
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';
  return path.slice(lastDot).toLowerCase();
}

function isImagePath(path: string, mimeType?: string): boolean {
  if (mimeType?.toLowerCase().startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(getExtension(path));
}

function getImageMimeType(path: string, statMimeType?: string): string {
  if (statMimeType?.toLowerCase().startsWith('image/')) return statMimeType;
  const ext = getExtension(path);
  return EXTENSION_TO_MIME[ext] ?? 'image/png';
}

export const readFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
  description:
    'Read the contents of a file from the workspace filesystem. Use offset/limit parameters to read specific line ranges for large files. For image files (png, jpg, gif, webp, etc.), the image is shown to the model so it can see the content.',
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
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);

    const stat = await filesystem.stat(path);
    const effectiveEncoding = (encoding as BufferEncoding) ?? 'utf-8';
    const isTextEncoding = !encoding || encoding === 'utf-8' || encoding === 'utf8';

    if (isTextEncoding && isImagePath(path, stat.mimeType)) {
      const raw = await filesystem.readFile(path);
      const data =
        typeof raw === 'string' ? Buffer.from(raw, 'binary').toString('base64') : (raw as Buffer).toString('base64');
      const mediaType = getImageMimeType(path, stat.mimeType);
      return { type: 'image' as const, path: stat.path, size: stat.size, data, mediaType };
    }

    const fullContent = await filesystem.readFile(path, { encoding: effectiveEncoding });
    const tokenLimit = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]?.maxOutputTokens;

    if (!isTextEncoding) {
      return await applyTokenLimit(
        `${stat.path} (${stat.size} bytes, ${effectiveEncoding})\n${fullContent}`,
        tokenLimit,
        'end',
      );
    }

    if (typeof fullContent !== 'string') {
      return await applyTokenLimit(
        `${stat.path} (${stat.size} bytes, base64)\n${fullContent.toString('base64')}`,
        tokenLimit,
        'end',
      );
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

    return await applyTokenLimit(`${header}\n${formattedContent}`, tokenLimit, 'end');
  },
  toModelOutput: (output: unknown) => {
    if (typeof output === 'object' && output !== null && 'type' in output && (output as { type: string }).type === 'image') {
      const img = output as unknown as { path: string; size: number; data: string; mediaType: string };
      return {
        type: 'content',
        value: [
          { type: 'text', text: `${img.path} (${img.size} bytes)` },
          { type: 'image-data', data: img.data, mediaType: img.mediaType },
        ],
      };
    }
    if (typeof output === 'string') {
      return { type: 'text', value: output };
    }
    return output;
  },
});
