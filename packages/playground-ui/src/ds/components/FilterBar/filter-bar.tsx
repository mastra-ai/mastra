import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { FilterBarAnimatedChips } from './animation/filter-bar-animated-chips';
import styles from './animation/filter-bar-animation.module.css';
import { FilterBarChip } from './filter-bar-chip';
import { FilterBarClear } from './filter-bar-clear';
import { FilterBarProvider, useFilterBarContext } from './filter-bar-context';
import { FilterBarInput } from './filter-bar-input';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from './types';
import { controlHeight } from '@/ds/primitives/control-size';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type FilterBarProps = {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  value: FilterBarItem[];
  onValueChange: (items: FilterBarItem[]) => void;
  'aria-label'?: string;
  clearLabel?: string;
  variant?: 'input' | 'button';
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
  const isButton = ctx.variant === 'button';
  const registerClear = useCallback(
    (element: HTMLSpanElement | null) => ctx.animation.register('clear', element),
    [ctx.animation],
  );
  return (
    <div
      ref={ctx.animation.rootRef}
      role="group"
      aria-label={ctx.ariaLabel}
      data-slot="filter-bar"
      data-variant={ctx.variant}
      className={cn(
        'relative flex w-full min-w-0 flex-wrap content-start items-center gap-1 overflow-x-clip',
        styles.surface,
        className,
      )}
    >
      <div data-slot="filter-bar-list" className="contents">
        {children}
      </div>
      {!isButton && (
        <span ref={registerClear} className={cn(controlHeight.md, 'flex shrink-0 items-center empty:hidden')}>
          <FilterBarClear label={clearLabel} />
        </span>
      )}
      <div
        ref={ctx.animation.exitLayerRef}
        inert
        aria-hidden
        className={cn('pointer-events-none absolute inset-0', styles.exitLayer)}
      />
      <VisuallyHidden aria-live="polite">{ctx.announcement}</VisuallyHidden>
    </div>
  );
}

export function FilterBar({
  fields,
  operators,
  value,
  onValueChange,
  'aria-label': ariaLabel = 'Filters',
  clearLabel = 'Clear filters',
  variant = 'input',
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
      variant={variant}
    >
      <FilterBarSurface className={className} clearLabel={clearLabel}>
        {children}
      </FilterBarSurface>
    </FilterBarProvider>
  );
}

export function FilterBarChips() {
  return <FilterBarAnimatedChips />;
}

FilterBar.Chips = FilterBarChips;
FilterBar.Chip = FilterBarChip;
FilterBar.Input = FilterBarInput;
