/* eslint-disable react-refresh/only-export-components */
import type { BaseUIEvent } from '@base-ui/react/types';
import { LockIcon, PencilIcon, SearchIcon, XIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { emptyValueFor, useFilterBarContext } from './filter-bar-context';
import { FilterBarOptionList } from './filter-bar-option-list';
import { matchesQueryFilter } from './match-query';
import type {
  FilterBarField,
  FilterBarFieldType,
  FilterBarItem,
  FilterBarOperator,
  FilterBarOption,
  FilterBarScalar,
  FilterBarSegment,
  FilterBarValue,
} from './types';
import { useValueStep } from './use-value-step';
import { getFieldSuggestions } from './use-value-suggestions';
import { Button } from '@/ds/components/Button/Button';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

export const segmentClass = cn(
  'flex max-w-48 min-w-0 items-center gap-1 px-2 text-ui-sm leading-ui-sm whitespace-nowrap outline-none',
  'first:rounded-l-full last:rounded-r-full',
);

const editableSegmentClass = cn(
  segmentClass,
  'cursor-pointer transition-colors hover:bg-neutral6/5 hover:text-neutral6',
  'focus-visible:bg-neutral6/10 focus-visible:text-neutral6 data-[popup-open]:bg-neutral6/10 data-[popup-open]:text-neutral6',
);

export const formatValue = (value: FilterBarValue, field: FilterBarField | undefined): string => {
  const suggestions = getFieldSuggestions(field);
  const options = Array.isArray(suggestions) ? suggestions : undefined;
  const label = (v: FilterBarScalar) => options?.find(o => o.value === String(v))?.label ?? String(v);
  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
};

type ChipContext = {
  item: FilterBarItem;
  index: number;
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  openSegment: FilterBarSegment | null;
  setOpenSegment: (segment: FilterBarSegment | null) => void;
  readOnly: boolean;
};

const ChipContext = createContext<ChipContext | null>(null);
const useChip = () => {
  const chip = useContext(ChipContext);
  if (!chip) throw new Error('FilterBarChip segments must be rendered inside <FilterBarChip>.');
  return chip;
};

export type FilterBarChipProps = {
  item: FilterBarItem;
  /** Locked chip: plain labels, no editors, no remove button. */
  readOnly?: boolean;
  className?: string;
  /** Custom segment composition; defaults to Field · Operator · Value · Remove. */
  children?: ReactNode;
};

function isInsidePopup(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-slot="filter-bar-editor"]'));
}

export function FilterBarChip({ item, readOnly = false, className, children }: FilterBarChipProps) {
  const ctx = useFilterBarContext();
  const [openSegment, setOpenSegment] = useState<FilterBarSegment | null>(null);
  const field = ctx.getField(item.fieldId);
  const operator = ctx.getOperator(item.operatorId);
  const index = ctx.items.findIndex(i => i.id === item.id);
  const rootRef = useRef<HTMLDivElement>(null);

  const label = [field?.label ?? item.fieldId, operator?.label ?? item.operatorId, formatValue(item.value, field)]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly || isInsidePopup(event.target)) return;
      const segments = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-filter-bar-segment]') ?? []);
      const current = segments.findIndex(el => el === event.target);

      switch (event.key) {
        case 'ArrowRight': {
          event.preventDefault();
          const next = segments[current + 1];
          if (next) next.focus();
          else if (!ctx.focusChip(index + 1, 1, 'field')) ctx.focusInput();
          return;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          const prev = segments[current - 1];
          if (prev) prev.focus();
          else ctx.focusChip(index - 1, -1, 'remove');
          return;
        }
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          ctx.removeItem(item.id);
          ctx.focusAfterRemove(index);
          return;
        default:
      }
    },
    [readOnly, ctx, index, item.id],
  );

  const chipValue = useMemo<ChipContext>(
    () => ({ item, index, field, operator, openSegment, setOpenSegment, readOnly }),
    [item, index, field, operator, openSegment, readOnly],
  );
  const content = children ?? (
    <>
      <FilterBarChipField />
      <FilterBarChipOperator />
      <FilterBarChipValue />
      <FilterBarChipRemove />
    </>
  );
  return (
    <ChipContext.Provider value={chipValue}>
      <div
        ref={rootRef}
        role="group"
        aria-label={label}
        data-slot="filter-bar-chip"
        data-readonly={readOnly || undefined}
        className={cn(
          'flex h-form-sm max-w-full items-stretch divide-x divide-border1 rounded-full border border-border1 bg-surface3 text-neutral5',
          className,
        )}
        onKeyDown={handleKeyDown}
        onClick={(event: MouseEvent) => event.stopPropagation()}
      >
        {readOnly && (
          <span className={cn(segmentClass, 'pr-0 text-neutral3')} title="This filter is locked">
            <LockIcon className="size-[1.1em]" />
          </span>
        )}
        {content}
      </div>
    </ChipContext.Provider>
  );
}

type SegmentComboboxProps<T> = {
  segment: Exclude<FilterBarSegment, 'remove'>;
  label: string;
  ariaLabel: string;
  items: readonly T[];
  itemToString: (item: T) => string;
  /** `null` when `items` are already filtered. */
  filter: null | ((item: T, query: string, itemToString?: (item: T) => string) => boolean);
  /** Current selection, surfaced through Base UI's `ItemIndicator`. */
  value?: T | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (item: T) => void;
  onOpen?: () => void;
  /** Popup content: typically a `SegmentSearchInput` followed by a `FilterBarOptionList`. */
  children: ReactNode;
};

// Highlighted item of the enclosing SegmentCombobox, for popup inputs that route Enter.
const SegmentPopupContext = createContext<{ highlighted: unknown }>({ highlighted: null });

type SegmentSearchInputProps<T> = {
  placeholder: string;
  /** Leading icon. Defaults to a search glass; free-text editing uses a pencil. */
  icon?: LucideIcon;
  inputMode?: ComponentProps<'input'>['inputMode'];
  onKeyDown?: (event: BaseUIEvent<KeyboardEvent<HTMLInputElement>>, highlighted: T | null) => void;
};

/** The search/free-text input at the top of a segment popup. */
function SegmentSearchInput<T>({
  placeholder,
  icon: Icon = SearchIcon,
  inputMode,
  onKeyDown,
}: SegmentSearchInputProps<T>) {
  const { highlighted } = useContext(SegmentPopupContext);
  return (
    <div className={comboboxStyles.searchContainer}>
      <Icon className={comboboxStyles.searchIcon} />
      <ComboboxPrimitive.Input
        className={comboboxStyles.searchInput}
        placeholder={placeholder}
        inputMode={inputMode}
        onKeyDown={event => onKeyDown?.(event, highlighted as T | null)}
      />
    </div>
  );
}

/**
 * A chip segment: a button trigger that opens an option popup. The editor
 * owning the segment supplies items, filtering, selection routing and the
 * popup content.
 */
function SegmentCombobox<T>({
  segment,
  label,
  ariaLabel,
  items,
  itemToString,
  filter,
  value = null,
  query,
  onQueryChange,
  onSelect,
  onOpen,
  children,
}: SegmentComboboxProps<T>) {
  const ctx = useFilterBarContext();
  const chip = useChip();
  const container = usePortalContainer();
  const open = chip.openSegment === segment;
  const [highlighted, setHighlighted] = useState<T | null>(null);

  if (chip.readOnly) {
    return (
      <span className={cn(segmentClass, segment === 'field' && 'text-neutral6')} title={label}>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <ComboboxPrimitive.Root<T>
      items={items}
      itemToStringLabel={itemToString}
      filter={filter}
      value={value}
      onValueChange={(item, details) => {
        // The editor decides what a pick means (and when to close); Base UI must not keep it.
        details.cancel();
        if (item !== null) onSelect(item);
      }}
      inputValue={query}
      onInputValueChange={(next, details) => {
        if (details.reason === 'input-change') onQueryChange(next);
      }}
      onItemHighlighted={item => setHighlighted(item ?? null)}
      open={open}
      onOpenChange={next => {
        if (next) onOpen?.();
        else onQueryChange('');
        chip.setOpenSegment(next ? segment : null);
      }}
      // See FilterBarInput: the runtime supports 'always' although ComboboxRoot types it as boolean.
      autoHighlight={'always' as unknown as boolean}
      modal={false}
    >
      <ComboboxPrimitive.Trigger
        ref={el => ctx.registerSegment(chip.item.id, segment, el)}
        render={
          <button
            type="button"
            data-filter-bar-segment=""
            tabIndex={segment === 'value' ? 0 : -1}
            aria-label={`${ariaLabel}: ${label}`}
            title={label}
            className={cn(editableSegmentClass, segment === 'field' && 'text-neutral6')}
          />
        }
      >
        <span className="truncate">{label}</span>
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal container={container}>
        <ComboboxPrimitive.Positioner
          align="start"
          sideOffset={MENU_SIDE_OFFSET}
          positionMethod={FLOATING_POSITION_METHOD}
          className={comboboxStyles.positioner}
        >
          <ComboboxPrimitive.Popup className={cn(comboboxStyles.popup, 'w-56')} data-slot="filter-bar-editor">
            <SegmentPopupContext.Provider value={{ highlighted }}>{children}</SegmentPopupContext.Provider>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

const fieldLabel = (field: FilterBarField) => field.label;
const operatorLabel = (operator: FilterBarOperator) => operator.label;
const optionLabel = (option: FilterBarOption) => option.label ?? option.value;

function FieldEditor() {
  const ctx = useFilterBarContext();
  const chip = useChip();
  const [query, setQuery] = useState('');

  const onSelect = useCallback(
    (field: FilterBarField) => {
      const allowed = ctx.getFieldOperators(field);
      const nextOperator = allowed.find(o => o.id === chip.item.operatorId) ?? allowed[0];
      const arityChanged = nextOperator?.arity !== chip.operator?.arity;
      ctx.updateItem(chip.item.id, {
        fieldId: field.id,
        operatorId: nextOperator?.id ?? chip.item.operatorId,
        value: arityChanged || field.id !== chip.item.fieldId ? emptyValueFor(nextOperator) : chip.item.value,
      });
      chip.setOpenSegment(null);
    },
    [ctx, chip],
  );

  return (
    <SegmentCombobox<FilterBarField>
      segment="field"
      ariaLabel="Field"
      label={chip.field?.label ?? chip.item.fieldId}
      items={ctx.fields}
      itemToString={fieldLabel}
      filter={matchesQueryFilter}
      value={chip.field}
      query={query}
      onQueryChange={setQuery}
      onSelect={onSelect}
    >
      <SegmentSearchInput placeholder="Change field…" />
      <FilterBarOptionList<FilterBarField>
        aria-label="Fields"
        getKey={f => f.id}
        renderOption={f => f.label}
        emptyText="No matching field."
      />
    </SegmentCombobox>
  );
}

function OperatorEditor() {
  const ctx = useFilterBarContext();
  const chip = useChip();
  const [query, setQuery] = useState('');
  const options = useMemo(() => (chip.field ? ctx.getFieldOperators(chip.field) : ctx.operators), [ctx, chip.field]);

  const onSelect = useCallback(
    (operator: FilterBarOperator) => {
      const arityChanged = (operator.arity ?? 'one') !== (chip.operator?.arity ?? 'one');
      ctx.updateItem(chip.item.id, {
        operatorId: operator.id,
        value: arityChanged ? emptyValueFor(operator) : chip.item.value,
      });
      chip.setOpenSegment(null);
    },
    [ctx, chip],
  );

  return (
    <SegmentCombobox<FilterBarOperator>
      segment="operator"
      ariaLabel="Operator"
      label={chip.operator?.label ?? chip.item.operatorId}
      items={options}
      itemToString={operatorLabel}
      filter={matchesQueryFilter}
      value={chip.operator}
      query={query}
      onQueryChange={setQuery}
      onSelect={onSelect}
    >
      <SegmentSearchInput placeholder="Change operator…" />
      <FilterBarOptionList<FilterBarOperator>
        aria-label="Operators"
        getKey={o => o.id}
        renderOption={o => o.label}
        emptyText="No matching operator."
      />
    </SegmentCombobox>
  );
}

function ValueEditor() {
  const ctx = useFilterBarContext();
  const chip = useChip();
  const open = chip.openSegment === 'value';
  const [query, setQuery] = useState('');

  const close = useCallback(() => chip.setOpenSegment(null), [chip]);
  const onCommit = useCallback(
    (value: FilterBarValue) => {
      ctx.updateItem(chip.item.id, { value });
      close();
    },
    [ctx, chip.item.id, close],
  );

  const step = useValueStep({
    field: chip.field,
    operator: chip.operator,
    query,
    enabled: open,
    initialValue: chip.item.value,
    onCommit,
  });

  const ValueInput = VALUE_INPUTS[chip.field?.type ?? 'text'];

  return (
    <SegmentCombobox<FilterBarOption>
      segment="value"
      ariaLabel="Value"
      label={formatValue(chip.item.value, chip.field) || '…'}
      items={step.options}
      itemToString={optionLabel}
      filter={null}
      query={query}
      onQueryChange={setQuery}
      onSelect={step.handleSelect}
      // Prefill free-text values only; with suggestions, the current value is shown as checked instead.
      onOpen={() =>
        setQuery(!Array.isArray(chip.item.value) && !chip.field?.suggestions ? String(chip.item.value) : '')
      }
    >
      <ValueInput step={step} onCancel={close} />
    </SegmentCombobox>
  );
}

type ValueInputProps = {
  step: ReturnType<typeof useValueStep>;
  onCancel: () => void;
};

/** Suggestion list + multi-select footer, shared by every value input. */
function ValueOptions({ step, onCancel }: ValueInputProps) {
  const chip = useChip();
  return (
    <>
      {step.hasSuggestions && (
        <FilterBarOptionList<FilterBarOption>
          aria-label="Values"
          aria-multiselectable={step.isMany || undefined}
          getKey={o => o.value}
          renderOption={o => o.label ?? o.value}
          isSelected={o => (step.isMany ? step.selected.includes(o.value) : String(chip.item.value) === o.value)}
          isLoading={step.isLoading}
          error={step.error}
          emptyText={step.allowFreeText ? 'No suggestions — press Enter to use your text.' : 'No matching value.'}
        />
      )}
      {step.isMany && (
        <div className="border-border1 flex items-center justify-end gap-1 border-t p-1">
          <Button size="xs" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="xs" variant="primary" onClick={() => step.commitSelection() || step.commitFreeText()}>
            Done
          </Button>
        </div>
      )}
    </>
  );
}

/** Free-text (optionally suggestion-backed) value input; text and number share it. */
function FreeTextValueInput({
  step,
  onCancel,
  inputMode,
  noun,
}: ValueInputProps & { inputMode?: ComponentProps<'input'>['inputMode']; noun: string }) {
  return (
    <>
      <SegmentSearchInput<FilterBarOption>
        icon={step.hasSuggestions ? SearchIcon : PencilIcon}
        inputMode={inputMode}
        placeholder={
          step.hasSuggestions
            ? step.allowFreeText
              ? `Search or type a ${noun}…`
              : `Search ${noun}s…`
            : `Type a ${noun}…`
        }
        onKeyDown={(event, highlighted) => {
          const highlightedOption = step.hasSuggestions ? highlighted : null;
          const handled = step.handleKeyDown(event, highlightedOption);
          // Base UI closes on Enter when nothing is highlighted; a rejected free-text value must keep the editor open.
          if (handled || (event.key === 'Enter' && highlightedOption === null)) event.preventBaseUIHandler();
        }}
      />
      <ValueOptions step={step} onCancel={onCancel} />
    </>
  );
}

function TextValueInput(props: ValueInputProps) {
  return <FreeTextValueInput {...props} noun="value" />;
}

function NumberValueInput(props: ValueInputProps) {
  return <FreeTextValueInput {...props} inputMode="decimal" noun="number" />;
}

/** Select-like: no search input, just the True/False (or custom) options. */
function BooleanValueInput(props: ValueInputProps) {
  return <ValueOptions {...props} />;
}

const VALUE_INPUTS: Record<FilterBarFieldType, (props: ValueInputProps) => ReactNode> = {
  text: TextValueInput,
  number: NumberValueInput,
  boolean: BooleanValueInput,
};

export function FilterBarChipField() {
  return <FieldEditor />;
}

export function FilterBarChipOperator() {
  return <OperatorEditor />;
}

export function FilterBarChipValue() {
  const chip = useChip();
  if ((chip.operator?.arity ?? 'one') === 'none') return null;
  return <ValueEditor />;
}

export function FilterBarChipRemove() {
  const ctx = useFilterBarContext();
  const chip = useChip();
  if (chip.readOnly) return null;
  const label = `Remove ${chip.field?.label ?? chip.item.fieldId} filter`;
  return (
    <button
      type="button"
      data-filter-bar-segment=""
      tabIndex={-1}
      aria-label={label}
      title={label}
      ref={el => ctx.registerSegment(chip.item.id, 'remove', el)}
      className={cn(editableSegmentClass, 'px-1.5 text-neutral3')}
      onClick={() => {
        ctx.removeItem(chip.item.id);
        ctx.focusAfterRemove(chip.index);
      }}
    >
      <XIcon className="size-[1.1em]" />
    </button>
  );
}

FilterBarChip.Field = FilterBarChipField;
FilterBarChip.Operator = FilterBarChipOperator;
FilterBarChip.Value = FilterBarChipValue;
FilterBarChip.Remove = FilterBarChipRemove;
