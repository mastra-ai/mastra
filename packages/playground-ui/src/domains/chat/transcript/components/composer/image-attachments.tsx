import { useState } from 'react';
import type { PendingImage } from './types';
import { ImageEntry } from '@/domains/chat/attachments/attachment-preview-dialog';
import { ComposerAttachment } from '@/domains/chat/attachments/composer-attachment';

import { ComposerAttachmentList } from '@/domains/chat/attachments/composer-attachment-list';

export function ComposerImageAttachments({
  images,
  onRemove,
}: {
  images: PendingImage[];
  onRemove: (id: string) => void;
}) {
  const [previewId, setPreviewId] = useState<string>();
  if (images.length === 0) return null;

  return (
    <ComposerAttachmentList>
      {images.map(image => (
        <ComposerAttachment
          key={image.id}
          name={image.filename ?? 'image'}
          onRemove={() => onRemove(image.id)}
          onPreview={() => setPreviewId(image.id)}
        >
          <ImageEntry
            src={`data:${image.mediaType};base64,${image.data}`}
            name={image.filename}
            open={previewId === image.id}
            onOpenChange={open => setPreviewId(open ? image.id : undefined)}
          />
        </ComposerAttachment>
      ))}
    </ComposerAttachmentList>
  );
}
