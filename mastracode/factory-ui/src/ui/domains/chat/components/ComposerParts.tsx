import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerAttachments } from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';

import type { SlashCommand } from '../services/commands';
import type { PendingImage } from './useComposerImages';

export function ComposerSuggestions({
  suggestions,
  activeIndex,
  onSelect,
}: {
  suggestions: SlashCommand[];
  activeIndex: number;
  onSelect: (name: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="border-border1 bg-surface3 absolute right-0 bottom-full left-0 z-20 mx-auto mb-2 w-full max-w-3xl rounded-md border p-1 shadow-lg">
      {suggestions.map((command, index) => (
        <button
          key={command.name}
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ui-sm',
            index === activeIndex ? 'bg-surface4 text-icon6' : 'text-icon3',
          )}
          onMouseDown={event => {
            event.preventDefault();
            onSelect(command.name);
          }}
        >
          <span>/{command.name}</span>
          <span>{command.description}</span>
        </button>
      ))}
    </div>
  );
}

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
