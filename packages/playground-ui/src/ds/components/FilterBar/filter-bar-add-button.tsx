import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { PlusIcon } from 'lucide-react';
import type { CSSProperties, ReactNode, Ref } from 'react';
import styles from './animation/filter-bar-animation.module.css';
import { FilterBarFieldLabel, fieldSegmentAccentStyle, segmentClass } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import type { FilterBarField, FilterBarOperator } from './types';
import { buttonVariants } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

type FilterBarAddButtonProps = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  selectedValueLabel?: string;
  label: string;
  ref: Ref<HTMLButtonElement>;
  className?: string;
};

export function FilterBarAddButton({
  field,
  operator,
  selectedValueLabel,
  label,
  ref,
  className,
}: FilterBarAddButtonProps) {
  const ctx = useFilterBarContext();
  const isCompact = ctx.items.length > 0 && !field;

  return (
    <ComboboxPrimitive.Trigger
      ref={ref}
      role="button"
      aria-label={label}
      data-slot="filter-bar-add-button"
      data-compact={isCompact || undefined}
      className={cn(
        'relative inline-flex h-form-md max-w-full shrink-0 cursor-pointer rounded-lg outline-hidden [&:focus-visible_[data-slot=filter-bar-add-segment]]:border-neutral5/50 [&:focus-visible>span]:border-neutral5/50',
        className,
      )}
      onKeyDown={event => {
        const isTypeaheadKey = event.key.length === 1 && event.key !== ' ';
        if (isTypeaheadKey) event.preventBaseUIHandler();
        if (event.key === 'ArrowLeft' && ctx.focusChip(ctx.items.length - 1, -1, 'remove')) {
          event.preventDefault();
        }
      }}
    >
      {isCompact ? (
        <span
          key="compact"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-md' }), 'transition-colors', styles.compact)}
        >
          <PlusIcon aria-hidden className="size-3" />
        </span>
      ) : (
        <FilterBarAddSegments
          key="expanded"
          field={field}
          operator={operator}
          selectedValueLabel={selectedValueLabel}
          label={label}
        />
      )}
    </ComboboxPrimitive.Trigger>
  );
}

function FilterBarAddSegments({
  field,
  operator,
  selectedValueLabel,
  label,
}: Pick<FilterBarAddButtonProps, 'field' | 'operator' | 'selectedValueLabel' | 'label'>) {
  const ctx = useFilterBarContext();
  const operatorImplied = field && ctx.getFieldOperators(field).length === 1;

  return (
    <span className="h-form-md relative flex max-w-full items-stretch">
      <FilterBarAddSegment key="field" style={fieldSegmentAccentStyle(field)}>
        {field ? (
          <FilterBarFieldLabel field={field} />
        ) : (
          <>
            <span className="truncate">{label}</span>
            <PlusIcon aria-hidden className="ml-1 size-3 shrink-0" />
          </>
        )}
      </FilterBarAddSegment>
      {field && !operatorImplied && (
        <FilterBarAddSegment
          key="operator"
          joined={operator !== undefined}
          className={!operator ? 'text-neutral3' : undefined}
        >
          <span className="truncate">{operator?.label ?? 'Operator…'}</span>
        </FilterBarAddSegment>
      )}
      {operator && (
        <FilterBarAddSegment
          key="value"
          joined={selectedValueLabel !== undefined}
          className={selectedValueLabel === undefined ? 'text-neutral3' : undefined}
        >
          <span className="truncate">{selectedValueLabel ?? 'Value…'}</span>
        </FilterBarAddSegment>
      )}
    </span>
  );
}

function FilterBarAddSegment({
  children,
  className,
  style,
  joined = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  joined?: boolean;
}) {
  return (
    <span
      data-slot="filter-bar-add-segment"
      data-joined={joined || undefined}
      className={cn(
        segmentClass,
        styles.segment,
        'h-form-md border border-border1 bg-surface5 py-1 text-neutral5 hover:bg-surface6 hover:text-neutral6',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
