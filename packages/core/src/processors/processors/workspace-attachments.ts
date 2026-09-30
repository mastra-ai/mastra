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

import { SpanType } from '../../observability';
import { RequestContext } from '../../request-context';
import type { CompositeFilesystem } from '../../workspace/filesystem/composite-filesystem';
import type { AnyWorkspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

export const WORKSPACE_REQUIRED_FOR_ATTACHMENT = 'WORKSPACE_REQUIRED_FOR_ATTACHMENT';
export const ATTACHMENT_NOT_INLINE = 'ATTACHMENT_NOT_INLINE';
export const ATTACHMENT_INVALID_DATA = 'ATTACHMENT_INVALID_DATA';

const ROUTED_TYPES_BY_EXTENSION: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};
const ROUTED_MEDIA_TYPES = new Set(Object.values(ROUTED_TYPES_BY_EXTENSION));
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface WorkspaceAttachmentsProcessorOptions {
  /** Workspace used by the current run. When absent, spreadsheet attachments abort the run. */
  workspace?: AnyWorkspace;
}

export interface WorkspaceAttachmentsTripwireMetadata {
  code: string;
  mediaType?: string;
}

type Candidate = { mediaType: string; filename?: string; data: unknown };
type Pending = Candidate & { replace: (text: string) => void };

function routedMediaType(mediaType: unknown, filename: unknown): string | undefined {
  const type = typeof mediaType === 'string' ? mediaType.toLowerCase() : undefined;
  if (type && ROUTED_MEDIA_TYPES.has(type)) return type;
  if (typeof filename !== 'string') return undefined;
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return extension ? ROUTED_TYPES_BY_EXTENSION[extension] : undefined;
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

/** Returns bytes, or an error code when data isn't valid inline content. */
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
    const pending: Pending[] = [];
    for (const message of messageList.get.all.db()) {
      if (
        (message.role !== 'user' && message.role !== 'signal') ||
        !message.content ||
        typeof message.content !== 'object'
      )
        continue;

      const content = message.content;
      const parts = Array.isArray(content.parts) ? content.parts : [];
      const routedFileData = new Set<unknown>();
      parts.forEach((part, index) => {
        if (part?.type !== 'file') return;
        const p = part as {
          mimeType?: unknown;
          mediaType?: unknown;
          filename?: unknown;
          data?: unknown;
          url?: unknown;
        };
        const mediaType = routedMediaType(p.mimeType ?? p.mediaType, p.filename);
        if (!mediaType) return;
        routedFileData.add(p.data ?? p.url);
        pending.push({
          mediaType,
          filename: typeof p.filename === 'string' ? p.filename : undefined,
          data: p.data ?? p.url,
          replace: text => {
            parts[index] = { type: 'text', text };
            // MessageList mirrors file parts into experimental_attachments; drop the mirrored binary too.
            content.experimental_attachments = content.experimental_attachments?.filter(
              a => a.url !== (p.data ?? p.url),
            );
            if (!content.experimental_attachments?.length) delete content.experimental_attachments;
          },
        });
      });
      const attachments = content.experimental_attachments ?? [];
      attachments.forEach(attachment => {
        const mediaType = routedMediaType(attachment.contentType, attachment.name);
        if (!mediaType || routedFileData.has(attachment.url)) return;
        pending.push({
          mediaType,
          filename: attachment.name,
          data: attachment.url,
          replace: text => {
            content.experimental_attachments = content.experimental_attachments?.filter(a => a !== attachment);
            if (!content.experimental_attachments?.length) delete content.experimental_attachments;
            content.parts.push({ type: 'text', text });
          },
        });
      });
    }
    if (!pending.length) return { messageList };

    const first = pending[0]!;
    const decoded = pending.map(candidate => {
      const bytes = decodeData(candidate.data);
      if (bytes === ATTACHMENT_NOT_INLINE) {
        return abort('Spreadsheet attachments must be sent inline (base64 or data URL)', {
          metadata: { code: ATTACHMENT_NOT_INLINE, mediaType: candidate.mediaType },
        });
      }
      if (bytes === ATTACHMENT_INVALID_DATA) {
        return abort('Spreadsheet attachment data is not valid base64', {
          metadata: { code: ATTACHMENT_INVALID_DATA, mediaType: candidate.mediaType },
        });
      }
      return bytes;
    });

    const workspace = this._workspace;
    const ctx = requestContext ?? new RequestContext();
    const filesystem = workspace?.resolveFilesystem
      ? await workspace.resolveFilesystem({ requestContext: ctx })
      : workspace?.filesystem;
    const sandbox = filesystem
      ? undefined
      : workspace?.resolveSandbox
        ? await workspace.resolveSandbox({ requestContext: ctx })
        : workspace?.sandbox;

    let write: ((path: string, content: Uint8Array) => Promise<unknown>) | undefined;
    let remove: ((path: string) => Promise<unknown>) | undefined;
    let uploadDirectory = 'uploads';
    if (filesystem) {
      if (isCompositeFilesystem(filesystem)) {
        const mount = [...filesystem.mounts].find(([, fs]) => !fs.readOnly);
        if (mount) uploadDirectory = `${mount[0].replace(/\/$/, '')}/uploads`;
        if (mount) write = (path, content) => filesystem.writeFile(path, content);
      } else if (!filesystem.readOnly) {
        write = (path, content) => filesystem.writeFile(path, content);
      }
      if (write) remove = path => filesystem.deleteFile(path, { force: true });
    }
    if (!write && !filesystem && sandbox?.writeFiles) {
      write = (path, content) => sandbox.writeFiles!([{ path, content: Buffer.from(content) }]);
    }

    tracingContext?.currentSpan?.update({
      attributes: { workspaceId: workspace?.id, workspaceName: workspace?.name, success: Boolean(write) },
    });

    if (!write) {
      return abort(
        workspace
          ? `Attachments of type "${first.mediaType}" require a writable workspace, but this agent's workspace has no writable filesystem or sandbox`
          : `Attachments of type "${first.mediaType}" are not supported by the model and require a workspace, but none is configured for this agent`,
        { metadata: { code: WORKSPACE_REQUIRED_FOR_ATTACHMENT, mediaType: first.mediaType } },
      );
    }

    const written: string[] = [];
    const notes: string[] = [];
    try {
      for (const [index, candidate] of pending.entries()) {
        const name = sanitizeFilename(candidate.filename);
        const path = `${uploadDirectory}/${crypto.randomUUID()}/${name}`;
        await write(path, decoded[index]!);
        written.push(path);
        notes.push(formatWorkspaceAttachmentNote(name, candidate.mediaType, path));
      }
    } catch (error) {
      if (remove) await Promise.allSettled(written.map(path => remove(path)));
      throw error;
    }

    pending.forEach((candidate, index) => candidate.replace(notes[index]!));
    return { messageList };
  }
}
