import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { FilterGroup, FilterColumn } from '../hooks/use-logs-filters';
import type { LogsDatePreset } from './logs-date-range-selector';
import { Button } from '@/ds/components/Button';
import type { DataFilterCategory, DataFilterState } from '@/ds/components/DataFilter';
import { DataFilter } from '@/ds/components/DataFilter';
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
}: LogsToolbarProps) {
  const categories: DataFilterCategory[] = useMemo(
    () =>
      filterColumns.map(col => ({
        id: col.field,
        label: col.field,
        values: col.values.map(v => ({ value: v, label: v })),
        mode: 'multi' as const,
      })),
    [filterColumns],
  );

  const filterState: DataFilterState = useMemo(() => {
    const state: DataFilterState = {};
    for (const group of filterGroups) {
      state[group.field] = group.values;
    }
    return state;
  }, [filterGroups]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ListSearch onSearch={onSearchChange} label="Search logs" placeholder="Search name, ID, content..." />
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button variant="inputLike">
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
        <DataFilter categories={categories} value={filterState} onChange={onFilterGroupsChange} align="end" />
      </div>

      {filterGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filterGroups.map(group => {
            const col = filterColumns.find(c => c.field === group.field);
            const displayValue =
              group.values.length > 1 ? `${group.values.length} ${col?.plural ?? 'values'}` : group.values[0];
            return (
              <div
                key={group.id}
                className="flex h-7 items-center overflow-hidden rounded-md border border-border1 bg-surface3 text-xs"
              >
                <span className="px-2 text-neutral2">{group.field}</span>
                <button
                  type="button"
                  onClick={() => onToggleComparator(group.id)}
                  className="h-full cursor-pointer whitespace-nowrap border-x border-border1 px-1.5 text-neutral2 transition-colors hover:bg-surface4 hover:text-neutral5"
                >
                  {group.values.length > 1 ? `${group.comparator} any of` : group.comparator}
                </button>
                <span className="px-2 text-neutral5">{displayValue}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFilterGroup(group.id)}
                  className="h-full border-l border-border1 px-1.5 text-neutral2 transition-colors hover:bg-surface4 hover:text-neutral5"
                >
                  x
                </button>
              </div>
            );
          })}
          <button type="button" onClick={onClearAllFilters} className="px-2 text-xs text-neutral2 hover:text-neutral5">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
