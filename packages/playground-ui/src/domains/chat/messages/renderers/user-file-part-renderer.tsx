import type { FilePart } from '@mastra/react';

import { isTextMimeType } from '../../attachments/attachment-kind';
import { InMessageAttachment } from './in-message-attachment';
import { isBrowserFetchableUrl, isNonFetchableRemoteUrl } from '@/lib/file';

const textPreview = (data: string) => {
  if (!data.startsWith('data:')) return data;
  try {
    const base64 = data.match(/^data:[^,]*;base64,(.*)$/s)?.[1];
    if (base64 === undefined) return undefined;
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
};

export interface UserFilePartRendererProps {
  part: FilePart;
}

/**
 * Renders a user `MessageFactory` `File` slot. Image parts render an inline image
 * preview when the source is browser-fetchable; video, audio, and cloud-storage
 * URIs (gs://, s3://) render a placeholder chip; everything else renders a
 * document preview, using the URL when it is an http(s) link, otherwise the raw
 * data.
 */
export const UserFilePartRenderer = ({ part }: UserFilePartRendererProps) => {
  // Both streamed (`@mastra/react` accumulator) and reloaded messages carry the
  // canonical DB shape (`{ mimeType, data }`), so streamed and reloaded messages
  // render identically.
  const { data, mimeType } = part;
  const src = typeof data === 'string' ? data : undefined;
  const isFetchableUrl = typeof data === 'string' && isBrowserFetchableUrl(data);
  const isNonFetchableUrl = typeof data === 'string' && isNonFetchableRemoteUrl(data);
  // Only use the source as the chip label when it is a real URL. Local inlined
  // media is a long `data:...;base64,...` payload that would bloat the chip
  // title/tooltip and DOM attributes.
  const filename = 'filename' in part && typeof part.filename === 'string' ? part.filename : undefined;
  const fileLabel = filename ?? (isFetchableUrl || isNonFetchableUrl ? src : undefined);
  const isImage = typeof mimeType === 'string' && mimeType.startsWith('image/');
  const isText = typeof mimeType === 'string' && isTextMimeType(mimeType);
  const preview = isText && src ? textPreview(src) : src;
  const isDocument = mimeType === 'application/pdf' || (isText && preview !== undefined && !isFetchableUrl);

  // Binary attachments and cloud-storage URIs stay as files, never garbled text previews.
  if (isNonFetchableUrl || (!isImage && !isDocument)) {
    return (
      <InMessageAttachment type="file" contentType={mimeType} name={fileLabel} src={isFetchableUrl ? src : undefined} />
    );
  }

  if (isImage) {
    return <InMessageAttachment type="image" src={src} />;
  }

  return (
    <InMessageAttachment
      type="document"
      contentType={mimeType}
      name={fileLabel}
      src={isFetchableUrl ? src : undefined}
      data={preview}
    />
  );
};
