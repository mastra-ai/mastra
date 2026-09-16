import { ImageEntry } from '@mastra/playground-ui/domains/chat/attachments/attachment-preview-dialog';
import { ComposerAttachment } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment-list';

import type { PendingImage } from './useComposerImages';

export function ComposerImageAttachments({
  images,
  onRemove,
}: {
  images: PendingImage[];
  onRemove: (id: string) => void;
}) {
  if (images.length === 0) return null;

  return (
    <ComposerAttachmentList>
      {images.map(image => (
        <ComposerAttachment key={image.id} name={image.filename ?? 'image'} onRemove={() => onRemove(image.id)}>
          <ImageEntry src={`data:${image.mediaType};base64,${image.data}`} name={image.filename} />
        </ComposerAttachment>
      ))}
    </ComposerAttachmentList>
  );
}
