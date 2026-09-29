import { randomUUID } from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';

export const WORKSPACE_REQUIRED_ERROR_CODE = 'WORKSPACE_REQUIRED_FOR_ATTACHMENT';

const WORKSPACE_ROUTED_MEDIA_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const WORKSPACE_ROUTED_EXTENSIONS = ['.xlsx', '.xls'];

type Part = { type?: unknown; mediaType?: unknown; mimeType?: unknown; filename?: unknown };

function isWorkspaceRoutedPart(part: unknown): part is Part {
  if (!part || typeof part !== 'object' || (part as Part).type !== 'file') return false;
  const { mediaType, mimeType, filename } = part as Part;
  const type = typeof mediaType === 'string' ? mediaType : typeof mimeType === 'string' ? mimeType : undefined;
  if (type && WORKSPACE_ROUTED_MEDIA_TYPES.has(type.toLowerCase())) return true;
  return typeof filename === 'string' && WORKSPACE_ROUTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

function contentOf(message: unknown): unknown[] | undefined {
  const content = message && typeof message === 'object' ? (message as { content?: unknown }).content : undefined;
  return Array.isArray(content) ? content : undefined;
}

function mediaTypeOf(part: Part): string {
  const type = typeof part.mediaType === 'string' ? part.mediaType : part.mimeType;
  return typeof type === 'string' ? type : 'application/octet-stream';
}

function workspaceRequiredError(mediaType: string): HTTPException {
  const message = `Attachments of type "${mediaType}" are not supported by the model and require a workspace, but none is configured for this agent`;
  const res = new Response(JSON.stringify({ error: message, code: WORKSPACE_REQUIRED_ERROR_CODE, mediaType }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
  return new HTTPException(403, { res, message, cause: { code: WORKSPACE_REQUIRED_ERROR_CODE, mediaType } });
}

export async function routeAttachmentsToWorkspace<T>({
  agent,
  messages,
  requestContext,
}: {
  agent: Agent<any, any, any>;
  messages: T;
  requestContext: RequestContext;
}): Promise<T> {
  const list: unknown[] = Array.isArray(messages) ? messages : [messages];
  const firstRouted = list.flatMap(message => contentOf(message) ?? []).find(isWorkspaceRoutedPart);
  if (!firstRouted) {
    return messages;
  }

  const workspace = await agent.getWorkspace({ requestContext });
  const filesystem = workspace?.filesystem;
  if (!filesystem) {
    throw workspaceRequiredError(mediaTypeOf(firstRouted));
  }

  const routeMessage = async (message: unknown) => {
    const content = contentOf(message);
    if (!content?.some(isWorkspaceRoutedPart)) return message;
    const routedContent = await Promise.all(
      content.map(async part => {
        if (!isWorkspaceRoutedPart(part)) return part;
        const mediaType = mediaTypeOf(part);
        const name = sanitizeFilename(part.filename);
        const path = `uploads/${randomUUID()}/${name}`;
        await filesystem.writeFile(path, decodeData((part as { data?: unknown }).data));
        return {
          type: 'text',
          text: `[Attachment "${name}" (${mediaType}) was uploaded to the workspace at ${path}. Use workspace tools to read it.]`,
        };
      }),
    );
    return { ...(message as object), content: routedContent };
  };

  if (Array.isArray(messages)) {
    return (await Promise.all(messages.map(routeMessage))) as T;
  }
  return (await routeMessage(messages)) as T;
}

export async function routeSignalContentsToWorkspace<T>({
  agent,
  contents,
  requestContext,
}: {
  agent: Agent<any, any, any>;
  contents: T;
  requestContext: RequestContext;
}): Promise<T> {
  if (!Array.isArray(contents)) return contents;
  const routed = await routeAttachmentsToWorkspace({ agent, messages: { content: contents }, requestContext });
  return routed.content as T;
}

function sanitizeFilename(filename: unknown): string {
  const base = typeof filename === 'string' ? (filename.split(/[\\/]/).pop() ?? '') : '';
  const cleaned = base
    .replace(/\.\.+/g, '.')
    .replace(/^\.+/, '')
    .replace(/[\x00-\x1f]/g, '');
  return cleaned || 'attachment.xlsx';
}

function decodeData(data: unknown): Buffer {
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  if (typeof data === 'string') {
    const dataUrl = data.match(/^data:[^,]*;base64,(.*)$/s);
    if (dataUrl) return Buffer.from(dataUrl[1]!, 'base64');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(data)) {
      throw new HTTPException(400, { message: 'Spreadsheet attachments must be sent inline (base64 or data URL)' });
    }
    return Buffer.from(data, 'base64');
  }
  throw new HTTPException(400, { message: 'Unsupported attachment data format' });
}
