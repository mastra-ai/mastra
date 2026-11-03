/* eslint-disable react-refresh/only-export-components */
import type { BaseUIEvent } from '@base-ui/react/types';
import { LockIcon, PencilIcon, SearchIcon, XIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationEvent, CSSProperties, ComponentProps, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { emptyValueFor, useFilterBarContext } from './filter-bar-context';
import { FilterBarOptionLabel, FilterBarOptionList } from './filter-bar-option-list';
import { matchesQueryFilter } from './match-query';
import type {
  DraftStage,
  FilterBarField,
  FilterBarFieldType,
  FilterBarItem,
  FilterBarOperator,
  FilterBarOption,
  FilterBarScalar,
  FilterBarSegment,
  FilterBarValue,
} from './types';
import { useFilterBarItemKeys } from './use-filter-bar-item-keys';
import { useValueStep } from './use-value-step';
import { getFieldSuggestions } from './use-value-suggestions';
import { Button } from '@/ds/components/Button/Button';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { Kbd } from '@/ds/components/Kbd/kbd';
import { iconSizeClasses } from '@/ds/icons/icon-size-classes';
import { controlIconOnly, controlIconState } from '@/ds/primitives/control-icon';
import { controlHeight, controlSpacing } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { inputSurfaceAndFocusWithinStyle } from '@/ds/primitives/form-element';
import './filter-bar-chip.css';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

export const FILTER_BAR_CONTROL_SIZE: ControlSize = 'sm';

// Base UI inserts children; the chip clips segment corners.
export const segmentClass = cn(
  'filter-bar-segment flex max-w-48 min-w-0 items-center gap-(--control-gap) overflow-hidden px-2 text-label whitespace-nowrap outline-none',
  iconSizeClasses[FILTER_BAR_CONTROL_SIZE],
  '[&>svg]:shrink-0',
);

// Base UI types omit keepHighlight, but its runtime honors it.
export const alwaysHighlightProps = { autoHighlight: 'always', keepHighlight: true } as unknown as {
  autoHighlight: boolean;
};

export const chipClass = cn(
  'filter-bar-chip relative flex max-w-full items-stretch divide-x divide-border overflow-hidden rounded-full p-px [--control-border:1px]',
  inputSurfaceAndFocusWithinStyle,
  controlHeight[FILTER_BAR_CONTROL_SIZE],
  controlSpacing[FILTER_BAR_CONTROL_SIZE],
);

export const editableSegmentClass = cn(
  segmentClass,
  controlIconState,
  'cursor-pointer hover:bg-fill-subtle hover:text-foreground',
  'focus-visible:bg-fill-hover focus-visible:text-foreground data-[popup-open]:bg-fill-hover data-[popup-open]:text-foreground',
);

export function FilterBarFieldLabel({ field, label }: { field: FilterBarField | undefined; label?: string }) {
  const Icon = field?.icon;
  return (
    <>
      {Icon && <Icon aria-hidden />}
      <span className="truncate">{label ?? field?.label}</span>
    </>
  );
}

type AccentStyle = CSSProperties & { '--control-icon-rest': string; '--control-icon-hover': string };

export const fieldSegmentAccentStyle = (field: FilterBarField | undefined): AccentStyle | undefined =>
  field?.color
    ? { color: field.color, '--control-icon-rest': field.color, '--control-icon-hover': field.color }
    : undefined;

const settledSegments = (from: DraftStage, operatorImplied: boolean): number => {
  if (from === 'none') return 0;
  if (from === 'field' || operatorImplied) return 1;
  return 2;
};

export const formatValue = (value: FilterBarValue, field: FilterBarField | undefined): string => {
  const suggestions = getFieldSuggestions(field);
  const options = Array.isArray(suggestions) ? suggestions : undefined;
  const label = (v: FilterBarScalar) => options?.find(o => o.value === String(v))?.label ?? String(v);
  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
};

const formatValueCompact = (value: FilterBarValue, field: FilterBarField | undefined): string => {
  if (!Array.isArray(value) || value.length < 2) return formatValue(value, field);
  return `${formatValue(value.slice(0, 1), field)} +${value.length - 1}`;
};

type ChipContext = {
  item: FilterBarItem;
  index: number;
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  openSegment: FilterBarSegment | null;
  setOpenSegment: (segment: FilterBarSegment | null) => void;
  readOnly: boolean;
  draft: boolean;
  leaving: boolean;
  operatorImplied: boolean;
};

const ChipContext = createContext<ChipContext | null>(null);
const useChip = () => {
  const chip = useContext(ChipContext);
  if (!chip) throw new Error('FilterBarChip segments must be rendered inside <FilterBarChip>.');
  return chip;
};

export type FilterBarChipProps = {
  item: FilterBarItem;
  readOnly?: boolean;
  removable?: boolean;
  draft?: boolean;
  className?: string;
  children?: ReactNode;
};

export function FilterBarChip({
  item,
  readOnly = false,
  removable = true,
  draft = false,
  className,
  children,
}: FilterBarChipProps) {
  const ctx = useFilterBarContext();
  const [initial] = useState(() => !ctx.mounted);
  const [openSegment, setOpenSegment] = useState<FilterBarSegment | null>(null);
  const field = ctx.getField(item.fieldId);
  const operator =
    (field && ctx.getFieldOperators(field).find(o => o.id === item.operatorId)) ?? ctx.getOperator(item.operatorId);
  const rootRef = useRef<HTMLDivElement>(null);
  const leaving = ctx.leaving.has(item.id);
  const { index, onKeyDown } = useFilterBarItemKeys({
    item,
    rootRef,
    pinned: !draft && (readOnly || !removable),
    removable,
    inert: readOnly || draft || leaving,
  });

  const { settleRemove } = ctx;

  useEffect(() => {
    const root = rootRef.current;
    if (!leaving || !root) return;
    const animations = typeof root.getAnimations === 'function' ? root.getAnimations({ subtree: true }) : [];
    if (animations.length === 0) {
      settleRemove(item.id);
      return;
    }
    let cancelled = false;
    Promise.all(animations.map(animation => animation.finished))
      .then(() => {
        if (!cancelled) settleRemove(item.id);
      })
      // Animations cancelled by an unmount reject `finished`; nothing left to settle.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leaving, item.id, settleRemove]);

  const operatorImplied = field ? ctx.getFieldOperators(field).length === 1 : false;
  const label = [
    field?.label ?? item.fieldId,
    operatorImplied ? '' : (operator?.label ?? item.operatorId),
    draft ? '' : formatValue(item.value, field),
  ]
    .filter(Boolean)
    .join(' ');

  const commit = !draft && ctx.lastCommit?.item.id === item.id ? ctx.lastCommit : null;
  const from = draft ? (ctx.draft?.from ?? 'none') : (commit?.from ?? 'none');
  const settled = settledSegments(from, operatorImplied);
  const shine = commit?.glint ?? false;

  const chipValue = useMemo<ChipContext>(
    () => ({ item, index, field, operator, openSegment, setOpenSegment, readOnly, draft, leaving, operatorImplied }),
    [item, index, field, operator, openSegment, readOnly, draft, leaving, operatorImplied],
  );
  const content = children ?? (
    <>
      <FilterBarChipField />
      <FilterBarChipOperator />
      <FilterBarChipValue />
      {removable && <FilterBarChipRemove />}
    </>
  );
  return (
    <ChipContext.Provider value={chipValue}>
      <div
        ref={rootRef}
        role="group"
        aria-label={label}
        aria-hidden={draft || leaving || undefined}
        data-slot="filter-bar-chip"
        data-draft={draft || undefined}
        data-initial={initial || undefined}
        data-readonly={readOnly || undefined}
        data-leaving={leaving || undefined}
        data-shine={(shine && !leaving) || undefined}
        className={cn(chipClass, leaving && 'pointer-events-none', className)}
        style={
          {
            '--filter-bar-segments-settled': settled,
            '--filter-bar-chip-shine': field?.color ?? 'currentColor',
          } as CSSProperties
        }
        onKeyDown={onKeyDown}
        onClick={(event: MouseEvent) => event.stopPropagation()}
        onAnimationEnd={(event: AnimationEvent) => {
          if (event.animationName === 'filter-bar-chip-shine') ctx.settleCommit();
        }}
      >
        {readOnly && (
          <span
            className={cn(segmentClass, 'pr-0 text-muted-foreground [--filter-bar-segment-padding:0.5rem_0]')}
            title="This filter is locked"
          >
            <LockIcon />
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
  fullLabel?: string;
  ariaLabel: string;
  items: readonly T[];
  itemToString: (item: T) => string;
  filter: null | ((item: T, query: string, itemToString?: (item: T) => string) => boolean);
  value?: T | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (item: T) => void;
  onOpen?: () => void;
  children: ReactNode;
};

const SegmentPopupContext = createContext<{ highlighted: unknown }>({ highlighted: null });

type SegmentSearchInputProps<T> = {
  placeholder: string;
  icon?: LucideIcon;
  inputMode?: ComponentProps<'input'>['inputMode'];
  onKeyDown?: (event: BaseUIEvent<KeyboardEvent<HTMLInputElement>>, highlighted: T | null) => void;
};

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
        {...passwordManagerOptOutProps}
        onKeyDown={event => onKeyDown?.(event, highlighted as T | null)}
      />
    </div>
  );
}

function SegmentCombobox<T>({
  segment,
  label,
  fullLabel = label,
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

  const isField = segment === 'field';
  const content = isField ? (
    <FilterBarFieldLabel field={chip.field} label={label} />
  ) : (
    <span className="truncate">{label}</span>
  );

  if (chip.readOnly || chip.draft || chip.leaving) {
    return (
      <span
        className={cn(segmentClass, isField && 'text-foreground')}
        style={isField ? fieldSegmentAccentStyle(chip.field) : undefined}
        title={fullLabel}
      >
        {content}
      </span>
    );
  }

  return (
    <ComboboxPrimitive.Root<T>
      items={items}
      itemToStringLabel={itemToString}
      itemToStringValue={itemToString}
      filter={filter}
      value={value}
      onValueChange={(item, details) => {
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
      {...alwaysHighlightProps}
      modal={false}
    >
      <ComboboxPrimitive.Trigger
        ref={el => ctx.registerSegment(chip.item.id, segment, el)}
        render={
          <button
            type="button"
            data-filter-bar-segment=""
            tabIndex={segment === 'value' ? 0 : -1}
            aria-label={`${ariaLabel}: ${fullLabel}`}
            title={fullLabel}
            className={cn(editableSegmentClass, isField && 'text-foreground')}
            style={isField ? fieldSegmentAccentStyle(chip.field) : undefined}
          />
        }
      >
        {content}
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal container={container}>
        <ComboboxPrimitive.Positioner
          align="start"
          sideOffset={MENU_SIDE_OFFSET}
          positionMethod={FLOATING_POSITION_METHOD}
          className={comboboxStyles.positioner}
        >
          <ComboboxPrimitive.Popup className={cn(comboboxStyles.popup, 'min-w-44')} data-slot="filter-bar-editor">
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
      <SegmentSearchInput placeholder="Change field" />
      <FilterBarOptionList<FilterBarField>
        aria-label="Fields"
        getKey={f => f.id}
        renderOption={f => <FilterBarFieldLabel field={f} />}
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
      <SegmentSearchInput placeholder="Change operator" />
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
    setQuery,
    onCommit,
  });

  const ValueInput = VALUE_INPUTS[chip.field?.type ?? 'text'];

  return (
    <SegmentCombobox<FilterBarOption>
      segment="value"
      ariaLabel="Value"
      label={formatValueCompact(chip.item.value, chip.field) || '…'}
      fullLabel={formatValue(chip.item.value, chip.field) || '…'}
      items={step.options}
      itemToString={optionLabel}
      filter={null}
      query={query}
      onQueryChange={setQuery}
      onSelect={step.handleSelect}
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

function ValueOptions({ step, onCancel }: ValueInputProps) {
  const chip = useChip();
  const modEnterLabel = useIsApplePlatform() ? '⌘↵' : 'Ctrl ↵';
  return (
    <>
      {step.hasOptions && (
        <FilterBarOptionList<FilterBarOption>
          aria-label="Values"
          aria-multiselectable={step.isMany || undefined}
          getKey={o => o.value}
          renderOption={option => <FilterBarOptionLabel option={option} />}
          isSelected={o => (step.isMany ? step.selected.includes(o.value) : String(chip.item.value) === o.value)}
          isLoading={step.isLoading}
          error={step.error}
          emptyText={step.allowFreeText ? 'No suggestions. Press Enter to use your text.' : 'No matching value.'}
        />
      )}
      {step.isMany && (
        <div className="flex items-center justify-end gap-1 border-t border-border p-1">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="default" onClick={() => step.commitDone()}>
            Done
            <Kbd size="xs">{modEnterLabel}</Kbd>
          </Button>
        </div>
      )}
    </>
  );
}

function freeTextPlaceholder(step: ValueInputProps['step'], noun: string) {
  if (!step.hasSuggestions) return `Type a ${noun}…`;
  if (step.allowFreeText) return `Search or type a ${noun}…`;
  return `Search ${noun}s…`;
}

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
        placeholder={freeTextPlaceholder(step, noun)}
        onKeyDown={(event, highlighted) => {
          const highlightedOption = step.hasSuggestions ? highlighted : null;
          const handled = step.handleKeyDown(event, highlightedOption);
          // Base UI submits on Enter without a highlight.
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
  const chip = useChip();
  if (chip.operatorImplied) return null;
  if (chip.draft && !chip.operator) return null;
  return <OperatorEditor />;
}

export function FilterBarChipValue() {
  const chip = useChip();
  if (chip.draft || (chip.operator?.arity ?? 'one') === 'none') return null;
  return <ValueEditor />;
}

export const removeSegmentClass = cn(
  editableSegmentClass,
  controlIconOnly,
  'filter-bar-segment-remove px-1.5 text-muted-foreground [--filter-bar-segment-padding:0.375rem]',
);

export function FilterBarChipRemove() {
  const ctx = useFilterBarContext();
  const chip = useChip();
  if (chip.readOnly || chip.draft) return null;
  if (chip.leaving) {
    return (
      <span className={removeSegmentClass}>
        <XIcon />
      </span>
    );
  }
  const label = `Remove ${chip.field?.label ?? chip.item.fieldId} filter`;
  return (
    <button
      type="button"
      data-filter-bar-segment=""
      tabIndex={-1}
      aria-label={label}
      title={label}
      ref={el => ctx.registerSegment(chip.item.id, 'remove', el)}
      className={removeSegmentClass}
      onClick={() => {
        ctx.removeItem(chip.item.id);
        ctx.focusAfterRemove(chip.index);
      }}
    >
      <XIcon />
    </button>
  );
}

FilterBarChip.Field = FilterBarChipField;
FilterBarChip.Operator = FilterBarChipOperator;
FilterBarChip.Value = FilterBarChipValue;
FilterBarChip.Remove = FilterBarChipRemove;
