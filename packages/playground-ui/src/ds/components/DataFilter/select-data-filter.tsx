import { FilterIcon, SearchIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useMemo, useCallback } from 'react';

import { Button } from '@/ds/components/Button/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { menuSearchClasses } from '@/ds/primitives/menu-item';
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

function MenuSearch({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    // Pull the row flush against the popup edges (the popup pads its items with p-1).
    <div className={cn(menuSearchClasses.container, '-mx-1 -mt-1 mb-1')}>
      <SearchIcon className={menuSearchClasses.icon} />
      <input
        type="text"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        className={menuSearchClasses.input}
      />
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
          <span className="flex-1 truncate">{cat.label}</span>
          {selectedCount > 0 && <span className={cn('text-caption text-accent1')}>{selectedCount}</span>}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {cat.values.length >= searchThreshold && (
            <MenuSearch value={subSearch} onChange={setSubSearch} label={`Search ${cat.label.toLowerCase()}`} />
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
        <Button variant="outline" disabled={disabled} size="md" icon={<FilterIcon />}>
          {label}
          {activeFilterCount > 0 && (
            <span
              className={cn(
                'ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-accent1/50 text-caption text-foreground',
              )}
            >
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align={align}>
        <MenuSearch
          value={filterSearch}
          onChange={setFilterSearch}
          label="Search filters"
          placeholder="Search filters..."
        />

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
              <DropdownMenu.SubContent>{group.items.map(cat => renderCategory(cat))}</DropdownMenu.SubContent>
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
