import { XIcon } from 'lucide-react';
import type { EntityOptions, TraceDatePreset, TraceStatusFilter } from '../types';
import { TRACE_STATUS_OPTIONS } from '../types';
import type { PropertyFilterField, PropertyFilterToken, PropertyFilterOption } from '@/ds/components/PropertyFilter';
import { ClearableSingleSelect, PropertyFilter } from '@/ds/components/PropertyFilter';
import { Button } from '@/ds/components/Button/Button';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker';
import { Switch } from '@/ds/components/Switch/switch';
import { cn } from '@/lib/utils';

type TracesToolbarProps = {
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange: (val?: EntityOptions) => void;
  selectedStatus?: TraceStatusFilter;
  statusOptions?: ReadonlyArray<{ label: string; value: TraceStatusFilter }>;
  onStatusChange?: (value?: TraceStatusFilter) => void;
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  onReset?: () => void;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  isLoading?: boolean;
  groupByThread?: boolean;
  onGroupByThreadChange?: (value: boolean) => void;
  datePreset?: TraceDatePreset;
  onDatePresetChange?: (preset: TraceDatePreset) => void;
  filterFields: PropertyFilterField[];
  filterTokens: PropertyFilterToken[];
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  loadSuggestions?: (fieldId: string, query: string) => Promise<PropertyFilterOption[]>;
};

export function TracesToolbar({
  onEntityChange,
  onReset,
  selectedEntity,
  entityOptions,
  selectedStatus,
  statusOptions = TRACE_STATUS_OPTIONS,
  onStatusChange,
  onDateChange,
  selectedDateFrom,
  selectedDateTo,
  isLoading,
  groupByThread,
  onGroupByThreadChange,
  datePreset = 'all',
  onDatePresetChange,
  filterFields,
  filterTokens,
  onFilterTokensChange,
  loadSuggestions,
}: TracesToolbarProps) {
  const hasActiveFilters =
    !!selectedEntity || !!selectedStatus || filterTokens.length > 0 || datePreset !== 'last-24h' || !!selectedDateTo;

  return (
    <div className={cn('grid gap-3')}>
      <div className={cn('flex items-center gap-3 flex-wrap')}>
        <DateTimeRangePicker
          preset={datePreset}
          onPresetChange={onDatePresetChange}
          dateFrom={selectedDateFrom}
          dateTo={selectedDateTo}
          onDateChange={onDateChange}
          disabled={isLoading}
        />

        {entityOptions && (
          <ClearableSingleSelect
            label="Root Entity Type"
            options={entityOptions.map(option => ({ label: option.label, value: option.entityType }))}
            value={selectedEntity?.entityType}
            onValueChange={value => {
              const match = entityOptions.find(option => option.entityType === value);
              onEntityChange(match);
            }}
            disabled={isLoading}
          />
        )}

        {onStatusChange && (
          <ClearableSingleSelect
            label="Status"
            options={[...statusOptions]}
            value={selectedStatus}
            onValueChange={value => onStatusChange(value as TraceStatusFilter | undefined)}
            disabled={isLoading}
          />
        )}

        <PropertyFilter
          fields={filterFields}
          tokens={filterTokens}
          onTokensChange={onFilterTokensChange}
          loadSuggestions={loadSuggestions}
          disabled={isLoading}
          label="Filter"
        />

        {onGroupByThreadChange && (
          <label className={cn('flex gap-2 items-center shrink-0 cursor-pointer ml-auto')}>
            <Switch checked={groupByThread} onCheckedChange={onGroupByThreadChange} disabled={isLoading} />
            <span className={cn('text-ui-md text-neutral3')}>Group by thread</span>
          </label>
        )}

        {onReset && hasActiveFilters && (
          <Button disabled={isLoading} size="md" onClick={() => onReset()}>
            <XIcon />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
