/**
 * WorkspaceAttachmentsProcessor
 *
 * Models reject spreadsheet binaries (.xlsx / .xls). This processor writes those
 * attachments into the agent's workspace and replaces them with a text note that
 * points at the uploaded path, so the agent can read them with workspace tools
 * or skills.
 *
 * Auto-wired by Agent for every run. Without a writable workspace destination the
 * run is aborted instead of sending the binary to the model.
 */

import type { MastraDBMessage, MastraMessageContentV2 } from '../../agent/message-list';
import { SpanType } from '../../observability';
import { RequestContext } from '../../request-context';
import type { CompositeFilesystem } from '../../workspace/filesystem/composite-filesystem';
import type { AnyWorkspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

export const WORKSPACE_REQUIRED_FOR_ATTACHMENT = 'WORKSPACE_REQUIRED_FOR_ATTACHMENT';
export const ATTACHMENT_NOT_INLINE = 'ATTACHMENT_NOT_INLINE';
export const ATTACHMENT_INVALID_DATA = 'ATTACHMENT_INVALID_DATA';

const UNSUPPORTED_TYPES_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};
const UNSUPPORTED_MEDIA_TYPES = new Set(Object.values(UNSUPPORTED_TYPES_BY_EXTENSION));
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface WorkspaceAttachmentsProcessorOptions {
  /** Workspace used by the current run. When absent, spreadsheet attachments abort the run. */
  workspace?: AnyWorkspace;
}

export interface WorkspaceAttachmentsTripwireMetadata {
  code: string;
  mediaType?: string;
}

/** Media type of an attachment the model can't read, detected by MIME type or else by extension. */
function unsupportedMediaType(mediaType: unknown, filename: unknown): string | undefined {
  const type = typeof mediaType === 'string' ? mediaType.toLowerCase() : undefined;
  if (type && UNSUPPORTED_MEDIA_TYPES.has(type)) return type;
  if (typeof filename !== 'string') return undefined;
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return extension ? UNSUPPORTED_TYPES_BY_EXTENSION[extension] : undefined;
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
  return cleaned || 'attachment.xlsx';
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
function findUnsupportedAttachments(messages: MastraDBMessage[]): UnsupportedAttachment[] {
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
      const mediaType = unsupportedMediaType(file.mimeType ?? file.mediaType, file.filename);
      if (!mediaType) return;

      const data = file.data ?? file.url;
      fromParts.add(data);
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
      const mediaType = unsupportedMediaType(attachment.contentType, attachment.name);
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
): Promise<UploadTarget | undefined> {
  if (!workspace) return undefined;

  const filesystem = workspace.resolveFilesystem
    ? await workspace.resolveFilesystem({ requestContext })
    : workspace.filesystem;

  if (filesystem) {
    const write = (path: string, content: Uint8Array) => filesystem.writeFile(path, content);
    const remove = (path: string) => filesystem.deleteFile(path, { force: true });

    if (isCompositeFilesystem(filesystem)) {
      const writableMount = [...filesystem.mounts].find(([, fs]) => !fs.readOnly);
      if (!writableMount) return undefined;
      return { directory: `${writableMount[0].replace(/\/$/, '')}/uploads`, write, remove };
    }
    return filesystem.readOnly ? undefined : { directory: 'uploads', write, remove };
  }

  const sandbox = workspace.resolveSandbox ? await workspace.resolveSandbox({ requestContext }) : workspace.sandbox;
  if (!sandbox?.writeFiles) return undefined;
  return {
    directory: 'uploads',
    write: (path, content) => sandbox.writeFiles!([{ path, content: Buffer.from(content) }]),
  };
}

/** Writes every file, or none: if one write fails, files already written are deleted. */
async function uploadAll(target: UploadTarget, files: { filename?: string; bytes: Uint8Array }[]) {
  const paths: string[] = [];
  try {
    for (const file of files) {
      const path = `${target.directory}/${crypto.randomUUID()}/${sanitizeFilename(file.filename)}`;
      await target.write(path, file.bytes);
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

  private readonly _workspace?: AnyWorkspace;

  constructor(opts: WorkspaceAttachmentsProcessorOptions = {}) {
    this._workspace = opts.workspace;
  }

  async processInputStep({
    messageList,
    requestContext,
    abort,
    tracingContext,
  }: ProcessInputStepArgs<WorkspaceAttachmentsTripwireMetadata>) {
    // 1. Find attachments the model can't read.
    const attachments = findUnsupportedAttachments(messageList.get.all.db());
    if (!attachments.length) return { messageList };

    // 2. Turn each attachment's transport encoding (base64 / data URL) back into its original bytes.
    const files = attachments.map(attachment => {
      const bytes = decodeData(attachment.data);
      if (bytes === ATTACHMENT_NOT_INLINE) {
        return abort('Spreadsheet attachments must be sent inline (base64 or data URL)', {
          metadata: { code: ATTACHMENT_NOT_INLINE, mediaType: attachment.mediaType },
        });
      }
      if (bytes === ATTACHMENT_INVALID_DATA) {
        return abort('Spreadsheet attachment data is not valid base64', {
          metadata: { code: ATTACHMENT_INVALID_DATA, mediaType: attachment.mediaType },
        });
      }
      return { filename: attachment.filename, bytes };
    });

    // 3. Find a writable place in the workspace, or abort instead of sending the binary to the model.
    const workspace = this._workspace;
    const target = await resolveUploadTarget(workspace, requestContext ?? new RequestContext());
    tracingContext?.currentSpan?.update({
      attributes: { workspaceId: workspace?.id, workspaceName: workspace?.name, success: Boolean(target) },
    });
    if (!target) {
      const mediaType = attachments[0]!.mediaType;
      return abort(
        workspace
          ? `Attachments of type "${mediaType}" require a writable workspace, but this agent's workspace has no writable filesystem or sandbox`
          : `Attachments of type "${mediaType}" are not supported by the model and require a workspace, but none is configured for this agent`,
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
