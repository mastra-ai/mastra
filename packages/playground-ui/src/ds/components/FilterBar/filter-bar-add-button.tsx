import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { PlusIcon } from 'lucide-react';
import type { Ref } from 'react';
import styles from './animation/filter-bar-animation.module.css';
import { FilterBarDraftSegment } from './animation/filter-bar-draft-segment';
import { FilterBarFieldLabel, fieldSegmentAccentStyle } from './filter-bar-chip';
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
        'relative inline-flex h-form-md max-w-full shrink-0 cursor-pointer rounded-lg outline-hidden [&:focus-visible_[data-slot=filter-bar-draft-segment]]:border-neutral5/50 [&:focus-visible>span]:border-neutral5/50',
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
      <FilterBarDraftSegment key="field" style={fieldSegmentAccentStyle(field)}>
        {field ? (
          <FilterBarFieldLabel field={field} />
        ) : (
          <>
            <span className="truncate">{label}</span>
            <PlusIcon aria-hidden className="ml-1 size-3 shrink-0" />
          </>
        )}
      </FilterBarDraftSegment>
      {field && !operatorImplied && (
        <FilterBarDraftSegment
          key="operator"
          joined={operator !== undefined}
          className={!operator ? 'text-neutral3' : undefined}
        >
          <span className="truncate">{operator?.label ?? 'Operator…'}</span>
        </FilterBarDraftSegment>
      )}
      {operator && (
        <FilterBarDraftSegment
          key="value"
          joined={selectedValueLabel !== undefined}
          className={selectedValueLabel === undefined ? 'text-neutral3' : undefined}
        >
          <span className="truncate">{selectedValueLabel ?? 'Value…'}</span>
        </FilterBarDraftSegment>
      )}
    </span>
  );
}
