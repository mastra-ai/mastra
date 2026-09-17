import { ListFilterIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { FilterBarChip } from './filter-bar-chip';
import { FilterBarClear } from './filter-bar-clear';
import { FilterBarProvider, useFilterBarContext } from './filter-bar-context';
import { FilterBarInput } from './filter-bar-input';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from './types';
import { inputFocusBorderWithin, inputHoverBorderWithin } from '@/ds/primitives/form-element';
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
        // Same surface/hover/focus recipe as InputGroup (wrapper whose focus lives on the nested input).
        // Single-line height matches a md control (28px): 24px chips/input + 1px padding + 1px
        // border. Uniform p-px keeps chips concentric; rounded-2xl clamps to a pill on one line.
        'flex min-h-form-md w-full flex-wrap items-center gap-0.5 rounded-2xl border border-border1 bg-surface-overlay-soft p-px',
        'cursor-text transition-all duration-normal ease-out-custom',
        'hover:bg-surface-overlay-strong',
        inputHoverBorderWithin,
        'outline-hidden focus-within:bg-surface-overlay-strong focus-within:outline-hidden',
        inputFocusBorderWithin,
        className,
      )}
      onClick={ctx.focusInput}
    >
      <ListFilterIcon aria-hidden className="text-neutral3 mr-1 ml-1.5 size-3 shrink-0" />
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
