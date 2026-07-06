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

type PickMultiOption = PickMultiField['options'][number];

function getSelectedValue(token: PropertyFilterToken | undefined, field: PickMultiField) {
  if (typeof token?.value === 'string') {
    return token.value;
  }
  if (!field.multi) {
    return field.defaultValue;
  }
  return undefined;
}

function getNextSelectedValues(selectedValues: string[], optionValue: string, isChecked: boolean) {
  if (!isChecked) {
    return selectedValues.filter(v => v !== optionValue);
  }
  if (selectedValues.includes(optionValue)) {
    return selectedValues;
  }
  return [...selectedValues, optionValue];
}

function getPickMultiOptionLabelId(fieldId: string, optionValue: string) {
  return `pick-multi-option-${fieldId}-${optionValue}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function isEventTargetInPickMultiControl(target: EventTarget | null) {
  return target instanceof Element && target.closest('[data-pick-multi-control]') != null;
}

function PickMultiOptions({
  field,
  filteredOptions,
  selectedValue,
  selectedValues,
  onChange,
}: {
  field: PickMultiField;
  filteredOptions: PickMultiOption[];
  selectedValue: string | undefined;
  selectedValues: string[];
  onChange: PickMultiPanelProps['onChange'];
}) {
  if (field.isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-ui-sm text-neutral3">
        <Spinner size="sm" className="size-3 text-neutral3" />
        Loading options…
      </div>
    );
  }
  if (filteredOptions.length === 0) {
    return <div className="px-2 py-1.5 text-ui-sm text-neutral3">{field.emptyText ?? 'No option found.'}</div>;
  }
  if (field.multi) {
    return (
      <div className="max-h-[80dvh] overflow-auto">
        {filteredOptions.map(option => {
          const checked = selectedValues.includes(option.value);
          const labelId = getPickMultiOptionLabelId(field.id, option.value);
          return (
            <div
              key={option.value}
              title={option.label}
              onPointerUp={event => {
                if (isEventTargetInPickMultiControl(event.target)) return;
                onChange(field.id, getNextSelectedValues(selectedValues, option.value, !checked));
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
            >
              <Checkbox
                data-pick-multi-item=""
                data-pick-multi-control=""
                checked={checked}
                aria-labelledby={labelId}
                onCheckedChange={next =>
                  onChange(field.id, getNextSelectedValues(selectedValues, option.value, next === true))
                }
                className="shrink-0"
              />
              <span id={labelId} className="truncate min-w-0 flex-1">
                {option.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <RadioGroup
      value={selectedValue ?? ''}
      onValueChange={value => onChange(field.id, value)}
      className="max-h-[80dvh] gap-0 overflow-auto"
    >
      {filteredOptions.map(option => (
        <div
          key={option.value}
          title={option.label}
          onPointerUp={event => {
            if (isEventTargetInPickMultiControl(event.target)) return;
            onChange(field.id, option.value);
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
        >
          <RadioGroupItem
            data-pick-multi-item=""
            data-pick-multi-control=""
            value={option.value}
            aria-labelledby={getPickMultiOptionLabelId(field.id, option.value)}
            className="shrink-0"
          />
          <span id={getPickMultiOptionLabelId(field.id, option.value)} className="truncate min-w-0 flex-1">
            {option.label}
          </span>
        </div>
      ))}
      {!field.omitAnyOption && (
        <div
          title="Any"
          onPointerUp={event => {
            if (isEventTargetInPickMultiControl(event.target)) return;
            onChange(field.id, 'Any');
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ui-md text-neutral4 hover:bg-surface4 hover:text-neutral6 cursor-pointer focus-within:bg-surface4 focus-within:text-neutral6 min-w-0"
        >
          <RadioGroupItem
            data-pick-multi-item=""
            data-pick-multi-control=""
            value="Any"
            aria-labelledby={getPickMultiOptionLabelId(field.id, 'Any')}
            className="shrink-0"
          />
          <span id={getPickMultiOptionLabelId(field.id, 'Any')} className="truncate min-w-0 flex-1">
            Any
          </span>
        </div>
      )}
    </RadioGroup>
  );
}

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
  const selectedValue = getSelectedValue(token, field);
  const selectedValues = useMemo<string[]>(() => {
    const value = token?.value;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
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

      <PickMultiOptions
        field={field}
        filteredOptions={filteredOptions}
        selectedValue={selectedValue}
        selectedValues={selectedValues}
        onChange={onChange}
      />
    </>
  );
}
