import { PropertyFilterActions } from '@/ds/components/PropertyFilter/property-filter-actions';
import { PropertyFilterApplied } from '@/ds/components/PropertyFilter/property-filter-applied';
import type { PropertyFilterField, PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { cn } from '@/lib/utils';

export interface LogsToolbarProps {
  onClear?: () => void;
  onRemoveAll?: () => void;
  onSave?: () => void;
  onRemoveSaved?: () => void;
  isLoading?: boolean;
  filterFields: PropertyFilterField[];
  filterTokens: PropertyFilterToken[];
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  autoFocusFilterFieldId?: string;
}

export function LogsToolbar({
  onClear,
  onRemoveAll,
  onSave,
  onRemoveSaved,
  isLoading,
  filterFields,
  filterTokens,
  onFilterTokensChange,
  autoFocusFilterFieldId,
}: LogsToolbarProps) {
  const hasActiveFilters = filterTokens.length > 0;
  const hasNonDefaultFilter = filterTokens.some(token => isNonDefaultFilter(token, filterFields));

  return (
    <div className={cn('grid grid-cols-[1fr_auto] gap-3 items-start')}>
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
