import { CalendarIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import type { EntityOptions } from '@/domains/traces/types';
import type { PropertyFilterField, PropertyFilterOption, PropertyFilterToken } from '@/ds/components/PropertyFilter';
import { ClearableSingleSelect, PropertyFilter } from '@/ds/components/PropertyFilter';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { cn } from '@/lib/utils';
import { LOG_LEVEL_OPTIONS, type LogLevel } from '../types';
import type { LogsDatePreset } from './logs-date-range-selector';

const DATE_PRESET_LABELS: Record<LogsDatePreset, string> = {
  '24h': 'Last 24 hours',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
};

export interface LogsToolbarProps {
  datePreset: LogsDatePreset;
  onDatePresetChange: (preset: LogsDatePreset) => void;
  selectedRootEntityType?: EntityOptions;
  rootEntityTypeOptions?: EntityOptions[];
  onRootEntityTypeChange?: (entityType?: EntityOptions) => void;
  selectedLevel?: LogLevel;
  onLevelChange?: (level?: LogLevel) => void;
  filterFields: PropertyFilterField[];
  filterTokens: PropertyFilterToken[];
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  loadSuggestions?: (fieldId: string, query: string) => Promise<PropertyFilterOption[]>;
  onReset?: () => void;
  isLoading?: boolean;
  hasActiveFilters?: boolean;
}

export function LogsToolbar({
  datePreset,
  onDatePresetChange,
  selectedRootEntityType,
  rootEntityTypeOptions,
  onRootEntityTypeChange,
  selectedLevel,
  onLevelChange,
  filterFields,
  filterTokens,
  onFilterTokensChange,
  loadSuggestions,
  onReset,
  isLoading,
  hasActiveFilters,
}: LogsToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3')}>
      <div className={cn('flex items-center gap-3 flex-wrap')}>
        <DropdownMenu modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button variant="inputLike" size="md" disabled={isLoading}>
              <CalendarIcon />
              {DATE_PRESET_LABELS[datePreset]}
              <ChevronDownIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {(Object.keys(DATE_PRESET_LABELS) as LogsDatePreset[]).map(value => (
              <DropdownMenu.Item key={value} onSelect={() => onDatePresetChange(value)}>
                {DATE_PRESET_LABELS[value]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>

        {rootEntityTypeOptions && onRootEntityTypeChange && (
          <ClearableSingleSelect
            label="Root Entity Type"
            options={rootEntityTypeOptions.map(option => ({ label: option.label, value: option.entityType }))}
            value={selectedRootEntityType?.entityType}
            onValueChange={value => {
              const match = rootEntityTypeOptions.find(option => option.entityType === value);
              onRootEntityTypeChange(match);
            }}
            disabled={isLoading}
          />
        )}

        {onLevelChange && (
          <ClearableSingleSelect
            label="Log Level"
            options={[...LOG_LEVEL_OPTIONS]}
            value={selectedLevel}
            onValueChange={value => onLevelChange(value as LogLevel | undefined)}
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

        {onReset && hasActiveFilters && (
          <Button variant="outline" size="md" disabled={isLoading} onClick={onReset} className="ml-auto">
            <XIcon />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
