import { CheckIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Spinner } from '@/ds/components/Spinner/spinner';
import { menuEmptyClass, menuItemCheckClass, menuItemClass, menuSearchClasses } from '@/ds/primitives/menu-item';
import { cn } from '@/lib/utils';

// Same rendering as Combobox items: no visible control, a trailing check when selected.
// Focus is on the item itself (roving via [data-pick-multi-item]), so highlight rides on :focus.
const pickMultiItemClass = cn(menuItemClass, 'min-w-0 focus:bg-fill-subtle focus:text-foreground');

function PickMultiItem({
  role,
  checked,
  label,
  onClick,
}: {
  role: 'checkbox' | 'radio';
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      data-selected={checked || undefined}
      data-pick-multi-item=""
      title={label}
      className={pickMultiItemClass}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked && (
        <span className={menuItemCheckClass}>
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

type PickMultiField = Extract<PropertyFilterField, { kind: 'pick-multi' }>;

export type PickMultiPanelProps = {
  field: PickMultiField;
  tokens: PropertyFilterToken[];
  /** Always carries a value: an empty list is how the panel says "nothing selected". */
  onChange: (fieldId: string, value: string | string[]) => void;
};

/**
 * Reusable body for a pick-multi side popover: optional search input plus a
 * radio group (single-select) or checkbox list (when `field.multi` is true).
 * Shared between the Filter Creator's property-picker side popover and the
 * PropertyFilterApplied pill's inline editor so both surfaces use the exact same UI.
 */
export function PickMultiPanel({ field, tokens, onChange }: PickMultiPanelProps) {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return field.options;
    return field.options.filter(o => o.label.toLowerCase().includes(q));
  }, [field.options, query]);

  const token = useMemo(() => tokens.find(t => t.fieldId === field.id), [tokens, field.id]);
  // Fall back to `defaultValue` when no token exists — lets view-toggle fields (e.g. List mode)
  // show their default option pre-selected before the user explicitly picks one.
  const selectedValue = typeof token?.value === 'string' ? token.value : !field.multi ? field.defaultValue : undefined;
  const selectedValues = useMemo<string[]>(() => {
    const value = token?.value;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  }, [token]);

  return (
    <>
      {field.searchable !== false && (
        <div className={menuSearchClasses.container}>
          <SearchIcon className={menuSearchClasses.icon} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${field.label.toLowerCase()}...`}
            className={menuSearchClasses.input}
            onKeyDown={e => {
              if (e.key !== 'ArrowDown') return;
              const panel = e.currentTarget.closest<HTMLElement>('[data-pick-multi-panel]');
              const first = panel?.querySelector<HTMLElement>('[data-pick-multi-item]:not([disabled])');
              if (!first) return;
              e.preventDefault();
              e.stopPropagation();
              first.focus();
            }}
          />
        </div>
      )}

      {field.isLoading ? (
        <div className={cn(menuEmptyClass, 'm-1')}>
          <Spinner size="sm" className="text-muted-foreground size-3" />
          Loading options…
        </div>
      ) : filteredOptions.length === 0 ? (
        <div className={cn(menuEmptyClass, 'm-1')}>{field.emptyText ?? 'No option found.'}</div>
      ) : field.multi ? (
        <div className="max-h-[80dvh] overflow-auto p-1">
          {filteredOptions.map(option => {
            const checked = selectedValues.includes(option.value);
            return (
              <PickMultiItem
                key={option.value}
                role="checkbox"
                checked={checked}
                label={option.label}
                onClick={() =>
                  onChange(
                    field.id,
                    checked ? selectedValues.filter(v => v !== option.value) : [...selectedValues, option.value],
                  )
                }
              />
            );
          })}
        </div>
      ) : (
        <div role="radiogroup" className="max-h-[80dvh] overflow-auto p-1">
          {filteredOptions.map(option => (
            <PickMultiItem
              key={option.value}
              role="radio"
              checked={selectedValue === option.value}
              label={option.label}
              onClick={() => onChange(field.id, option.value)}
            />
          ))}
          {!field.omitAnyOption && (
            <PickMultiItem
              role="radio"
              checked={selectedValue === 'Any'}
              label="Any"
              onClick={() => onChange(field.id, 'Any')}
            />
          )}
        </div>
      )}
    </>
  );
}
