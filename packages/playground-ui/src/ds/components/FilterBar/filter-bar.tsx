import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { FilterBarChip } from './filter-bar-chip';
import { FilterBarClear } from './filter-bar-clear';
import { FilterBarProvider, useFilterBarContext } from './filter-bar-context';
import { FilterBarInput } from './filter-bar-input';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from './types';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type FilterBarProps = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  value: FilterBarItem[];
  onValueChange: (items: FilterBarItem[]) => void;
  /**
   * Id given to a newly added item. Defaults to a random id. Consumers that rebuild `value` from
   * their own store (URL, query params…) should return the id they will rebuild it with, so the
   * draft chip and the committed chip are the same element.
   */
  createItemId?: (fieldId: string) => string;
  'aria-label'?: string;
  /** Accessible label of the trailing "remove every filter" button. */
  clearLabel?: string;
  className?: string;
  children: ReactNode;
};

function FilterBarSurface({
  className,
  clearLabel,
  children,
}: {
  className?: string;
  clearLabel: string;
  children: ReactNode;
}) {
  const ctx = useFilterBarContext();
  return (
    <div
      role="group"
      aria-label={ctx.ariaLabel}
      data-slot="filter-bar"
      className={cn(
        // No chrome of its own: chips and the typeahead input sit directly on the parent surface.
        // Layout: wrapping chip list | Clear. Clear stays pinned to the first line; only the
        // list wraps.
        'flex w-full items-start gap-1',
        className,
      )}
      onClick={ctx.focusInput}
    >
      <div data-slot="filter-bar-list" className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {children}
      </div>
      <span className="flex shrink-0 items-center empty:hidden">
        <FilterBarClear label={clearLabel} />
      </span>
      <VisuallyHidden aria-live="polite">{ctx.announcement}</VisuallyHidden>
    </div>
  );
}

/**
 * Braintrust-style filter bar: `field → operator → value` filters built from a
 * single typeahead input, rendered as inline editable chips. Domain-agnostic —
 * fields, operators and values are plain strings supplied by the consumer.
 *
 * @example
 * <FilterBar value={items} onValueChange={setItems} fields={fields} operators={DEFAULT_FILTER_OPERATORS}>
 *   <FilterBar.Chips />
 *   <FilterBar.Input />
 * </FilterBar>
 */
export function FilterBar({
  fields,
  operators,
  value,
  onValueChange,
  createItemId,
  'aria-label': ariaLabel = 'Filters',
  clearLabel = 'Clear filters',
  className,
  children,
}: FilterBarProps) {
  return (
    <FilterBarProvider
      fields={fields}
      operators={operators}
      value={value}
      onValueChange={onValueChange}
      createItemId={createItemId}
      ariaLabel={ariaLabel}
    >
      <FilterBarSurface className={className} clearLabel={clearLabel}>
        {children}
      </FilterBarSurface>
    </FilterBarProvider>
  );
}

/**
 * Default layout: one editable chip per item, in order, then the chip of the filter
 * being built in the input (which becomes the last item's chip once committed).
 */
export function FilterBarChips({ renderChip = defaultRenderChip }: FilterBarChipsProps) {
  const ctx = useFilterBarContext();
  // One keyed array: the draft chip and the item it becomes share a key, so React
  // keeps the element across the commit instead of mounting a new chip.
  const chips = ctx.items.map(item => <Fragment key={item.id}>{renderChip(item)}</Fragment>);
  if (ctx.draft) {
    // `FilterBarChip` needs a full item; the draft's missing parts are blank until picked.
    const { id, fieldId, operatorId = '' } = ctx.draft;
    chips.push(
      <Fragment key={id}>
        <FilterBarChip draft item={{ id, fieldId, operatorId, value: '' }} />
      </Fragment>,
    );
  }
  return <>{chips}</>;
}

export type FilterBarChipsProps = {
  /**
   * Chip for an item; return `null` to render none (e.g. an item only held in the
   * value for scoping). Defaults to a plain editable `FilterBar.Chip`.
   */
  renderChip?: (item: FilterBarItem) => ReactNode;
};

const defaultRenderChip = (item: FilterBarItem) => <FilterBarChip item={item} />;

FilterBar.Chips = FilterBarChips;
FilterBar.Chip = FilterBarChip;
FilterBar.Input = FilterBarInput;
