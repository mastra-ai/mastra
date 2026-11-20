import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { extractLinesWithLimit, formatWithLineNumbers } from '../line-utils';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import type { MediaToolResult } from './media';
import { DEFAULT_MAX_MEDIA_BYTES, DEFAULT_MEDIA_TYPES, mediaToModelOutput } from './media';
import { applyTokenLimit } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

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
  'application/jsonl',
  'application/x-jsonl',
  'application/ndjson',
  'application/x-ndjson',
  'application/jsonlines',
  'application/json-lines',
  'application/x-jsonlines',
  'application/x-php',
  'application/dart',
]);

/**
 * Charsets whose bytes decode correctly as utf-8. Text content declared with
 * any other charset (e.g. `utf-16le`) would be garbled by a utf-8 read.
 */
const UTF8_COMPATIBLE_CHARSETS = new Set(['utf-8', 'utf8', 'us-ascii', 'ascii']);

/** Matches `; name=value` MIME parameters, keeping quoted values (which may contain `;`) whole. */
const MIME_PARAMETER_PATTERN = /;\s*([^\s;=]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/g;

function getMimeCharset(mimeType: string): string | undefined {
  for (const [, name, value] of mimeType.matchAll(MIME_PARAMETER_PATTERN)) {
    if (name!.toLowerCase() !== 'charset') continue;
    const unquoted = value!.startsWith('"') ? value!.slice(1, -1).replace(/\\(.)/g, '$1') : value!;
    return unquoted.trim().toLowerCase();
  }
  return undefined;
}

function isTextLikeMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return true;
  const charset = getMimeCharset(mimeType);
  if (charset !== undefined && !UTF8_COMPATIBLE_CHARSETS.has(charset)) return false;
  mimeType = mimeType.split(';', 1)[0]!.trim().toLowerCase();
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

/** Bytes decoded from the start of a media file to check its signature. PDF allows its header anywhere in the first 1 KiB. */
const MEDIA_SNIFF_BYTES = 1024;

const startsWithBytes = (bytes: Uint8Array, prefix: number[], offset = 0) =>
  bytes.length >= offset + prefix.length && prefix.every((byte, index) => bytes[offset + index] === byte);

/**
 * Media types with a fixed signature, and how to recognize each from a file's first bytes.
 * Other configured types (e.g. SVG, HEIC, audio) have no reliable signature here and are
 * trusted by extension.
 */
const MEDIA_SIGNATURES: [mediaType: string, matches: (bytes: Uint8Array) => boolean][] = [
  ['image/png', bytes => startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])],
  ['image/jpeg', bytes => startsWithBytes(bytes, [0xff, 0xd8, 0xff])],
  // `GIF87a` or `GIF89a`.
  [
    'image/gif',
    bytes =>
      startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  [
    'image/webp',
    bytes => startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  ],
  // A version header such as `%PDF-1.7`, which readers accept anywhere in the first 1 KiB.
  ['application/pdf', bytes => /%PDF-\d\.\d/.test(Buffer.from(bytes).toString('latin1'))],
];

const SIGNED_MEDIA_TYPES = new Set([...MEDIA_SIGNATURES.map(([mediaType]) => mediaType), 'image/jpg']);

/**
 * The media type to send for a file whose extension maps to `declared`. For types with a known
 * signature, this is the type the bytes show (so a PNG named `.jpg` goes as `image/png`), or
 * undefined when they show none: an HTML error page saved as `.pdf` is not a PDF, and providers
 * reject it with a 400 that also fails every later call carrying the same history.
 */
function contentMediaType(head: Uint8Array, declared: string): string | undefined {
  if (!SIGNED_MEDIA_TYPES.has(declared.split(';', 1)[0]!.trim().toLowerCase())) return declared;
  return MEDIA_SIGNATURES.find(([, matches]) => matches(head))?.[0];
}

/** Whether a whole file is UTF-8 text: no NUL bytes and no invalid sequences. */
function isUtf8Text(content: Uint8Array): boolean {
  if (content.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
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

      // Whether the file is surfaced as media is decided from the file's mime
      // type and the `mediaTypes` config — NOT from the absence of the optional
      // `encoding` argument. Strict-schema providers always populate optional
      // parameters, so gating this branch on `!encoding` made media parts
      // unreachable for them and turned `mediaTypes`/`maxMediaBytes` into dead
      // config (#23896). Read as base64 and return a MediaToolResult so
      // `toModelOutput` can surface it as a file/image part the model can
      // natively consume.
      // Set when the extension says media but the bytes don't, and the bytes read as text.
      let mislabeledNote: string | undefined;
      if (shouldReturnAsMedia(stat.mimeType)) {
        const maxMediaBytes = readFileConfig?.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;
        if (stat.size <= maxMediaBytes) {
          const base64 = (await filesystem.readFile(path, { encoding: 'base64' })) as string;
          const head = Buffer.from(base64.slice(0, Math.ceil(MEDIA_SNIFF_BYTES / 3) * 4), 'base64');
          const mediaType = contentMediaType(head, stat.mimeType!);
          if (mediaType && shouldReturnAsMedia(mediaType)) {
            const header = `${stat.path} (${stat.size} bytes, ${mediaType})`;
            span.end({ success: true }, { bytesTransferred: stat.size });
            return {
              __workspaceMedia: true,
              text: header,
              mediaType,
              data: base64,
            } satisfies MediaToolResult;
          }
          // The extension says media but the content isn't. Never send it as media: show text
          // content as text, and only metadata for anything else, unless `encoding` was given.
          const mismatch = `the extension says ${stat.mimeType}, but the content is ${mediaType ?? 'not a valid file of that type'}`;
          // The whole file, not just its head: binary content can follow a first KiB of ASCII.
          if (isUtf8Text(Buffer.from(base64, 'base64'))) {
            mislabeledNote = mismatch;
          } else if (!encoding) {
            span.end({ success: true }, { bytesTransferred: 0 });
            return `${stat.path} (${stat.size} bytes) — ${mismatch}, so it was not sent as media. Pass an explicit \`encoding\` (e.g. \`hex\`) to read the raw bytes.`;
          }
        } else if (!encoding) {
          // Oversized media: avoid materializing huge base64 strings (and
          // persisting them through storage on rehydration). Return metadata-only
          // unless the caller explicitly asked for raw bytes via `encoding`, in
          // which case fall through to the raw read path below.
          span.end({ success: true }, { bytesTransferred: 0 });
          return `${stat.path} (${stat.size} bytes, ${stat.mimeType}) — exceeds maxMediaBytes (${maxMediaBytes}). Returning metadata only; configure \`maxMediaBytes\` on the read_file tool to raise this cap.`;
        }
      }

      // When the caller didn't ask for a specific encoding and the file is
      // a binary type that's neither text-readable nor in `mediaTypes`,
      // return metadata only so the agent knows about the file without
      // dumping useless base64 into the conversation.
      if (!encoding && !mislabeledNote && !isTextLikeMimeType(stat.mimeType)) {
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
      if (mislabeledNote) header += ` — ${mislabeledNote}; showing it as text`;

      const output = await applyTokenLimit(`${header}\n${formattedContent}`, tokenLimit, 'end');
      span.end({ success: true }, { bytesTransferred: stat.size });
      return output;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
  // For plain string output, mediaToModelOutput returns undefined so we don't
  // store a duplicate copy on providerMetadata.mastra.modelOutput — the
  // original string result is already what the model sees.
  toModelOutput: mediaToModelOutput,
});
