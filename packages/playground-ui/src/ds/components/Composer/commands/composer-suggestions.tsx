import { Collapsible } from '@base-ui/react/collapsible';
import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ScrollArea } from '../../ScrollArea';
import { cn } from '@/lib/utils';

export interface ComposerSuggestionItem {
  id: string;
  label: string;
  description?: string;
  active?: boolean;
}

export interface ComposerSuggestionsProps {
  id: string;
  items: readonly ComposerSuggestionItem[];
  activeIndex: number;
  contextLabel?: string;
  onBack?: () => void;
  onSelect: (index: number) => void;
}

export function ComposerSuggestions({
  id,
  items,
  activeIndex,
  contextLabel,
  onBack,
  onSelect,
}: ComposerSuggestionsProps) {
  const activeOption = useRef<HTMLButtonElement>(null);
  const activeItemId = items[activeIndex]?.id;
  const label = contextLabel ? `${contextLabel} options` : 'Slash commands';

  useEffect(() => {
    activeOption.current?.scrollIntoView({ block: 'nearest' });
  }, [activeItemId]);

  return (
    <Collapsible.Root open={items.length > 0}>
      <Collapsible.Panel className="duration-normal ease-out-custom h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        <div className="border-border1/60 border-b" role="region" aria-label={label}>
          {contextLabel && onBack && (
            <div className="border-border1/60 border-b px-1.5 py-1">
              <button
                type="button"
                className="text-icon3 hover:text-icon6 text-ui-sm duration-normal ease-out-custom hover:bg-neutral6/5 flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition-colors motion-reduce:transition-none"
                aria-label="Back to slash commands"
                onMouseDown={event => event.preventDefault()}
                onClick={onBack}
              >
                <ArrowLeft size={14} aria-hidden />
                <span>{contextLabel}</span>
              </button>
            </div>
          )}
          <ScrollArea maxHeight="min(22rem, 50dvh)" viewPortClassName="overscroll-contain">
            <div id={id} role="listbox" aria-label={label} className="flex flex-col gap-px p-1.5">
              {items.map((item, index) => (
                <button
                  ref={index === activeIndex ? activeOption : undefined}
                  id={item.id}
                  key={item.id}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  aria-current={item.active ? 'true' : undefined}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-2 py-1.5 text-left text-ui-sm transition-colors duration-normal ease-out-custom motion-reduce:transition-none',
                    index === activeIndex
                      ? 'text-icon6 bg-neutral6/5'
                      : 'text-icon3 hover:text-icon6 hover:bg-neutral6/5',
                  )}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onSelect(index)}
                >
                  <span className="max-w-[60%] min-w-0 shrink-0 truncate" title={item.label}>
                    {item.label}
                  </span>
                  {(item.description || item.active) && (
                    <span className="flex min-w-0 items-center gap-1.5 text-right">
                      {item.description && (
                        <span className="truncate" title={item.description}>
                          {item.description}
                        </span>
                      )}
                      {item.active && (
                        <span className="flex shrink-0 items-center gap-1">
                          <Check size={13} aria-hidden />
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
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
