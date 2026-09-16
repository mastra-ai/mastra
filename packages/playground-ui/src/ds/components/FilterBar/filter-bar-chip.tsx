/* eslint-disable react-refresh/only-export-components */
import { LockIcon, SearchIcon, XIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { emptyValueFor, useFilterBarContext } from './filter-bar-context';
import { FilterBarListbox } from './filter-bar-listbox';
import type { FilterBarField, FilterBarItem, FilterBarOperator, FilterBarSegment } from './types';
import { useListbox } from './use-listbox';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover/popover';
import { MENU_SIDE_OFFSET, menuPopupClass, menuSearchClasses } from '@/ds/primitives/menu-item';
import { cn } from '@/lib/utils';

const segmentClass = cn(
  'flex max-w-48 min-w-0 items-center gap-1 px-2 text-ui-sm leading-ui-sm whitespace-nowrap outline-none',
  'first:rounded-l-full last:rounded-r-full',
);

const editableSegmentClass = cn(
  segmentClass,
  'cursor-pointer transition-colors hover:bg-neutral6/5 hover:text-neutral6',
  'focus-visible:bg-neutral6/10 focus-visible:text-neutral6 data-[popup-open]:bg-neutral6/10 data-[popup-open]:text-neutral6',
);

export const formatValue = (value: string | string[], field: FilterBarField | undefined): string => {
  const options = Array.isArray(field?.suggestions) ? field.suggestions : undefined;
  const label = (v: string) => options?.find(o => o.value === v)?.label ?? v;
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

// Ref pass-through so editors can hand their search input to the popover's initialFocus.
const SearchRefContext = createContext<RefObject<HTMLInputElement | null> | null>(null);
const useSearchRef = () => useContext(SearchRefContext);

export type FilterBarChipProps = {
  item: FilterBarItem;
  /** Locked chip: plain labels, no editors, no remove button. */
  readOnly?: boolean;
  className?: string;
  /** Custom segment composition; defaults to Field · Operator · Value · Remove. */
  children?: ReactNode;
};

function isInsidePopup(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-slot="popover-content"]'));
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

type SegmentPopoverProps = {
  segment: Exclude<FilterBarSegment, 'remove'>;
  label: string;
  ariaLabel: string;
  children: (close: () => void) => ReactNode;
};

function SegmentPopover({ segment, label, ariaLabel, children }: SegmentPopoverProps) {
  const ctx = useFilterBarContext();
  const chip = useChip();
  const open = chip.openSegment === segment;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => chip.setOpenSegment(null), [chip]);

  if (chip.readOnly) {
    return (
      <span className={cn(segmentClass, segment === 'field' && 'text-neutral6')} title={label}>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={next => chip.setOpenSegment(next ? segment : null)}>
      <PopoverTrigger
        ref={el => {
          triggerRef.current = el;
          ctx.registerSegment(chip.item.id, segment, el);
        }}
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
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        className={cn(menuPopupClass, 'w-56')}
        initialFocus={searchRef}
      >
        <SearchRefContext.Provider value={searchRef}>{children(close)}</SearchRefContext.Provider>
      </PopoverContent>
    </Popover>
  );
}

function EditorSearch({
  value,
  onChange,
  onKeyDown,
  placeholder,
  listboxId,
  activeDescendant,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  listboxId?: string;
  activeDescendant?: string;
}) {
  const searchRef = useSearchRef();
  return (
    <div className={menuSearchClasses.container}>
      <SearchIcon className={menuSearchClasses.icon} />
      <input
        ref={searchRef ?? undefined}
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        autoComplete="off"
        className={menuSearchClasses.input}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

function FieldEditor({ close }: { close: () => void }) {
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
      close();
    },
    [ctx, chip, close],
  );

  const listbox = useListbox({ options: ctx.fields, getLabel: f => f.label, query, onSelect });

  return (
    <>
      <EditorSearch
        value={query}
        onChange={setQuery}
        onKeyDown={e => listbox.handleKeyDown(e)}
        placeholder="Change field…"
        listboxId={listbox.listboxId}
        activeDescendant={listbox.activeDescendant}
      />
      <FilterBarListbox
        listbox={listbox}
        aria-label="Fields"
        getKey={f => f.id}
        renderOption={f => f.label}
        isSelected={f => f.id === chip.item.fieldId}
        onSelect={onSelect}
        emptyText="No matching field."
      />
    </>
  );
}

function OperatorEditor({ close }: { close: () => void }) {
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
      close();
    },
    [ctx, chip, close],
  );

  const listbox = useListbox({ options, getLabel: o => o.label, query, onSelect });

  return (
    <>
      <EditorSearch
        value={query}
        onChange={setQuery}
        onKeyDown={e => listbox.handleKeyDown(e)}
        placeholder="Change operator…"
        listboxId={listbox.listboxId}
        activeDescendant={listbox.activeDescendant}
      />
      <FilterBarListbox
        listbox={listbox}
        aria-label="Operators"
        getKey={o => o.id}
        renderOption={o => o.label}
        isSelected={o => o.id === chip.item.operatorId}
        onSelect={onSelect}
        emptyText="No matching operator."
      />
    </>
  );
}

function ValueEditor({ close }: { close: () => void }) {
  const ctx = useFilterBarContext();
  const chip = useChip();
  // Prefill free-text values only; with suggestions, the current value is shown as checked instead.
  const [query, setQuery] = useState(() =>
    typeof chip.item.value === 'string' && !chip.field?.suggestions ? chip.item.value : '',
  );

  const onCommit = useCallback(
    (value: string | string[]) => {
      ctx.updateItem(chip.item.id, { value });
      close();
    },
    [ctx, chip.item.id, close],
  );

  const step = useValueStep({
    field: chip.field,
    operator: chip.operator,
    query,
    enabled: true,
    initialValue: chip.item.value,
    onCommit,
  });

  const placeholder = step.hasSuggestions
    ? step.allowFreeText
      ? 'Search or type a value…'
      : 'Search values…'
    : 'Type a value…';

  return (
    <>
      <EditorSearch
        value={query}
        onChange={setQuery}
        onKeyDown={e => step.handleKeyDown(e)}
        placeholder={placeholder}
        listboxId={step.hasSuggestions ? step.listbox.listboxId : undefined}
        activeDescendant={step.hasSuggestions ? step.listbox.activeDescendant : undefined}
      />
      {step.hasSuggestions && (
        <FilterBarListbox
          listbox={step.listbox}
          aria-label="Values"
          aria-multiselectable={step.isMany || undefined}
          getKey={o => o.value}
          renderOption={o => o.label ?? o.value}
          isSelected={o => (step.isMany ? step.selected.includes(o.value) : chip.item.value === o.value)}
          onSelect={step.handleSelect}
          isLoading={step.isLoading}
          error={step.error}
          emptyText={step.allowFreeText ? 'No suggestions — press Enter to use your text.' : 'No matching value.'}
        />
      )}
      {step.isMany && (
        <div className="border-border1 flex items-center justify-end gap-1 border-t p-1">
          <Button size="xs" variant="ghost" onClick={close}>
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

export function FilterBarChipField() {
  const chip = useChip();
  return (
    <SegmentPopover segment="field" ariaLabel="Field" label={chip.field?.label ?? chip.item.fieldId}>
      {close => <FieldEditor close={close} />}
    </SegmentPopover>
  );
}

export function FilterBarChipOperator() {
  const chip = useChip();
  return (
    <SegmentPopover segment="operator" ariaLabel="Operator" label={chip.operator?.label ?? chip.item.operatorId}>
      {close => <OperatorEditor close={close} />}
    </SegmentPopover>
  );
}

export function FilterBarChipValue() {
  const chip = useChip();
  if ((chip.operator?.arity ?? 'one') === 'none') return null;
  const text = formatValue(chip.item.value, chip.field);
  return (
    <SegmentPopover segment="value" ariaLabel="Value" label={text || '…'}>
      {close => <ValueEditor close={close} />}
    </SegmentPopover>
  );
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
