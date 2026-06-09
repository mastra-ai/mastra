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
  const data = part.data;
  const isUrl = typeof data === 'string' && data.startsWith('https://');
  const isImage = typeof part.mimeType === 'string' && part.mimeType.startsWith('image/');

  if (isImage) {
    return <InMessageAttachment type="image" src={typeof data === 'string' ? data : undefined} />;
  }

  return (
    <InMessageAttachment
      type="document"
      contentType={part.mimeType}
      src={isUrl ? data : undefined}
      data={typeof data === 'string' ? data : undefined}
    />
  );
};
