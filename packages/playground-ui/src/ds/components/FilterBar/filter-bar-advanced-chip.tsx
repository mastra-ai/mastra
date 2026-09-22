import { BracesIcon, XIcon } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { chipClass, editableSegmentClass } from './filter-bar-chip';
import { FILTER_BAR_SCOPE_ATTR, useFilterBarContext } from './filter-bar-context';
import { FilterBarGroupEditor } from './filter-bar-group-editor';
import { countLeaves } from './filter-bar-tree';
import type { FilterBarGroup } from './types';
import { useSettleOnLeave } from './use-settle-on-leave';
import { Button } from '@/ds/components/Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { cn } from '@/lib/utils';

export type FilterBarAdvancedChipProps = {
  group: FilterBarGroup;
  className?: string;
};

/**
 * A root-level group rendered as one "Advanced filter" chip. Its popover hosts the
 * recursive rule builder; the chip's remove button drops the whole subtree.
 */
export function FilterBarAdvancedChip({ group, className }: FilterBarAdvancedChipProps) {
  const ctx = useFilterBarContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const leaving = ctx.leaving.has(group.id);
  const open = ctx.openGroupId === group.id;
  const count = countLeaves(group);
  // Position in the flattened item list: navigation from the chip continues from its first leaf.
  const firstLeafIndex = ctx.items.findIndex(item => isUnder(group, item.id));
  const index = firstLeafIndex === -1 ? ctx.items.length : firstLeafIndex;
  useSettleOnLeave(group.id, leaving, rootRef);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (leaving) return;
    const segments = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-filter-bar-segment]') ?? []);
    const current = segments.findIndex(el => el === event.target);
    if (current === -1) return;
    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        const next = segments[current + 1];
        if (next) next.focus();
        else if (!ctx.focusChip(index + count, 1, 'field')) ctx.focusInput();
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const prev = segments[current - 1];
        if (prev) prev.focus();
        else ctx.focusChip(index - 1, -1, 'remove');
        return;
      }
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        remove();
        return;
      default:
    }
  };

  const remove = () => {
    ctx.removeGroup(group.id);
    ctx.focusAfterRemove(index);
  };

  return (
    <Popover open={open} onOpenChange={next => ctx.setOpenGroup(next ? group.id : null)}>
      <div
        ref={rootRef}
        role="group"
        aria-label={`Advanced filter, ${count} ${count === 1 ? 'condition' : 'conditions'}`}
        aria-hidden={leaving || undefined}
        data-slot="filter-bar-advanced"
        data-leaving={leaving || undefined}
        className={cn('filter-bar-advanced', chipClass, leaving && 'pointer-events-none', className)}
        onKeyDown={handleKeyDown}
      >
        <PopoverTrigger
          ref={el => {
            triggerRef.current = el;
            ctx.registerSegment(group.id, 'field', leaving ? null : el);
          }}
          render={<button type="button" />}
          data-filter-bar-segment="field"
          className={cn(editableSegmentClass, 'gap-1.5')}
          title="Edit advanced filter"
        >
          <BracesIcon className="size-[1.1em] shrink-0" aria-hidden />
          <span className="truncate">Advanced filter</span>
          {count > 0 && (
            <span className="text-column text-muted-foreground" aria-hidden>
              {count}
            </span>
          )}
        </PopoverTrigger>
        {leaving ? (
          <span aria-hidden className={cn(editableSegmentClass, 'px-1.5')}>
            <XIcon className="size-[1.1em]" />
          </span>
        ) : (
          <button
            type="button"
            ref={el => ctx.registerSegment(group.id, 'remove', el)}
            data-filter-bar-segment="remove"
            aria-label="Remove advanced filter"
            title="Remove advanced filter"
            className={cn(editableSegmentClass, 'px-1.5')}
            onClick={remove}
          >
            <XIcon className="size-[1.1em]" />
          </button>
        )}
      </div>
      <PopoverContent
        align="start"
        className="w-auto max-w-[min(90vw,40rem)] min-w-96 p-0"
        {...{ [FILTER_BAR_SCOPE_ATTR]: 'advanced' }}
        finalFocus={triggerRef}
      >
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <BracesIcon className="text-muted-foreground size-3.5" />
          <span className="text-label text-foreground">Advanced filter</span>
          <span className="bg-fill-subtle text-column text-muted-foreground rounded-md px-1.5">{count}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            tooltip="Close"
            onClick={() => ctx.setOpenGroup(null)}
          >
            <XIcon />
          </Button>
        </div>
        <FilterBarGroupEditor
          group={group}
          depth={1}
          removeLabel="Remove advanced filter"
          onRemove={() => {
            ctx.setOpenGroup(null);
            remove();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

const isUnder = (group: FilterBarGroup, itemId: string): boolean =>
  group.nodes.some(node => (node.id === itemId ? true : 'kind' in node && isUnder(node, itemId)));
