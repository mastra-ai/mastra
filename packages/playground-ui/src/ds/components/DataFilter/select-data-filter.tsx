import { FilterIcon, SearchIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useMemo, useCallback } from 'react';

import { Button } from '@/ds/components/Button/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single selectable value within a filter category */
export type SelectDataFilterValue = {
  value: string;
  label: string;
};

/** Selection mode for a filter category */
export type SelectDataFilterMode = 'single' | 'multi';

/** A filter category that appears in the filter dropdown */
export type SelectDataFilterCategory = {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional group header (categories with the same group are nested under it) */
  group?: string;
  /** Available values to pick from */
  values: SelectDataFilterValue[];
  /** 'single' = radio, 'multi' = checkboxes. Defaults to 'multi'. */
  mode?: SelectDataFilterMode;
};

/** Current selected state: category id -> selected value(s) */
export type SelectDataFilterState = Record<string, string[]>;

export type SelectDataFilterProps = {
  /** Filter categories to display */
  categories: SelectDataFilterCategory[];
  /** Current filter selections */
  value: SelectDataFilterState;
  /** Called when selections change */
  onChange: (next: SelectDataFilterState) => void;
  /** Disable the trigger button */
  disabled?: boolean;
  /** Override the trigger label */
  label?: ReactNode;
  /** Content alignment */
  align?: 'start' | 'center' | 'end';
  /** Minimum items before showing search in a submenu */
  searchThreshold?: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SUBMENU_SEARCH_THRESHOLD = 6;

function SubMenuSearch({
  value,
  onChange,
  label = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className={cn('px-2 pb-2')}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border1 px-2 py-1',
          'focus-within:border-neutral2',
        )}
      >
        <SearchIcon className={cn('size-3.5 shrink-0 text-neutral3')} />
        <input
          type="text"
          placeholder="Search..."
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          className={cn('w-full bg-transparent text-ui-sm text-neutral4 outline-none placeholder:text-neutral3')}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectDataFilter({
  categories,
  value,
  onChange,
  disabled,
  label = 'Filter',
  align = 'end',
  searchThreshold = SUBMENU_SEARCH_THRESHOLD,
}: SelectDataFilterProps) {
  const [filterSearch, setFilterSearch] = useState('');
  const [subSearch, setSubSearch] = useState('');

  const resetSubSearch = useCallback((open: boolean) => {
    if (!open) setSubSearch('');
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const selections of Object.values(value)) {
      if (selections.length > 0) count++;
    }
    return count;
  }, [value]);

  // Group categories
  const grouped = useMemo(() => {
    const q = filterSearch.toLowerCase();
    const groups: { key: string; label?: string; items: SelectDataFilterCategory[] }[] = [];
    const groupMap = new Map<string, SelectDataFilterCategory[]>();
    const ungrouped: SelectDataFilterCategory[] = [];

    for (const cat of categories) {
      if (cat.values.length === 0) continue;
      // Filter by search
      if (q) {
        const matchesLabel = cat.label.toLowerCase().includes(q);
        const matchesValues = cat.values.some(v => v.label.toLowerCase().includes(q));
        if (!matchesLabel && !matchesValues) continue;
      }
      if (cat.group) {
        let items = groupMap.get(cat.group);
        if (!items) {
          items = [];
          groupMap.set(cat.group, items);
        }
        items.push(cat);
      } else {
        ungrouped.push(cat);
      }
    }

    // Ungrouped items first
    for (const cat of ungrouped) {
      groups.push({ key: cat.id, items: [cat] });
    }
    // Then grouped
    for (const [groupLabel, items] of groupMap) {
      groups.push({ key: `group-${groupLabel}`, label: groupLabel, items });
    }

    return groups;
  }, [categories, filterSearch]);

  const handleSelect = (categoryId: string, selectedValue: string, mode: SelectDataFilterMode) => {
    const current = value[categoryId] ?? [];
    let next: string[];

    if (mode === 'single') {
      next = current.includes(selectedValue) ? [] : [selectedValue];
    } else {
      next = current.includes(selectedValue) ? current.filter(v => v !== selectedValue) : [...current, selectedValue];
    }

    onChange({ ...value, [categoryId]: next });
  };

  const handleClearAll = () => {
    onChange({});
  };

  const renderCategory = (cat: SelectDataFilterCategory) => {
    const mode = cat.mode ?? 'multi';
    const selected = value[cat.id] ?? [];
    const selectedCount = selected.length;

    return (
      <DropdownMenu.Sub key={cat.id} onOpenChange={resetSubSearch}>
        <DropdownMenu.SubTrigger>
          <span className={cn('truncate')}>{cat.label}</span>
          {selectedCount > 0 && <span className={cn('ml-auto text-ui-sm text-accent1')}>{selectedCount}</span>}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent className={cn('max-h-80')}>
          {cat.values.length >= searchThreshold && (
            <SubMenuSearch value={subSearch} onChange={setSubSearch} label={`Search ${cat.label.toLowerCase()}`} />
          )}
          {mode === 'single' ? (
            <DropdownMenu.RadioGroup value={selected[0] ?? ''} onValueChange={val => handleSelect(cat.id, val, mode)}>
              {cat.values
                .filter(v => !subSearch || v.label.toLowerCase().includes(subSearch.toLowerCase()))
                .map(v => (
                  <DropdownMenu.RadioItem key={v.value} value={v.value}>
                    <span className={cn('truncate')}>{v.label}</span>
                  </DropdownMenu.RadioItem>
                ))}
            </DropdownMenu.RadioGroup>
          ) : (
            cat.values
              .filter(v => !subSearch || v.label.toLowerCase().includes(subSearch.toLowerCase()))
              .map(v => (
                <DropdownMenu.CheckboxItem
                  key={v.value}
                  checked={selected.includes(v.value)}
                  onCheckedChange={() => handleSelect(cat.id, v.value, mode)}
                  onSelect={e => e.preventDefault()}
                >
                  <span className={cn('truncate')}>{v.label}</span>
                </DropdownMenu.CheckboxItem>
              ))
          )}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" disabled={disabled} size="md">
          <FilterIcon />
          {label}
          {activeFilterCount > 0 && (
            <span
              className={cn(
                'ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-accent1/50 text-ui-sm text-neutral5',
              )}
            >
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align={align} className={cn('min-w-48')}>
        {/* Search */}
        <div className={cn('px-2 pb-2')}>
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border border-border1 px-2 py-1',
              'focus-within:border-neutral2',
            )}
          >
            <SearchIcon className={cn('size-3.5 shrink-0 text-neutral3')} />
            <input
              type="text"
              placeholder="Search filters..."
              aria-label="Search filters"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              className={cn('w-full bg-transparent text-ui-sm text-neutral4 outline-none placeholder:text-neutral3')}
            />
          </div>
        </div>

        <DropdownMenu.Separator />

        {grouped.map(group => {
          const firstItem = group.items[0];

          if (group.items.length === 1 && firstItem) {
            // A single category (grouped or not) renders directly, without a sub-trigger.
            return renderCategory(firstItem);
          }

          // Multiple items under a group label — nest under a sub-trigger
          return (
            <DropdownMenu.Sub key={group.key}>
              <DropdownMenu.SubTrigger>{group.label}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={cn('max-h-80')}>
                {group.items.map(cat => renderCategory(cat))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          );
        })}

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={handleClearAll}>
              <XIcon />
              Clear all filters
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
