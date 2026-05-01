import { PropertyFilterActions } from '@/ds/components/PropertyFilter/property-filter-actions';
import { PropertyFilterApplied } from '@/ds/components/PropertyFilter/property-filter-applied';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { cn } from '@/lib/utils';

type TracesToolbarProps = {
  /** Keep all filter pills but reset each value to its neutral state
   *  ('' for text, 'Any' for single-select, [] for multi-select). */
  onClear?: () => void;
  /** Fully remove all filter pills. */
  onRemoveAll?: () => void;
  onSave?: () => void;
  /** When provided, an extra "Remove saved filters" option is shown —
   *  wire it up only when there is actually a saved set to remove. */
  onRemoveSaved?: () => void;
  isLoading?: boolean;
  filterFields: PropertyFilterField[];
  filterTokens: PropertyFilterToken[];
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  autoFocusFilterFieldId?: string;
};

export function TracesToolbar({
  onClear,
  onRemoveAll,
  onSave,
  onRemoveSaved,
  isLoading,
  filterFields,
  filterTokens,
  onFilterTokensChange,
  autoFocusFilterFieldId,
}: TracesToolbarProps) {
  const hasActiveFilters = filterTokens.length > 0;
  const hasNonDefaultFilter = filterTokens.some(token => isNonDefaultFilter(token, filterFields));

  return (
    // 1fr | auto — pills wrap in the first column; Clear stays pinned to the
    // top of the second column regardless of how many pill rows render.
    <div className={cn('grid grid-cols-[1fr_auto] gap-3 items-start ')}>
      <PropertyFilterApplied
        fields={filterFields}
        tokens={filterTokens}
        onTokensChange={onFilterTokensChange}
        disabled={isLoading}
        autoFocusFieldId={autoFocusFilterFieldId}
      />

      {hasActiveFilters && (
        <PropertyFilterActions
          disabled={isLoading}
          onClear={hasNonDefaultFilter ? onClear : undefined}
          onRemoveAll={onRemoveAll}
          onSave={onSave}
          onRemoveSaved={onRemoveSaved}
        />
      )}
    </div>
  );
}

function isNonDefaultFilter(token: PropertyFilterToken, fields: PropertyFilterField[]): boolean {
  const field = fields.find(f => f.id === token.fieldId);
  if (!field) return false;
  if (field.kind === 'text') {
    return typeof token.value === 'string' && token.value.trim() !== '';
  }
  if (field.kind === 'pick-multi') {
    if (field.multi) return Array.isArray(token.value) && token.value.length > 0;
    return typeof token.value === 'string' && token.value !== '' && token.value !== 'Any';
  }
  if (field.kind === 'multi-select') {
    return Array.isArray(token.value) && token.value.length > 0;
  }
  return false;
}
