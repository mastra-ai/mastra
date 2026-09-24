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
  if (typeof data !== 'string') return undefined;
  try {
    return new URL(data).toString();
  } catch {
    return undefined;
  }
}

/** URLs of a stored message's file parts and attachments, normalized like the prompt's asset URLs. */
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
