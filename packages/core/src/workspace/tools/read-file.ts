import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { extractLinesWithLimit, formatWithLineNumbers } from '../line-utils';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { applyTokenLimit } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

/**
 * Internal marker on the tool's text result that signals to `toModelOutput`
 * that the file should be surfaced to the model as a media part (image or
 * binary file) rather than as plain text. We attach this on a wrapper object
 * but only the `text` field is shown to the model (via toModelOutput); the
 * marker is stripped before it ever reaches the model.
 *
 * The shape is intentionally JSON-serialisable so it round-trips through
 * storage layers that snapshot tool results.
 */
type MediaToolResult = {
  __workspaceMedia: true;
  text: string;
  mediaType: string;
  data: string;
};

function isMediaToolResult(value: unknown): value is MediaToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__workspaceMedia === true &&
    typeof (value as Record<string, unknown>).text === 'string' &&
    typeof (value as Record<string, unknown>).mediaType === 'string' &&
    typeof (value as Record<string, unknown>).data === 'string'
  );
}

/**
 * Default mime types surfaced to the model as media parts. The list is
 * intentionally the intersection of image formats supported by the major
 * model providers (Anthropic, OpenAI, Gemini) plus `application/pdf`.
 * `image/*` is *not* used so we don't surface exotic subtypes like SVG/BMP
 * that some providers reject. Override `mediaTypes` to broaden this.
 */
const DEFAULT_MEDIA_TYPES: string[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/**
 * Default cap (in bytes) on inline media reads. Files larger than this fall
 * back to metadata-only output instead of being fully base64-encoded into
 * the model context (and persisted in storage on rehydration). 10 MiB is
 * roughly aligned with provider per-image/per-pdf limits.
 */
const DEFAULT_MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/**
 * `application/*` mime types that are actually text content and safe to read
 * as utf-8. Anything not matching `text/*` and not in this list is treated
 * as opaque binary when there's no explicit encoding and no media match.
 */
const TEXT_APPLICATION_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/graphql',
  'application/x-sh',
  'application/x-yaml',
  'application/yaml',
  'application/ld+json',
  'application/sql',
]);

function isTextLikeMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return true;
  // `application/octet-stream` is the catch-all for unknown extensions; we
  // optimistically treat it as text so files like `.log` or `.conf` (which
  // have no registered mime mapping) still get read as utf-8.
  if (mimeType === 'application/octet-stream') return true;
  if (mimeType.startsWith('text/')) return true;
  if (TEXT_APPLICATION_TYPES.has(mimeType)) return true;
  if (mimeType.endsWith('+json') || mimeType.endsWith('+xml')) return true;
  return false;
}

/**
 * Validates a single `mediaTypes` pattern. Accepts:
 * - `*` or `*​/*` — match anything
 * - `type/*` — match all subtypes of a top-level type (e.g. `image/*`)
 * - `type/subtype` — exact mime type (e.g. `application/pdf`, `application/vnd.api+json`)
 *
 * Throws a descriptive error for anything else so misconfigurations surface
 * immediately instead of silently failing to match.
 */
const MEDIA_TYPE_PATTERN = /^(?:\*|\*\/\*|[a-z0-9!#$&^_.+-]+\/(?:\*|[a-z0-9!#$&^_.+-]+))$/i;

function validateMediaTypePatterns(patterns: string[]): void {
  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || !MEDIA_TYPE_PATTERN.test(pattern)) {
      throw new Error(
        `Invalid \`mediaTypes\` pattern: ${JSON.stringify(pattern)}. Expected \`*\`, \`*/*\`, \`type/*\`, or a full mime type like \`application/pdf\`.`,
      );
    }
  }
}

/**
 * Build a predicate from the `mediaTypes` config option.
 * Supports glob patterns (e.g. `'image/*'`), custom functions, and `false`
 * to disable media parts entirely.
 */
function buildMediaTypeCheck(
  config: string[] | ((mimeType: string) => boolean) | false | undefined,
): (mimeType: string | undefined) => boolean {
  if (config === false) return () => false;
  if (typeof config === 'function') {
    return (mimeType: string | undefined) => (mimeType ? config(mimeType) : false);
  }
  const patterns = config ?? DEFAULT_MEDIA_TYPES;
  validateMediaTypePatterns(patterns);
  return (mimeType: string | undefined) => {
    if (!mimeType) return false;
    return patterns.some(pattern => {
      if (pattern === '*' || pattern === '*/*') return true;
      if (pattern.endsWith('/*')) {
        return mimeType.startsWith(pattern.slice(0, -1));
      }
      return mimeType === pattern;
    });
  };
}

export const readFileTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
  description:
    'Read a file from the workspace filesystem. Text files come back as text — use offset/limit to read a line range from large files. Supported media files come back as a native file part you can view directly. Other binary files return only their metadata (path, size, mime type) since their raw contents are not useful to read.',
  outputSchema: z.union([
    z.string(),
    z.object({
      __workspaceMedia: z.literal(true),
      text: z.string(),
      mediaType: z.string(),
      data: z.string(),
    }),
  ]),
  inputSchema: z.object({
    path: z.string().describe('The path to the file to read (e.g., "data/config.json")'),
    offset: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        'Line number to start reading from (1-indexed). Only used when reading text files; ignored for media and other binary files. Defaults to line 1 if omitted.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        'Maximum number of lines to read. Only used when reading text files; ignored for media and other binary files. Defaults to the end of the file if omitted.',
      ),
    showLineNumbers: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Prefix each line with its line number. Only used when reading text files; ignored for media and other binary files. Defaults to true if omitted.',
      ),
    encoding: z
      .enum(['utf-8', 'utf8', 'base64', 'hex', 'binary'])
      .optional()
      .describe(
        "Usually omit this — text files and supported media are handled automatically. Pass `base64` or `hex` to get the file's raw bytes encoded as text when you need to inspect an unsupported binary file that would otherwise only return metadata (e.g. checking a file header or magic bytes).",
      ),
  }),
  execute: async ({ path, encoding, offset, limit, showLineNumbers }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'readFile',
      input: { path, encoding, offset, limit },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      const stat = await filesystem.stat(path);

      const readFileConfig = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
      const shouldReturnAsMedia = buildMediaTypeCheck(readFileConfig?.mediaTypes);

      // When the caller didn't ask for a specific encoding and the file's
      // mime type matches the `mediaTypes` predicate, read as base64 and
      // return a MediaToolResult so `toModelOutput` can surface it as a
      // file/image part the model can natively consume.
      if (!encoding && shouldReturnAsMedia(stat.mimeType)) {
        const maxMediaBytes = readFileConfig?.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;
        // Avoid materializing huge media files (and persisting their base64
        // string through storage on rehydration). Fall back to metadata-only
        // when the file exceeds the configured size cap.
        if (stat.size > maxMediaBytes) {
          span.end({ success: true }, { bytesTransferred: 0 });
          return `${stat.path} (${stat.size} bytes, ${stat.mimeType}) — exceeds maxMediaBytes (${maxMediaBytes}). Returning metadata only; configure \`maxMediaBytes\` on the read_file tool to raise this cap.`;
        }
        const base64 = (await filesystem.readFile(path, { encoding: 'base64' })) as string;
        const header = `${stat.path} (${stat.size} bytes, ${stat.mimeType})`;
        span.end({ success: true }, { bytesTransferred: stat.size });
        return {
          __workspaceMedia: true,
          text: header,
          mediaType: stat.mimeType!,
          data: base64,
        } satisfies MediaToolResult;
      }

      // When the caller didn't ask for a specific encoding and the file is
      // a binary type that's neither text-readable nor in `mediaTypes`,
      // return metadata only so the agent knows about the file without
      // dumping useless base64 into the conversation.
      if (!encoding && !isTextLikeMimeType(stat.mimeType)) {
        span.end({ success: true }, { bytesTransferred: 0 });
        return `${stat.path} (${stat.size} bytes, ${stat.mimeType ?? 'unknown'}) — binary file not readable as text. Pass an explicit \`encoding\` (e.g. \`base64\`) to read the raw bytes, or configure \`mediaTypes\` on the read_file tool to surface it as a media part.`;
      }

      const effectiveEncoding = (encoding as BufferEncoding) ?? 'utf-8';
      const fullContent = await filesystem.readFile(path, { encoding: effectiveEncoding });

      const isTextEncoding = !encoding || encoding === 'utf-8' || encoding === 'utf8';

      const tokenLimit = readFileConfig?.maxOutputTokens;

      if (!isTextEncoding) {
        const output = await applyTokenLimit(
          `${stat.path} (${stat.size} bytes, ${effectiveEncoding})\n${fullContent}`,
          tokenLimit,
          'end',
        );
        span.end({ success: true }, { bytesTransferred: stat.size });
        return output;
      }

      if (typeof fullContent !== 'string') {
        const output = await applyTokenLimit(
          `${stat.path} (${stat.size} bytes, base64)\n${fullContent.toString('base64')}`,
          tokenLimit,
          'end',
        );
        span.end({ success: true }, { bytesTransferred: stat.size });
        return output;
      }

      const hasLineRange = offset !== undefined || limit !== undefined;
      const result = extractLinesWithLimit(fullContent, offset, limit);

      const shouldShowLineNumbers = showLineNumbers !== false;
      const hasExtractedLines = result.lines.start !== 0 || result.lines.end !== 0;
      const formattedContent =
        shouldShowLineNumbers && hasExtractedLines
          ? formatWithLineNumbers(result.content, result.lines.start)
          : result.content;

      let header: string;
      if (hasLineRange) {
        header = `${stat.path} (lines ${result.lines.start}-${result.lines.end} of ${result.totalLines}, ${stat.size} bytes)`;
      } else {
        header = `${stat.path} (${stat.size} bytes)`;
      }

      const output = await applyTokenLimit(`${header}\n${formattedContent}`, tokenLimit, 'end');
      span.end({ success: true }, { bytesTransferred: stat.size });
      return output;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
  toModelOutput: (output: unknown) => {
    if (isMediaToolResult(output)) {
      return {
        type: 'content',
        value: [
          { type: 'text', text: output.text },
          { type: 'media', data: output.data, mediaType: output.mediaType },
        ],
      };
    }
    // For plain string output, return undefined so we don't store a duplicate
    // copy on providerMetadata.mastra.modelOutput — the original string result
    // is already what the model sees.
    return undefined;
  },
});
