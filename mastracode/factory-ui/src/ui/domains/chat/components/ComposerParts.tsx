import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerAttachments } from '@mastra/playground-ui/components/Composer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

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
  const open = suggestions.length > 0;
  const retainedSuggestionsRef = useRef(suggestions);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const displayedSuggestions = open ? suggestions : retainedSuggestionsRef.current;
  const activeCommandName = displayedSuggestions[activeIndex]?.name;

  useEffect(() => {
    if (open) retainedSuggestionsRef.current = suggestions;
  }, [open, suggestions]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeCommandName, activeIndex, open]);

  return (
    <div
      inert={!open}
      role="region"
      aria-label="Slash commands"
      aria-hidden={!open}
      className={cn(
        "after:bg-border1/60 relative grid overflow-hidden transition-[grid-template-rows,opacity] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:content-[''] ease-out-custom motion-reduce:transition-none",
        open ? 'grid-rows-[1fr] opacity-100 duration-slow' : 'grid-rows-[0fr] opacity-0 duration-normal',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <ScrollArea maxHeight="min(22rem, 50dvh)" viewPortClassName="overscroll-contain">
          <div className="flex flex-col gap-px p-1.5">
            {displayedSuggestions.map((command, index) => (
              <button
                ref={element => {
                  optionRefs.current[index] = element;
                }}
                key={command.name}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-2 py-1.5 text-left text-ui-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                  index === activeIndex ? 'bg-surface4 text-icon6' : 'text-icon3 hover:bg-surface4 hover:text-icon6',
                )}
                onMouseDown={event => {
                  event.preventDefault();
                  onSelect(command.name);
                }}
              >
                <span className="shrink-0">/{command.name}</span>
                <span className="min-w-0 truncate text-right">{command.description}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
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
