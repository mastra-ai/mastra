import { useRef, useState } from 'react';

import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxTrigger,
} from '@/ds/components/Combobox';
import type { FilterBarField, FilterBarOption } from '@/ds/components/FilterBar';
import { Input } from '@/ds/components/Input';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

/** A value a condition tests for: one, or several for "is any of". */
export type ConditionValue = string | number | boolean | Array<string | number | boolean>;

/** One condition as its row edits it: a field, a test and the value it tests for. */
export type ConditionRowData = { key: string; field: string; operator: string; value?: ConditionValue };

type Row = ConditionRowData;

function optionsOf(field: FilterBarField | undefined): FilterBarOption[] | undefined {
  // Nothing to pick from (a project with no repositories yet) reads as no list: the value is typed.
  return Array.isArray(field?.suggestions) && field.suggestions.length > 0 ? field.suggestions : undefined;
}

/** A yes/no fact reads as "Author trust is [Trusted | Outside author]", whichever way the rule states it. */
export function BooleanValue({
  row,
  field,
  onChange,
}: {
  row: Row;
  field: FilterBarField;
  onChange: (row: Row) => void;
}) {
  const options = optionsOf(field) ?? [
    { value: 'true', label: 'Yes' },
    { value: 'false', label: 'No' },
  ];
  const yes = (row.operator !== 'not_equals') === (row.value !== false);
  return (
    <>
      <Txt as="span" variant="caption" tone="muted">
        is
      </Txt>
      <SegmentedControl
        size="sm"
        aria-label={field.label}
        value={String(yes)}
        onValueChange={value => onChange({ ...row, operator: 'equals', value: value === 'true' })}
      >
        {options.map(option => (
          <SegmentedControlItem key={option.value} value={option.value}>
            {option.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </>
  );
}

/** A fact only tested for being there reads as "Has pull request is [Yes | No]". */
export function PresenceValue({
  row,
  field,
  onChange,
}: {
  row: Row;
  field: FilterBarField;
  onChange: (row: Row) => void;
}) {
  return (
    <>
      <Txt as="span" variant="caption" tone="muted">
        is
      </Txt>
      <SegmentedControl
        size="sm"
        aria-label={field.label}
        value={row.operator === 'not_exists' ? 'false' : 'true'}
        onValueChange={value =>
          onChange({ ...row, operator: value === 'true' ? 'exists' : 'not_exists', value: undefined })
        }
      >
        <SegmentedControlItem value="true">Yes</SegmentedControlItem>
        <SegmentedControlItem value="false">No</SegmentedControlItem>
      </SegmentedControl>
    </>
  );
}

export function ValueControl({
  row,
  field,
  many,
  freeText: typed,
  placeholder,
  onChange,
}: {
  row: Row;
  field: FilterBarField;
  /** The test takes several values ("is any of"). */
  many: boolean;
  /** The test matches typed text ("contains"), so it takes a typed value even on an open field. */
  freeText: boolean;
  /** What a value typed for this field looks like, shown until one is typed. */
  placeholder: string | undefined;
  onChange: (row: Row) => void;
}) {
  const options = optionsOf(field);
  // An open field keeps one control while its suggestions load, so a value being typed isn't lost.
  if (field.strict === false && !typed) {
    const values = Array.isArray(row.value)
      ? row.value.map(String)
      : row.value === undefined
        ? []
        : [String(row.value)];
    return (
      <OpenValues
        options={(options ?? []).map(option => ({ value: option.value, label: option.label ?? option.value }))}
        values={values}
        many={many}
        placeholder={placeholder ?? 'Search or type a value'}
        onChange={next => onChange({ ...row, value: many ? next : next[0] })}
      />
    );
  }
  if (options && many) {
    const values = Array.isArray(row.value) ? row.value.map(String) : [];
    return (
      <ManyValues
        options={options.map(option => ({ value: option.value, label: option.label ?? option.value }))}
        values={values}
        onChange={next => onChange({ ...row, value: next })}
      />
    );
  }
  if (options) {
    const current = options.find(option => option.value === String(row.value ?? ''));
    return (
      <Select
        value={row.value === undefined ? null : String(row.value)}
        onValueChange={value => value !== null && onChange({ ...row, value })}
      >
        <SelectTrigger size="sm" aria-label="Value" className="w-fit">
          <Txt as="span" variant="caption" className="font-medium">
            {current?.label ?? (row.value === undefined ? 'Choose a value' : String(row.value))}
          </Txt>
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return <TextValue row={row} field={field} many={many} placeholder={placeholder} onChange={onChange} />;
}

type Choice = { value: string; label: string };

/** Reads values as a list ("Bug, Feature or Chore"); past three, the first two and how many more. */
function listSummary(labels: string[]): string {
  if (labels.length === 0) return 'Choose values';
  if (labels.length > 3) return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  const rest = labels.slice(0, -1);
  const last = labels.at(-1) ?? '';
  return rest.length === 0 ? last : `${rest.join(', ')} or ${last}`;
}

/** Picks several values; the trigger reads them as a list, not a count. */
function ManyValues({
  options,
  values,
  onChange,
}: {
  options: Choice[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  // A saved value the field no longer offers (a removed phase) still shows, and stays until unticked.
  const chosen = values.map(value => options.find(option => option.value === value) ?? { value, label: value });
  const items = [...options, ...chosen.filter(choice => !options.includes(choice))];
  const labels = chosen.map(option => option.label);
  return (
    <ComboboxRoot
      multiple
      autoHighlight
      items={items}
      value={chosen}
      itemToStringLabel={(option: Choice) => option.label}
      isItemEqualToValue={(option: Choice, value: Choice) => option.value === value.value}
      onValueChange={next => onChange(next.map(option => option.value))}
    >
      <ComboboxTrigger size="sm" aria-label="Values" title={labels.join(', ')} className="w-fit max-w-64">
        <Txt as="span" variant="caption" tone={labels.length === 0 ? 'muted' : undefined} className="font-medium">
          {listSummary(labels)}
        </Txt>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder="Search" />
        <ComboboxEmpty>No option found.</ComboboxEmpty>
        <ComboboxList>
          {(option: Choice) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

/**
 * Picks from suggestions or takes any typed value: "Use “acme/next”", listed after the suggestions it
 * matches, adds what was typed. One value, or
 * several for "is any of"; values the suggestions don't list still show, and stay until removed.
 */
function OpenValues({
  options,
  values,
  many,
  placeholder,
  onChange,
}: {
  options: Choice[];
  values: string[];
  many: boolean;
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const listed = (value: string) => options.some(option => option.value.toLowerCase() === value.toLowerCase());
  const chosen = values.map(value => options.find(option => option.value === value) ?? { value, label: value });
  // What was typed goes last, so Enter picks a suggestion it matches; alone, it's the only choice.
  const items = [
    ...options,
    ...chosen.filter(choice => !options.includes(choice)),
    ...(typed && !listed(typed) && !values.includes(typed) ? [{ value: typed, label: `Use “${typed}”` }] : []),
  ];
  const labels = chosen.map(choice => choice.value);
  const shared = {
    autoHighlight: true,
    items,
    inputValue: query,
    onInputValueChange: setQuery,
    itemToStringLabel: (option: Choice) => option.label,
    isItemEqualToValue: (option: Choice, value: Choice) => option.value === value.value,
  };
  const content = (
    <ComboboxContent>
      <ComboboxSearch placeholder={placeholder} />
      <ComboboxEmpty>Type a value to use it.</ComboboxEmpty>
      <ComboboxList>
        {(option: Choice) => (
          <ComboboxItem key={option.value} value={option}>
            {option.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  );
  const summary = (
    <Txt as="span" variant="caption" tone={labels.length === 0 ? 'muted' : undefined} className="font-medium">
      {labels.length === 0 ? placeholder : listSummary(labels)}
    </Txt>
  );
  if (many) {
    return (
      <ComboboxRoot
        {...shared}
        multiple
        value={chosen}
        onValueChange={next => onChange(next.map(option => option.value))}
      >
        <ComboboxTrigger size="sm" aria-label="Values" title={labels.join(', ')} className="w-fit max-w-64">
          {summary}
        </ComboboxTrigger>
        {content}
      </ComboboxRoot>
    );
  }
  return (
    <ComboboxRoot {...shared} value={chosen[0] ?? null} onValueChange={next => next && onChange([next.value])}>
      <ComboboxTrigger size="sm" aria-label="Value" title={labels[0]} className="w-fit max-w-64">
        {summary}
      </ComboboxTrigger>
      {content}
    </ComboboxRoot>
  );
}

function textOf(value: Row['value']): string {
  if (Array.isArray(value)) return value.join(', ');
  return value === undefined ? '' : String(value);
}

/** Typed values save on Enter or when the field loses focus; Escape puts back the saved value. */
function TextValue({
  row,
  field,
  many,
  placeholder,
  onChange,
}: {
  row: Row;
  field: FilterBarField;
  many: boolean;
  placeholder: string | undefined;
  onChange: (row: Row) => void;
}) {
  // What is being typed, shown as typed until the field is left; the value shows otherwise. Each keystroke
  // reports the value at once, so Save works without leaving the field first: clicking a disabled Save
  // doesn't move focus, so a value only reported on blur never got saved.
  const [draft, setDraft] = useState<string>();
  // The value from before this round of typing, which Escape puts back.
  const before = useRef<Row['value']>(undefined);
  const text = draft ?? textOf(row.value);
  const valueOf = (typed: string): Row['value'] => {
    if (many)
      return typed
        .split(',')
        .map(part => part.trim())
        .filter(part => part !== '');
    if (field.type !== 'number') return typed.trim();
    // A number left empty or unreadable stays unfinished rather than saving 0 or NaN.
    const number = Number(typed.trim());
    return typed.trim() !== '' && Number.isFinite(number) ? number : undefined;
  };
  const type = (typed: string) => {
    if (draft === undefined) before.current = row.value;
    setDraft(typed);
    onChange({ ...row, value: valueOf(typed) });
  };
  return (
    <Input
      size="sm"
      aria-label="Value"
      type={field.type === 'number' && !many ? 'number' : 'text'}
      placeholder={placeholder ?? (many ? 'Values, comma separated' : 'Value')}
      value={text}
      className="w-48"
      onChange={event => type(event.target.value)}
      onBlur={() => setDraft(undefined)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          setDraft(undefined);
        } else if (event.key === 'Escape' && draft !== undefined) {
          setDraft(undefined);
          onChange({ ...row, value: before.current });
        }
      }}
    />
  );
}
