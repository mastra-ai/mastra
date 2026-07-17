import { isBrowserFetchableUrl, isNonFetchableRemoteUrl } from '@mastra/playground-ui/utils/file';
import type { FilePart } from '@mastra/react';

import { InMessageAttachment } from './in-message-attachment';

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
  const fileLabel = isFetchableUrl || isNonFetchableUrl ? src : undefined;
  const isImage = typeof mimeType === 'string' && mimeType.startsWith('image/');
  const isVideo = typeof mimeType === 'string' && mimeType.startsWith('video/');
  const isAudio = typeof mimeType === 'string' && mimeType.startsWith('audio/');

  // Cloud-storage URIs (gs://, s3://) and audio/video can't be previewed
  // in-browser — show a labeled chip instead of a broken image/preview.
  if (isNonFetchableUrl || isVideo || isAudio) {
    return (
      <InMessageAttachment type="file" contentType={mimeType} name={fileLabel} src={isFetchableUrl ? src : undefined} />
    );
  }

  if (isImage) {
    return <InMessageAttachment type="image" src={src} />;
  }

  return (
    <InMessageAttachment type="document" contentType={mimeType} src={isFetchableUrl ? data : undefined} data={src} />
  );
};
