import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerAttachments } from '@mastra/playground-ui/components/Composer';
import { X } from 'lucide-react';

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
    <ComposerAttachments className="mx-3 mt-3 flex max-w-none justify-start gap-2 pb-0">
      {images.map(image => (
        <div key={image.id} className="relative">
          <img
            src={`data:${image.mediaType};base64,${image.data}`}
            alt={image.filename ?? 'Attached image'}
            className="border-border1 h-14 w-14 rounded-md border object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={() => onRemove(image.id)}
            className="bg-surface3 absolute -top-1 -right-1 rounded-full"
            aria-label="Remove image"
          >
            <X size={10} />
          </Button>
        </div>
      ))}
    </ComposerAttachments>
  );
}
