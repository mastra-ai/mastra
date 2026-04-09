import { CalendarIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { FilterGroup, FilterColumn } from '../hooks/use-logs-filters';
import type { LogsDatePreset } from './logs-date-range-selector';
import type { EntityOptions } from '@/domains/traces/types';
import { Button } from '@/ds/components/Button';
import type { SelectDataFilterCategory, SelectDataFilterState } from '@/ds/components/DataFilter';
import { SelectDataFilter } from '@/ds/components/DataFilter';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { ListSearch } from '@/ds/components/ListSearch/list-search';

const DATE_PRESET_LABELS: Record<LogsDatePreset, string> = {
  '24h': 'Last 24 hours',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
};

export interface LogsToolbarProps {
  onSearchChange: (query: string) => void;
  datePreset: LogsDatePreset;
  onDatePresetChange: (preset: LogsDatePreset) => void;
  selectedEntityType?: string;
  entityTypeOptions?: Array<{ label: string; entityType: string }>;
  onEntityTypeChange?: (entityType?: string) => void;
  selectedEntityName?: string;
  entityNameOptions?: string[];
  onEntityNameChange?: (entityName?: string) => void;
  selectedRootEntityType?: EntityOptions;
  rootEntityTypeOptions?: EntityOptions[];
  onRootEntityTypeChange?: (entityType?: EntityOptions) => void;
  selectedRootEntityName?: string;
  rootEntityNameOptions?: string[];
  onRootEntityNameChange?: (entityName?: string) => void;
  filterGroups: FilterGroup[];
  filterColumns: FilterColumn[];
  onToggleComparator: (id: string) => void;
  onRemoveFilterGroup: (id: string) => void;
  onClearAllFilters: () => void;
  onFilterGroupsChange: (next: Record<string, string[]>) => void;
  onReset?: () => void;
  isLoading?: boolean;
  hasActiveFilters?: boolean;
}

export function LogsToolbar({
  onSearchChange,
  datePreset,
  onDatePresetChange,
  selectedEntityType,
  entityTypeOptions,
  onEntityTypeChange,
  selectedEntityName,
  entityNameOptions,
  onEntityNameChange,
  selectedRootEntityType,
  rootEntityTypeOptions,
  onRootEntityTypeChange,
  selectedRootEntityName,
  rootEntityNameOptions,
  onRootEntityNameChange,
  filterGroups,
  filterColumns,
  onToggleComparator: _onToggleComparator,
  onRemoveFilterGroup: _onRemoveFilterGroup,
  onClearAllFilters: _onClearAllFilters,
  onFilterGroupsChange,
  onReset,
  isLoading,
  hasActiveFilters,
}: LogsToolbarProps) {
  const categories: SelectDataFilterCategory[] = useMemo(() => {
    const categories: SelectDataFilterCategory[] = [];

    if (entityTypeOptions?.length) {
      categories.push({
        id: 'entity-type',
        label: 'Entity Type',
        values: entityTypeOptions.map(option => ({ value: option.entityType, label: option.label })),
        mode: 'single',
      });
    }

    if (rootEntityTypeOptions?.length) {
      categories.push({
        id: 'root-entity-type',
        label: 'Root Entity Type',
        values: rootEntityTypeOptions.map(option => ({ value: option.entityType, label: option.label })),
        mode: 'single',
      });
    }

    if (entityNameOptions?.length) {
      categories.push({
        id: 'entity-name',
        label: 'Entity Name',
        values: entityNameOptions.map(value => ({ value, label: value })),
        mode: 'single',
      });
    }

    if (rootEntityNameOptions?.length) {
      categories.push({
        id: 'root-entity-name',
        label: 'Root Entity Name',
        values: rootEntityNameOptions.map(value => ({ value, label: value })),
        mode: 'single',
      });
    }

    categories.push(
      ...filterColumns.map(col => ({
        id: col.field,
        label: col.field,
        values: col.values.map(v => ({ value: v, label: v })),
        mode: 'multi' as const,
      })),
    );

    return categories;
  }, [entityTypeOptions, entityNameOptions, rootEntityTypeOptions, rootEntityNameOptions, filterColumns]);

  const filterState: SelectDataFilterState = useMemo(() => {
    const state: SelectDataFilterState = {};
    if (selectedEntityType) {
      state['entity-type'] = [selectedEntityType];
    }
    if (selectedEntityName) {
      state['entity-name'] = [selectedEntityName];
    }
    if (selectedRootEntityType) {
      state['root-entity-type'] = [selectedRootEntityType.entityType];
    }
    if (selectedRootEntityName) {
      state['root-entity-name'] = [selectedRootEntityName];
    }
    for (const group of filterGroups) {
      state[group.field] = group.values;
    }
    return state;
  }, [selectedEntityType, selectedEntityName, selectedRootEntityType, selectedRootEntityName, filterGroups]);

  const handleFilterChange = (next: SelectDataFilterState) => {
    const nextEntityType = (next['entity-type'] ?? [])[0];
    if (nextEntityType !== selectedEntityType) {
      onEntityTypeChange?.(nextEntityType);
    }

    const nextEntityName = (next['entity-name'] ?? [])[0];
    if (nextEntityName !== selectedEntityName) {
      onEntityNameChange?.(nextEntityName);
    }

    const nextRootEntityType = (next['root-entity-type'] ?? [])[0];
    if (nextRootEntityType !== selectedRootEntityType?.entityType) {
      const option = rootEntityTypeOptions?.find(option => option.entityType === nextRootEntityType);
      onRootEntityTypeChange?.(option);
    }

    const nextRootEntityName = (next['root-entity-name'] ?? [])[0];
    if (nextRootEntityName !== selectedRootEntityName) {
      onRootEntityNameChange?.(nextRootEntityName);
    }

    const localFilters = Object.fromEntries(
      Object.entries(next).filter(
        ([key]) =>
          key !== 'entity-type' &&
          key !== 'entity-name' &&
          key !== 'root-entity-type' &&
          key !== 'root-entity-name',
      ),
    );
    onFilterGroupsChange(localFilters);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ListSearch onSearch={onSearchChange} size="md" label="Search logs" placeholder="Search name, ID, content..." />
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button variant="inputLike" size="md">
              <CalendarIcon /> {DATE_PRESET_LABELS[datePreset]} <ChevronDownIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {(Object.keys(DATE_PRESET_LABELS) as LogsDatePreset[]).map(value => (
              <DropdownMenu.Item key={value} onSelect={() => onDatePresetChange(value)}>
                {DATE_PRESET_LABELS[value]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
        <SelectDataFilter
          categories={categories}
          value={filterState}
          onChange={handleFilterChange}
          align="end"
          disabled={isLoading}
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
