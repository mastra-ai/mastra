import type { MastraDBMessage } from '../state/types';
import { resolveFilePartMediaTypeAndData } from './image-utils';

/**
 * Attachment URLs that could not be downloaded are recorded on their user message under
 * `content.metadata.mastra.unavailableAttachments`, so later turns render the same
 * placeholder without fetching them again. What a thread's history produces then stays
 * stable instead of changing with each URL's availability. Data URLs are not recorded:
 * decoding one is local and deterministic, so a bad one is detected again at no cost.
 */
const METADATA_KEY = 'unavailableAttachments';

export function getUnavailableAttachmentUrls(message: MastraDBMessage): string[] {
  const mastra = message.content.metadata?.mastra;
  if (!mastra || typeof mastra !== 'object') return [];
  const urls = (mastra as Record<string, unknown>)[METADATA_KEY];
  return Array.isArray(urls) ? urls.filter((url): url is string => typeof url === 'string') : [];
}

export function withUnavailableAttachmentUrls(
  metadata: Record<string, unknown> | undefined,
  urls: Iterable<string>,
): Record<string, unknown> {
  const mastra = (metadata?.mastra as Record<string, unknown> | undefined) ?? {};
  const existing = Array.isArray(mastra[METADATA_KEY]) ? (mastra[METADATA_KEY] as string[]) : [];
  return {
    ...metadata,
    mastra: { ...mastra, [METADATA_KEY]: [...new Set([...existing, ...urls])] },
  };
}

function toUrlString(data: unknown): string | undefined {
  if (data instanceof URL) return data.toString();
  // Data URLs are never recorded; skip parsing (and copying) their payloads.
  if (typeof data !== 'string' || data.startsWith('data:')) return undefined;
  try {
    return new URL(data).toString();
  } catch {
    return undefined;
  }
}

export function unavailableAttachmentPlaceholder(name: string): string {
  return `[Attachment unavailable: ${name}]`;
}

/**
 * Returns a copy of a user message with the attachments it recorded as unavailable
 * replaced by a placeholder text part, so they are neither fetched nor sent. The record
 * is per message: another message carrying the same URL is downloaded as usual.
 */
export function withUnavailableAttachmentPlaceholders(message: MastraDBMessage): MastraDBMessage {
  const recorded = new Set(getUnavailableAttachmentUrls(message));
  if (message.role !== 'user' || recorded.size === 0) return message;
  const isRecorded = (data: unknown) => {
    const url = toUrlString(data);
    return url !== undefined && recorded.has(url);
  };
  const placeholder = (name: string) => ({ type: 'text' as const, text: unavailableAttachmentPlaceholder(name) });

  const parts = message.content.parts ?? [];
  const attachments = message.content.experimental_attachments ?? [];
  const replacedUrls = new Set<string>();
  const replacedParts = parts.map(part => {
    if (part.type !== 'file') return part;
    const { mediaType, data } = resolveFilePartMediaTypeAndData(part);
    const url = toUrlString(data);
    if (url === undefined || !recorded.has(url)) return part;
    replacedUrls.add(url);
    return placeholder((part as { filename?: string }).filename || mediaType || 'file');
  });
  // The adapter turns attachments into prompt parts when no file parts are left, so a recorded
  // one has to go as well or it would be fetched from the attachment list instead. An attachment
  // that only repeats a file part's URL is already covered by that part's placeholder.
  const recordedAttachments = attachments.filter(attachment => {
    const url = toUrlString(attachment.url);
    return url !== undefined && recorded.has(url) && !replacedUrls.has(url);
  });
  const droppedAttachments = attachments.filter(attachment => isRecorded(attachment.url));
  if (replacedUrls.size === 0 && droppedAttachments.length === 0) return message;

  // Once parts hold text, the adapter no longer reads `content.content`; keep it.
  const text = message.content.content;
  const contentText =
    typeof text === 'string' && text && !replacedParts.some(part => part.type === 'text')
      ? [{ type: 'text' as const, text }]
      : [];
  return {
    ...message,
    content: {
      ...message.content,
      parts: [
        ...recordedAttachments.map(attachment => placeholder(attachment.name || attachment.contentType || 'unknown')),
        ...contentText,
        ...replacedParts,
      ],
      ...(droppedAttachments.length > 0
        ? { experimental_attachments: attachments.filter(attachment => !isRecorded(attachment.url)) }
        : {}),
    },
  };
}

/**
 * Recordable (non-data) URLs of a stored message's file parts and attachments,
 * normalized like the prompt's asset URLs.
 */
export function getMessageAttachmentUrls(message: MastraDBMessage): string[] {
  const urls: string[] = [];
  for (const part of message.content.parts ?? []) {
    if (part.type !== 'file') continue;
    const url = toUrlString(resolveFilePartMediaTypeAndData(part).data);
    if (url) urls.push(url);
  }
  for (const attachment of message.content.experimental_attachments ?? []) {
    const url = toUrlString(attachment.url);
    if (url) urls.push(url);
  }
  return urls;
}
