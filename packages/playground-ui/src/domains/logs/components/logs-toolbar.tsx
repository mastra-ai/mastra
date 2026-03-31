import { CalendarIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { FilterGroup, FilterColumn } from '../hooks/use-logs-filters';
import type { LogsDatePreset } from './logs-date-range-selector';
import { Button } from '@/ds/components/Button';
import type { SelectDataFilterCategory, SelectDataFilterState } from '@/ds/components/DataFilter';
import { SelectDataFilter } from '@/ds/components/DataFilter';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { ListSearch } from '@/ds/components/ListSearch/list-search';

const DATE_PRESET_LABELS: Record<string, string> = {
  '24h': 'Last 24 hours',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
};

export interface LogsToolbarProps {
  onSearchChange: (query: string) => void;
  datePreset: LogsDatePreset;
  onDatePresetChange: (preset: string) => void;
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
  filterGroups,
  filterColumns,
  onToggleComparator,
  onRemoveFilterGroup,
  onClearAllFilters,
  onFilterGroupsChange,
  onReset,
  isLoading,
  hasActiveFilters,
}: LogsToolbarProps) {
  const categories: SelectDataFilterCategory[] = useMemo(
    () =>
      filterColumns.map(col => ({
        id: col.field,
        label: col.field,
        values: col.values.map(v => ({ value: v, label: v })),
        mode: 'multi' as const,
      })),
    [filterColumns],
  );

  const filterState: SelectDataFilterState = useMemo(() => {
    const state: SelectDataFilterState = {};
    for (const group of filterGroups) {
      state[group.field] = group.values;
    }
    return state;
  }, [filterGroups]);

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
            {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
              <DropdownMenu.Item key={value} onSelect={() => onDatePresetChange(value)}>
                {label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
        <SelectDataFilter
          categories={categories}
          value={filterState}
          onChange={onFilterGroupsChange}
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
