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
  'aria-label'?: string;
  className?: string;
  children: ReactNode;
};

function FilterBarSurface({ className, children }: { className?: string; children: ReactNode }) {
  const ctx = useFilterBarContext();
  return (
    <div
      role="group"
      aria-label={ctx.ariaLabel}
      data-slot="filter-bar"
      className={cn(
        'flex min-h-form-md w-full flex-wrap items-center gap-1 rounded-xl border border-border1 bg-surface2 px-2 py-1',
        'cursor-text transition-colors focus-within:border-border2',
        className,
      )}
      onClick={ctx.focusInput}
    >
      {children}
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
 *   <FilterBar.Clear />
 * </FilterBar>
 */
export function FilterBar({
  fields,
  operators,
  value,
  onValueChange,
  'aria-label': ariaLabel = 'Filters',
  className,
  children,
}: FilterBarProps) {
  return (
    <FilterBarProvider
      fields={fields}
      operators={operators}
      value={value}
      onValueChange={onValueChange}
      ariaLabel={ariaLabel}
    >
      <FilterBarSurface className={className}>{children}</FilterBarSurface>
    </FilterBarProvider>
  );
}

/** Default layout: one editable chip per item, in order. */
export function FilterBarChips() {
  const ctx = useFilterBarContext();
  return (
    <>
      {ctx.items.map(item => (
        <FilterBarChip key={item.id} item={item} />
      ))}
    </>
  );
}

FilterBar.Chips = FilterBarChips;
FilterBar.Chip = FilterBarChip;
FilterBar.Input = FilterBarInput;
FilterBar.Clear = FilterBarClear;
