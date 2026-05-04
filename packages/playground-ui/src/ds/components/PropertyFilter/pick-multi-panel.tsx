import { useMemo, useState } from 'react';
import type { PropertyFilterField, PropertyFilterToken } from './types';
import { Checkbox } from '@/ds/components/Checkbox';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Spinner } from '@/ds/components/Spinner/spinner';

type PickMultiField = Extract<PropertyFilterField, { kind: 'pick-multi' }>;

export type PickMultiPanelProps = {
  field: PickMultiField;
  tokens: PropertyFilterToken[];
  onChange: (fieldId: string, value: string | string[] | undefined) => void;
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
  const selectedValue = typeof token?.value === 'string' ? token.value : undefined;
  const selectedValues = useMemo<string[]>(() => {
    if (Array.isArray(token?.value)) return token!.value as string[];
    if (typeof token?.value === 'string') return [token.value];
    return [];
  }, [token]);

  return (
    <>
      {field.searchable !== false && (
        <Input
          size="sm"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${field.label.toLowerCase()}...`}
          className="mb-2"
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
      )}

      {field.isLoading ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-ui-sm text-neutral3">
          <Spinner size="sm" className="w-3 h-3" color="var(--neutral3)" />
          Loading options…
        </div>
      ) : filteredOptions.length === 0 ? (
        <div className="px-2 py-1.5 text-ui-sm text-neutral3">{field.emptyText ?? 'No option found.'}</div>
      ) : field.multi ? (
        <div className="max-h-[80dvh] overflow-auto">
          {filteredOptions.map(option => {
            const checked = selectedValues.includes(option.value);
            return (
              <label
                key={option.value}
                title={option.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
              >
                <Checkbox
                  data-pick-multi-item=""
                  checked={checked}
                  onCheckedChange={next => {
                    const isChecked = next === true;
                    const nextValues = isChecked
                      ? selectedValues.includes(option.value)
                        ? selectedValues
                        : [...selectedValues, option.value]
                      : selectedValues.filter(v => v !== option.value);
                    onChange(field.id, nextValues);
                  }}
                  className="shrink-0"
                />
                <span className="truncate min-w-0 flex-1">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          value={selectedValue ?? ''}
          onValueChange={value => onChange(field.id, value)}
          className="max-h-[80dvh] gap-0 overflow-auto"
        >
          {filteredOptions.map(option => (
            <label
              key={option.value}
              title={option.label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
            >
              <RadioGroupItem data-pick-multi-item="" value={option.value} className="shrink-0" />
              <span className="truncate min-w-0 flex-1">{option.label}</span>
            </label>
          ))}
          <label
            title="Any"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
          >
            <RadioGroupItem data-pick-multi-item="" value="Any" className="shrink-0" />
            <span className="truncate min-w-0 flex-1">Any</span>
          </label>
        </RadioGroup>
      )}
    </>
  );
}
