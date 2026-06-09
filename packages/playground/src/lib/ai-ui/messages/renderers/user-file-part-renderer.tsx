import type { FilePart } from '@mastra/react';

import { InMessageAttachment } from './in-message-attachment';

export interface UserFilePartRendererProps {
  part: FilePart;
}

/**
 * Renders a user `MessageFactory` `File` slot. Image parts render an inline image
 * preview; everything else renders a document preview using the URL when the data
 * is an `https://` link, otherwise the raw data.
 */
export const UserFilePartRenderer = ({ part }: UserFilePartRendererProps) => {
  // The declared `FilePart` type is V4-shaped (`{ mimeType, data }`), but the
  // `@mastra/react` streaming accumulator emits the V5 shape (`{ mediaType, url }`)
  // at runtime. Read both, preferring the V5/streaming shape and falling back to
  // the V4/reload shape, so streamed and reloaded messages render identically.
  const fileType = part as FilePart & { mediaType?: string; url?: string };
  const data = fileType.url ?? fileType.data;
  const mimeType = fileType.mediaType ?? fileType.mimeType;
  const isUrl = typeof data === 'string' && data.startsWith('https://');
  const isImage = typeof mimeType === 'string' && mimeType.startsWith('image/');

  if (isImage) {
    return <InMessageAttachment type="image" src={typeof data === 'string' ? data : undefined} />;
  }

  return (
    <InMessageAttachment
      type="document"
      contentType={mimeType}
      src={isUrl ? data : undefined}
      data={typeof data === 'string' ? data : undefined}
    />
  );
};
