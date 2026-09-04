import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerAttachments } from '@mastra/playground-ui/components/Composer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { PendingImage } from './useComposerImages';

export interface ComposerSuggestionItem {
  id: string;
  label: string;
  description?: string;
  active?: boolean;
}

export function ComposerSuggestions({
  items,
  activeIndex,
  contextLabel,
  onBack,
  onSelect,
}: {
  items: ComposerSuggestionItem[];
  activeIndex: number;
  contextLabel?: string;
  onBack?: () => void;
  onSelect: (index: number) => void;
}) {
  const open = items.length > 0;
  const retainedItemsRef = useRef(items);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const displayedItems = open ? items : retainedItemsRef.current;
  const activeItemId = displayedItems[activeIndex]?.id;

  useEffect(() => {
    if (open) retainedItemsRef.current = items;
  }, [items, open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, activeItemId, open]);

  return (
    <div
      inert={!open}
      role="region"
      aria-label={contextLabel ? `${contextLabel} options` : 'Slash commands'}
      aria-hidden={!open}
      className={cn(
        "after:bg-border1/60 relative grid overflow-hidden transition-[grid-template-rows,opacity] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:content-[''] ease-out-custom motion-reduce:transition-none",
        open ? 'grid-rows-[1fr] opacity-100 duration-slow' : 'grid-rows-[0fr] opacity-0 duration-normal',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {contextLabel && onBack && (
          <div className="border-border1/60 border-b px-1.5 py-1">
            <button
              type="button"
              className="text-icon3 hover:bg-neutral6/5 hover:text-icon6 text-ui-sm flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition-colors duration-150 ease-out motion-reduce:transition-none"
              aria-label="Back to slash commands"
              onMouseDown={event => {
                event.preventDefault();
                onBack();
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>{contextLabel}</span>
            </button>
          </div>
        )}
        <ScrollArea maxHeight="min(22rem, 50dvh)" viewPortClassName="overscroll-contain">
          <div className="flex flex-col gap-px p-1.5">
            {displayedItems.map((item, index) => (
              <button
                ref={element => {
                  optionRefs.current[index] = element;
                }}
                key={item.id}
                type="button"
                aria-current={item.active ? 'true' : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-2 py-1.5 text-left text-ui-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                  index === activeIndex
                    ? 'bg-neutral6/5 text-icon6'
                    : 'text-icon3 hover:bg-neutral6/5 hover:text-icon6',
                )}
                onMouseDown={event => {
                  event.preventDefault();
                  onSelect(index);
                }}
              >
                <span className="shrink-0">{item.label}</span>
                {(item.description || item.active) && (
                  <span className="flex min-w-0 items-center gap-1.5 text-right">
                    {item.description && <span className="truncate">{item.description}</span>}
                    {item.active && (
                      <span className="flex shrink-0 items-center gap-1">
                        <Check size={13} aria-hidden="true" />
                        Current
                      </span>
                    )}
                  </span>
                )}
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
