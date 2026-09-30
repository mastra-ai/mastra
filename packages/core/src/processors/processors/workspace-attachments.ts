/**
 * WorkspaceAttachmentsProcessor
 *
 * Writes attachments the model can't read (for example .xlsx) into the agent's
 * workspace and replaces them with a text note that points at the uploaded path,
 * so the agent can read them with workspace tools or skills.
 *
 * Opt-in: add it to the agent's `inputProcessors` with the `extensions` and/or
 * `mimeTypes` to route. With neither, every attachment goes to the model. It must
 * be listed directly in `inputProcessors` (not inside a processor workflow) so the
 * agent can bind it to the run's workspace. Without a writable workspace
 * destination the run is aborted instead of sending the file to the model.
 *
 * Routed files persist under `uploads/<id>/<name>` in the workspace; cleaning
 * them up is left to the user.
 *
 * Tripwire codes (`metadata.code`) when the run is aborted:
 * - `WORKSPACE_REQUIRED_FOR_ATTACHMENT`: no workspace, or none that can be written to.
 * - `ATTACHMENT_NOT_INLINE`: the file was sent as a URL instead of inline data.
 * - `ATTACHMENT_INVALID_DATA`: the data is not base64 or a base64 data URL.
 * - `ATTACHMENT_TOO_LARGE`: a file is larger than `maxBytes`, or all files together exceed `maxTotalBytes`.
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '../../agent/message-list';
import { SpanType } from '../../observability';
import { RequestContext } from '../../request-context';
import type { CompositeFilesystem } from '../../workspace/filesystem/composite-filesystem';
import type { WorkspaceSandbox } from '../../workspace/sandbox/sandbox';
import type { AnyWorkspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

/** Tripwire code: a routed attachment arrived but the agent has no writable workspace. */
export const WORKSPACE_REQUIRED_FOR_ATTACHMENT = 'WORKSPACE_REQUIRED_FOR_ATTACHMENT';
/** Tripwire code: a routed attachment was sent as a URL instead of inline data. */
export const ATTACHMENT_NOT_INLINE = 'ATTACHMENT_NOT_INLINE';
/** Tripwire code: a routed attachment's data is not base64 or a base64 data URL. */
export const ATTACHMENT_INVALID_DATA = 'ATTACHMENT_INVALID_DATA';
/** Tripwire code: a routed attachment is larger than `maxBytes`. */
export const ATTACHMENT_TOO_LARGE = 'ATTACHMENT_TOO_LARGE';

const FALLBACK_MEDIA_TYPE = 'application/octet-stream';
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Options for {@link WorkspaceAttachmentsProcessor}.
 *
 * An attachment is routed to the workspace if its filename extension is in
 * `extensions` **or** its MIME type is in `mimeTypes`. The MIME check never
 * routes a `.csv` file, because browsers report CSVs as
 * `application/vnd.ms-excel`; to route CSVs, add `.csv` to `extensions`.
 * With neither option set, nothing is routed.
 *
 * @example
 * ```ts
 * new WorkspaceAttachmentsProcessor({
 *   extensions: ['.xlsx', '.xls'],
 *   mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
 *   maxBytes: 10_000_000,
 * });
 * ```
 */
export interface WorkspaceAttachmentsProcessorOptions {
  /**
   * Filename extensions to route, e.g. `['.xlsx', '.xls']`. Matched
   * case-insensitively against the last extension of the filename; the leading
   * dot is optional (`'xlsx'` and `'.xlsx'` both work). Empty or `'.'` entries
   * throw in the constructor. A file matched only by extension that has no MIME
   * type is noted as `application/octet-stream`.
   */
  extensions?: string[];
  /**
   * MIME types to route, e.g. `['application/vnd.ms-excel']`. Exact,
   * case-insensitive match. Applies to files with no filename or whose
   * extension isn't listed in `extensions` (never to `.csv`). Empty entries
   * throw in the constructor.
   */
  mimeTypes?: string[];
  /**
   * Largest routed attachment accepted, in bytes. Base64 and data URL input is
   * measured before decoding, so oversized payloads are never decoded. A file
   * exactly at the limit is accepted; a larger one stops the run with an
   * `ATTACHMENT_TOO_LARGE` tripwire before anything is written. Must be a
   * positive integer, or the constructor throws. No limit when omitted.
   */
  maxBytes?: number;
  /**
   * Largest combined size, in bytes, of all routed attachments in one request.
   * Exactly at the limit is accepted; above it the run stops with an
   * `ATTACHMENT_TOO_LARGE` tripwire before anything is written. Must be a
   * positive integer, or the constructor throws. No limit when omitted.
   */
  maxTotalBytes?: number;
  /**
   * Workspace used by the current run. The agent sets it; when absent, routed attachments abort the run.
   * @internal
   */
  workspace?: AnyWorkspace;
}

export interface WorkspaceAttachmentsTripwireMetadata {
  code: string;
  mediaType?: string;
}

/** Returns the media type to report for an attachment that must be routed, or undefined to leave it alone. */
type RouteMatcher = (mediaType: unknown, filename: unknown) => string | undefined;

function normalizeList(values: string[] | undefined, option: string, normalize: (value: string) => string) {
  return new Set(
    (values ?? []).map(value => {
      const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (!trimmed || trimmed === '.') {
        throw new Error(`WorkspaceAttachmentsProcessor: \`${option}\` entries must be non-empty strings`);
      }
      return normalize(trimmed);
    }),
  );
}

function createRouteMatcher(options: WorkspaceAttachmentsProcessorOptions): RouteMatcher | undefined {
  const extensions = normalizeList(options.extensions, 'extensions', ext => (ext.startsWith('.') ? ext : `.${ext}`));
  const mimeTypes = normalizeList(options.mimeTypes, 'mimeTypes', type => type);
  if (!extensions.size && !mimeTypes.size) return undefined;

  return (mediaType, filename) => {
    const type = typeof mediaType === 'string' && mediaType ? mediaType.toLowerCase() : undefined;
    const extension = typeof filename === 'string' ? filename.toLowerCase().match(/\.[^.]+$/)?.[0] : undefined;
    // Browsers report CSV files as application/vnd.ms-excel, so a MIME match never routes a .csv file.
    const matches = (extension && extensions.has(extension)) || (type && mimeTypes.has(type) && extension !== '.csv');
    return matches ? (type ?? FALLBACK_MEDIA_TYPE) : undefined;
  };
}

function isCompositeFilesystem(fs: unknown): fs is CompositeFilesystem {
  return !!fs && typeof fs === 'object' && 'mounts' in fs && (fs as { mounts: unknown }).mounts instanceof Map;
}

function sanitizeFilename(filename: unknown): string {
  const base = typeof filename === 'string' ? (filename.split(/[\\/]/).pop() ?? '') : '';
  const cleaned = base
    .replace(/\.\.+/g, '.')
    .replace(/^\.+/, '')
    .replace(/[\x00-\x1f]/g, '');
  return cleaned || 'attachment';
}

function decodeBase64(value: string): Uint8Array | undefined {
  const compact = value.replace(/\s/g, '');
  if (!compact || compact.length % 4 !== 0 || !BASE64.test(compact)) return undefined;
  return Uint8Array.from(atob(compact), c => c.charCodeAt(0));
}

/** Restores the original bytes from the transport encoding (bytes, base64 or data URL), or returns an error code. */
function decodeData(data: unknown): Uint8Array | typeof ATTACHMENT_NOT_INLINE | typeof ATTACHMENT_INVALID_DATA {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof URL) return ATTACHMENT_NOT_INLINE;
  if (typeof data !== 'string') return ATTACHMENT_INVALID_DATA;
  if (data.startsWith('data:')) {
    const comma = data.indexOf(',');
    if (comma === -1) return ATTACHMENT_INVALID_DATA;
    const meta = data.slice(5, comma).split(';');
    if (!meta.includes('base64')) return ATTACHMENT_INVALID_DATA;
    return decodeBase64(data.slice(comma + 1)) ?? ATTACHMENT_INVALID_DATA;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(data)) return ATTACHMENT_NOT_INLINE;
  return decodeBase64(data) ?? ATTACHMENT_INVALID_DATA;
}

/** Size the data will have once decoded, computed without decoding base64 / data URL strings. */
function estimatedDecodedSize(data: unknown): number | undefined {
  if (data instanceof Uint8Array || data instanceof ArrayBuffer) return data.byteLength;
  if (typeof data !== 'string') return undefined;
  const payload = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
  let length = 0;
  let padding = 0;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    if (c === 0x20 || (c >= 0x09 && c <= 0x0d)) continue;
    length++;
    padding = c === 0x3d ? padding + 1 : 0;
  }
  return Math.max(0, Math.floor((length * 3) / 4) - padding);
}

function assertPositiveInteger(value: number | undefined, option: string) {
  if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
    throw new Error(`WorkspaceAttachmentsProcessor: \`${option}\` must be a positive integer`);
  }
}

/** Text note that replaces the attachment. The filename is JSON-encoded so any character round-trips. */
export function formatWorkspaceAttachmentNote(name: string, mediaType: string, path: string): string {
  return `[Attachment ${JSON.stringify(name)} (${mediaType}) was uploaded to the workspace at ${path}. Use workspace tools to read it.]`;
}

/** An attachment the model can't read, plus how to swap it for a text note in its message. */
type UnsupportedAttachment = {
  mediaType: string;
  filename?: string;
  data: unknown;
  replaceWithNote: (note: string) => void;
};

/** Where uploads go: a writer, an optional cleanup, and the directory to write under. */
type UploadTarget = {
  directory: string;
  write: (path: string, content: Uint8Array) => Promise<unknown>;
  /** Writes every file in one call when the destination supports batches. */
  writeAll?: (files: { path: string; content: Uint8Array }[]) => Promise<unknown>;
  remove?: (path: string) => Promise<unknown>;
};

function removeMirroredAttachment(content: MastraMessageContentV2, matches: (url: string) => boolean) {
  content.experimental_attachments = content.experimental_attachments?.filter(a => !matches(a.url));
  if (!content.experimental_attachments?.length) delete content.experimental_attachments;
}

/**
 * Finds unsupported attachments in user and signal messages, whether sent as file parts
 * or as `experimental_attachments`. MessageList mirrors file parts into
 * `experimental_attachments`, so those mirrors are skipped to avoid uploading twice.
 */
function findUnsupportedAttachments(messages: MastraDBMessage[], match: RouteMatcher): UnsupportedAttachment[] {
  const found: UnsupportedAttachment[] = [];

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'signal') continue;
    const content = message.content;
    if (!content || typeof content !== 'object') continue;

    const parts = Array.isArray(content.parts) ? content.parts : [];
    const fromParts = new Set<unknown>();

    parts.forEach((part, index) => {
      if (part?.type !== 'file') return;
      const file = part as {
        mimeType?: unknown;
        mediaType?: unknown;
        filename?: unknown;
        data?: unknown;
        url?: unknown;
      };
      // MessageList mirrors file parts into experimental_attachments without the filename; skip those mirrors.
      const data = file.data ?? file.url;
      fromParts.add(data);
      const mediaType = match(file.mimeType ?? file.mediaType, file.filename);
      if (!mediaType) return;

      found.push({
        mediaType,
        filename: typeof file.filename === 'string' ? file.filename : undefined,
        data,
        replaceWithNote: note => {
          parts[index] = { type: 'text', text: note };
          removeMirroredAttachment(content, url => url === data);
        },
      });
    });

    for (const attachment of content.experimental_attachments ?? []) {
      const mediaType = match(attachment.contentType, attachment.name);
      if (!mediaType || fromParts.has(attachment.url)) continue;
      found.push({
        mediaType,
        filename: attachment.name,
        data: attachment.url,
        replaceWithNote: note => {
          removeMirroredAttachment(content, url => url === attachment.url);
          content.parts.push({ type: 'text', text: note });
        },
      });
    }
  }

  return found;
}

/**
 * Picks where to write uploads: the filesystem (first writable mount for composite
 * filesystems), else the sandbox. Returns undefined when nothing is writable.
 */
async function resolveUploadTarget(
  workspace: AnyWorkspace | undefined,
  requestContext: RequestContext,
): Promise<UploadTarget | { unavailable: string }> {
  if (!workspace)
    return { unavailable: 'this agent has no workspace. Configure a workspace with a writable filesystem' };

  const filesystem = workspace.resolveFilesystem
    ? await workspace.resolveFilesystem({ requestContext })
    : workspace.filesystem;

  if (filesystem) {
    const write = (path: string, content: Uint8Array) => filesystem.writeFile(path, content);
    const remove = (path: string) => filesystem.deleteFile(path, { force: true });

    if (isCompositeFilesystem(filesystem)) {
      const writableMount = [...filesystem.mounts].find(([, fs]) => !fs.readOnly);
      if (!writableMount) {
        const mounts = [...filesystem.mounts.keys()].join(', ');
        return {
          unavailable: `every mount of workspace "${workspace.name}" is read-only (${mounts}). Add a writable mount`,
        };
      }
      return { directory: `${writableMount[0].replace(/\/$/, '')}/uploads`, write, remove };
    }
    if (filesystem.readOnly) {
      return {
        unavailable: `the filesystem of workspace "${workspace.name}" is read-only. Make it writable or add a writable mount`,
      };
    }
    return { directory: 'uploads', write, remove };
  }

  const sandbox = workspace.resolveSandbox ? await workspace.resolveSandbox({ requestContext }) : workspace.sandbox;
  // writeFiles has no delete counterpart, so rollback goes through executeCommand when available
  const remove = sandbox?.executeCommand
    ? (path: string) => runShell(sandbox, `rm -rf ${shellQuote(parentDirectory(path))}`, 'remove the upload directory')
    : undefined;
  if (sandbox?.writeFiles) {
    // One call for the whole request: with no executeCommand there is no way to delete a
    // partial upload, so atomicity across the batch relies on the provider's writeFiles.
    const writeAll = (files: { path: string; content: Uint8Array }[]) =>
      sandbox.writeFiles!(files.map(({ path, content }) => ({ path, content: Buffer.from(content) })));
    return { directory: 'uploads', write: (path, content) => writeAll([{ path, content }]), writeAll, remove };
  }
  if (sandbox?.executeCommand) {
    return {
      directory: 'uploads',
      write: (path, content) => writeThroughCommands(sandbox, path, content),
      remove,
    };
  }
  return {
    unavailable: sandbox
      ? `workspace "${workspace.name}" has no filesystem and its sandbox supports neither writeFiles nor executeCommand. Add a writable filesystem`
      : `workspace "${workspace.name}" has neither a filesystem nor a sandbox. Add a writable filesystem`,
  };
}

/** Base64 characters sent per command, kept well under common argv limits. */
const COMMAND_CHUNK_SIZE = 64_000;

/**
 * Writes a file into a sandbox that has no `writeFiles`, as the sandbox contract
 * asks: base64 chunks are appended to a temp file, then decoded with the first
 * available decoder (GNU/busybox `base64 -d`, macOS `base64 -D`, `openssl`).
 * On failure the file's upload directory is removed.
 */
async function writeThroughCommands(sandbox: WorkspaceSandbox, path: string, content: Uint8Array) {
  const target = shellQuote(path);
  const encoded = shellQuote(`${path}.b64`);
  const base64 = Buffer.from(content).toString('base64');
  try {
    await runShell(
      sandbox,
      `mkdir -p ${shellQuote(parentDirectory(path))} && : > ${encoded}`,
      'create the upload directory',
    );
    const chunks = Math.ceil(base64.length / COMMAND_CHUNK_SIZE);
    for (let index = 0; index < chunks; index++) {
      const chunk = base64.slice(index * COMMAND_CHUNK_SIZE, (index + 1) * COMMAND_CHUNK_SIZE);
      await runShell(sandbox, `printf '%s' '${chunk}' >> ${encoded}`, `upload chunk ${index + 1} of ${chunks}`);
    }
    await runShell(
      sandbox,
      `{ base64 -d ${encoded} > ${target} 2>/dev/null || base64 -D -i ${encoded} > ${target} 2>/dev/null || openssl base64 -d -A -in ${encoded} -out ${target}; } && rm -f ${encoded}`,
      'decode the file (the sandbox needs `base64` or `openssl`)',
    );
  } catch (error) {
    await runShell(sandbox, `rm -rf ${shellQuote(parentDirectory(path))}`, 'clean up').catch(() => {});
    throw error;
  }
}

async function runShell(sandbox: WorkspaceSandbox, script: string, step: string) {
  const result = await sandbox.executeCommand!('sh', ['-c', script]);
  if (!result.success) {
    const details = result.stderr.trim() || result.stdout.trim() || 'no output';
    throw new Error(`Sandbox command failed to ${step} (exit code ${result.exitCode}): ${details}`);
  }
}

/** Single-quotes a value for POSIX shells. */
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parentDirectory(path: string) {
  return path.slice(0, path.lastIndexOf('/'));
}

/**
 * Writes every file, or none: if one write fails, files already written are deleted.
 * Batch destinations get a single call; a failed batch is rolled back when the target can remove files.
 */
async function uploadAll(target: UploadTarget, files: { filename?: string; bytes: Uint8Array }[]) {
  if (target.writeAll) {
    const paths = files.map(file => `${target.directory}/${crypto.randomUUID()}/${sanitizeFilename(file.filename)}`);
    try {
      await target.writeAll(files.map((file, index) => ({ path: paths[index]!, content: file.bytes })));
    } catch (error) {
      if (target.remove) await Promise.allSettled(paths.map(path => target.remove!(path)));
      const names = files.map(file => `"${file.filename ?? 'attachment'}"`).join(', ');
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to upload attachments ${names} to ${target.directory}: ${reason}`, { cause: error });
    }
    return paths;
  }
  const paths: string[] = [];
  try {
    for (const file of files) {
      const path = `${target.directory}/${crypto.randomUUID()}/${sanitizeFilename(file.filename)}`;
      try {
        await target.write(path, file.bytes);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to upload attachment "${file.filename ?? 'attachment'}" to ${path}: ${reason}`, {
          cause: error,
        });
      }
      paths.push(path);
    }
    return paths;
  } catch (error) {
    if (target.remove) await Promise.allSettled(paths.map(path => target.remove!(path)));
    throw error;
  }
}

export class WorkspaceAttachmentsProcessor implements Processor<'workspace-attachments-processor'> {
  readonly id = 'workspace-attachments-processor' as const;
  readonly name = 'Workspace Attachments Processor';

  readonly spanType = SpanType.WORKSPACE_ACTION;
  readonly spanName = 'workspace:filesystem:attachments';
  readonly spanAttributes = { category: 'filesystem' } as const;

  private readonly options: WorkspaceAttachmentsProcessorOptions;
  private readonly match: RouteMatcher | undefined;

  constructor(options: WorkspaceAttachmentsProcessorOptions = {}) {
    this.options = options;
    this.match = createRouteMatcher(options);
    assertPositiveInteger(options.maxBytes, 'maxBytes');
    assertPositiveInteger(options.maxTotalBytes, 'maxTotalBytes');
  }

  /**
   * Returns a copy bound to the run's workspace, keeping the configured types.
   * @internal
   */
  withWorkspace(workspace: AnyWorkspace | undefined): WorkspaceAttachmentsProcessor {
    return new WorkspaceAttachmentsProcessor({ ...this.options, workspace });
  }

  async processInputStep({
    messageList,
    requestContext,
    abort,
    tracingContext,
  }: ProcessInputStepArgs<WorkspaceAttachmentsTripwireMetadata>) {
    // 1. Find attachments the model can't read.
    if (!this.match) return { messageList };
    const attachments = findUnsupportedAttachments(messageList.get.all.db(), this.match);
    if (!attachments.length) return { messageList };

    // 2. Turn each attachment's transport encoding (base64 / data URL) back into its original bytes.
    const { maxBytes, maxTotalBytes } = this.options;
    const tooLarge = (attachment: UnsupportedAttachment, size: number, limit: number) =>
      abort(
        `Attachment "${attachment.filename ?? 'attachment'}" is ${size} bytes, over the ${limit}-byte limit. Send a smaller file`,
        { metadata: { code: ATTACHMENT_TOO_LARGE, mediaType: attachment.mediaType } },
      );
    const files = attachments.map(attachment => {
      // Reject oversized payloads before allocating their decoded bytes.
      const estimated = estimatedDecodedSize(attachment.data);
      if (maxBytes !== undefined && estimated !== undefined && estimated > maxBytes) {
        return tooLarge(attachment, estimated, maxBytes);
      }
      const bytes = decodeData(attachment.data);
      if (bytes === ATTACHMENT_NOT_INLINE) {
        return abort(
          `Attachment "${attachment.filename ?? 'attachment'}" was sent by URL. Send its content inline as base64 or a data URL`,
          {
            metadata: { code: ATTACHMENT_NOT_INLINE, mediaType: attachment.mediaType },
          },
        );
      }
      if (bytes === ATTACHMENT_INVALID_DATA) {
        return abort(
          `Attachment "${attachment.filename ?? 'attachment'}" has invalid data: expected base64 or a base64 data URL`,
          {
            metadata: { code: ATTACHMENT_INVALID_DATA, mediaType: attachment.mediaType },
          },
        );
      }
      if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
        return tooLarge(attachment, bytes.byteLength, maxBytes);
      }
      return { filename: attachment.filename, bytes };
    });
    const total = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
    if (maxTotalBytes !== undefined && total > maxTotalBytes) {
      return abort(
        `${files.length} attachments total ${total} bytes, over the ${maxTotalBytes}-byte limit for one request. Send fewer or smaller files`,
        { metadata: { code: ATTACHMENT_TOO_LARGE, mediaType: attachments[0]!.mediaType } },
      );
    }

    // 3. Find a writable place in the workspace, or abort instead of sending the binary to the model.
    const workspace = this.options.workspace;
    const target = await resolveUploadTarget(workspace, requestContext ?? new RequestContext());
    tracingContext?.currentSpan?.update({
      attributes: { workspaceId: workspace?.id, workspaceName: workspace?.name, success: !('unavailable' in target) },
    });
    if ('unavailable' in target) {
      const { mediaType, filename } = attachments[0]!;
      return abort(
        `Attachment "${filename ?? 'attachment'}" (${mediaType}) can't be sent to the model and must be stored in a writable workspace, but ${target.unavailable}.`,
        { metadata: { code: WORKSPACE_REQUIRED_FOR_ATTACHMENT, mediaType } },
      );
    }

    // 4. Upload, then replace each attachment with a note pointing at its path.
    const paths = await uploadAll(target, files);
    attachments.forEach((attachment, index) => {
      const path = paths[index]!;
      attachment.replaceWithNote(
        formatWorkspaceAttachmentNote(sanitizeFilename(attachment.filename), attachment.mediaType, path),
      );
    });
    return { messageList };
  }
}
