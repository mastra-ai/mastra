import type { BaseUIEvent } from '@base-ui/react/types';
import { BracesIcon, ListFilterIcon, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { FILTER_BAR_CONTROL_SIZE, FilterBarFieldLabel } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarOptionList } from './filter-bar-option-list';
import { findGroup } from './filter-bar-tree';
import { matchesQueryFilter } from './match-query';
import type { FilterBarField, FilterBarOperator, FilterBarOption, FilterBarValue } from './types';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { comboboxTriggerClass } from '@/ds/components/Combobox/combobox-styles';
import { Kbd } from '@/ds/components/Kbd/kbd';
import { Txt } from '@/ds/components/Txt';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { inputFocusBorderWithin, unstyledFormElementStyle } from '@/ds/primitives/form-element';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

type Step = 'field' | 'operator' | 'value';

type Item = FilterBarField | FilterBarOperator | FilterBarOption;

const getItemLabel = (item: Item) => ('label' in item && item.label ? item.label : 'value' in item ? item.value : '');

/** Pinned last entry of the field list that spawns an advanced filter (an `or` group) instead of a filter. */
const ADVANCED_FIELD_ID = '__filter-bar-advanced__';
const ADVANCED_FIELD: FilterBarField = {
  id: ADVANCED_FIELD_ID,
  label: 'Advanced filter…',
  icon: BracesIcon,
  operators: [],
};

export type FilterBarInputProps = {
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /**
   * Group this instance commits into; omit for the bar's own input. Only the instance whose
   * `groupId` matches the provider's `inputTarget` renders, so a single input is ever mounted.
   */
  groupId?: string;
  /** Called when Escape is pressed on an empty query inside a group, after the input hands back to the bar. */
  onLeave?: () => void;
};

/**
 * Typeahead entry point: type to pick a field, then an operator, then a value.
 * Focus never leaves the input; the popup is driven with the arrow keys.
 */
export function FilterBarInput(props: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  if (ctx.inputTarget !== props.groupId) return null;
  return <FilterBarInputImpl {...props} />;
}

function FilterBarInputImpl({
  placeholder = 'Filter…',
  className,
  'aria-label': ariaLabel = 'Add filter',
  groupId,
  onLeave,
}: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  const container = usePortalContainer();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState<Item | null>(null);
  const modEnterLabel = useIsApplePlatform() ? '⌘↵' : 'Ctrl ↵';

  // The draft lives in the provider so the chip list can render it; the step follows from it.
  const { draft, setDraft, commitDraft } = ctx;
  const step: Step = !draft ? 'field' : !draft.operatorId ? 'operator' : 'value';
  const field = draft ? ctx.getField(draft.fieldId) : undefined;
  const operator = draft?.operatorId ? ctx.getOperator(draft.operatorId) : undefined;
  const fieldOperators = useMemo(() => (field ? ctx.getFieldOperators(field) : []), [ctx, field]);
  // The advanced option lives in the bar only; inside a popover, nesting is the editor's `+ Group`.
  const offerAdvanced = ctx.groupsEnabled && groupId === undefined;
  const visibleFields = useMemo(() => {
    const fields = ctx.fields.filter(f => !f.hidden);
    return offerAdvanced ? [...fields, ADVANCED_FIELD] : fields;
  }, [ctx.fields, offerAdvanced]);
  const targetGroup = groupId ? findGroup(ctx.expression, groupId) : undefined;

  // A group's input mounts on demand (see `openGroupInput`) and takes focus itself.
  useEffect(() => {
    if (groupId) inputRef.current?.focus();
  }, [groupId]);

  const reset = useCallback(() => {
    setDraft(null);
    setQuery('');
  }, [setDraft]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const commit = useCallback(
    (fieldId: string, operatorId: string, value: FilterBarValue) => {
      commitDraft({ fieldId, operatorId }, value);
      setQuery('');
      inputRef.current?.focus();
    },
    [commitDraft],
  );

  const selectOperator = useCallback(
    (fieldId: string, next: FilterBarOperator) => {
      if (next.arity === 'none') {
        commit(fieldId, next.id, '');
        return;
      }
      setDraft({ fieldId, operatorId: next.id });
      setQuery('');
    },
    [commit, setDraft],
  );

  const selectField = useCallback(
    (next: FilterBarField) => {
      if (next.id === ADVANCED_FIELD_ID) {
        // `or` is the useful default: an `and` group is indistinguishable from the root.
        const id = ctx.addGroup(undefined, 'or');
        ctx.setOpenGroup(id);
        ctx.openGroupInput(id);
        setQuery('');
        setOpen(false);
        return;
      }
      // A single allowed operator is implied: skip straight to the value step.
      const [only, ...rest] = ctx.getFieldOperators(next);
      if (only && rest.length === 0) {
        selectOperator(next.id, only);
        return;
      }
      setDraft({ fieldId: next.id });
      setQuery('');
    },
    [ctx, selectOperator, setDraft],
  );

  const valueStep = useValueStep({
    field,
    operator,
    query,
    enabled: open && step === 'value',
    onCommit: value => {
      if (draft?.operatorId) commit(draft.fieldId, draft.operatorId, value);
    },
  });

  // Leaving a group's input hands the target back to the bar; empty groups are pruned when the
  // popover closes, never here.
  const leaveGroup = useCallback(() => {
    if (!groupId) return false;
    ctx.openGroupInput(undefined);
    onLeave?.();
    return true;
  }, [ctx, groupId, onLeave]);

  const stepBack = useCallback(() => {
    if (step === 'value' && draft) {
      // Back to the field step when the operator was implied (single operator).
      const skipOperator = field ? fieldOperators.length === 1 : false;
      setDraft(skipOperator ? null : { fieldId: draft.fieldId });
    } else if (step === 'operator') setDraft(null);
    else if (!leaveGroup()) setOpen(false);
    setQuery('');
  }, [step, draft, field, fieldOperators, setDraft, leaveGroup]);

  // Selection is routed per step and never kept by Base UI (`value` stays null).
  const handleSelect = (item: Item) => {
    if (step === 'field') selectField(item as FilterBarField);
    else if (step === 'operator' && draft) selectOperator(draft.fieldId, item as FilterBarOperator);
    else valueStep.handleSelect(item as FilterBarOption);
  };

  // App-level keys run before Base UI's own input handling.
  const handleKeyDown = (event: BaseUIEvent<KeyboardEvent<HTMLInputElement>>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Consumed here: an enclosing popover (advanced filter) must not close on it.
      event.stopPropagation();
      event.preventBaseUIHandler();
      stepBack();
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault();
      event.preventBaseUIHandler();
      setOpen(true);
      return;
    }
    if (query === '') {
      if (event.key === 'Backspace') {
        event.preventDefault();
        event.preventBaseUIHandler();
        if (step !== 'field') stepBack();
        else if (targetGroup) {
          // Inside a group: eat its last chip, or drop the group once it is empty.
          const last = targetGroup.nodes.findLast(node => !ctx.leaving.has(node.id));
          if (last) ctx.removeItem(last.id);
          else leaveGroup();
        } else {
          // Chips still animating out are already gone from the value: skip them.
          const last = ctx.items.findLast(item => !ctx.leaving.has(item.id));
          if (last) ctx.removeItem(last.id);
        }
        return;
      }
      if (event.key === 'ArrowLeft' && step === 'field') {
        if (ctx.focusChip(ctx.items.length - 1, -1, 'remove')) event.preventDefault();
        return;
      }
    }
    if (!open) return;

    if (event.key === 'Tab' && highlighted && step !== 'value' && (step === 'operator' || query !== '')) {
      event.preventDefault();
      event.preventBaseUIHandler();
      handleSelect(highlighted);
      return;
    }
    if (step === 'value') {
      const highlightedOption = valueStep.hasSuggestions ? (highlighted as FilterBarOption | null) : null;
      const handled = valueStep.handleKeyDown(event, highlightedOption);
      // Base UI closes on Enter when nothing is highlighted (form submission); the draft must stay open.
      if (handled || (event.key === 'Enter' && highlightedOption === null)) event.preventBaseUIHandler();
    }
  };

  const items: readonly Item[] =
    step === 'field' ? visibleFields : step === 'operator' ? fieldOperators : valueStep.options;

  const searchPlaceholder =
    step === 'field' ? 'Search fields…' : step === 'operator' ? 'Search operators…' : 'Search values…';

  const inputPlaceholder =
    step === 'field'
      ? placeholder
      : step === 'operator'
        ? 'Operator…'
        : valueStep.hasSuggestions && valueStep.allowFreeText
          ? 'Search or type a value…'
          : field?.type === 'number'
            ? 'Number…'
            : 'Value…';

  return (
    <>
      <ComboboxPrimitive.Root<Item>
        items={items}
        itemToStringLabel={getItemLabel}
        // The value step is already filtered (locally or server-side) by useValueSuggestions.
        filter={step === 'value' ? null : matchesQueryFilter}
        value={null}
        onValueChange={(item, details) => {
          // Never let Base UI keep the selection, fill the input or close: each step routes it.
          details.cancel();
          if (item) handleSelect(item);
        }}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.reason !== 'input-change') return;
          setQuery(next);
          if (!open) setOpen(true);
        }}
        onItemHighlighted={item => setHighlighted(item ?? null)}
        open={open}
        onOpenChange={(next, details) => {
          // Escape is handled by the input (it steps back rather than closing).
          if (!next && details.reason === 'escape-key') return;
          // The input is the anchor, not a trigger: clicking it must keep the draft open.
          if (
            !next &&
            details.reason === 'outside-press' &&
            details.event.target instanceof Node &&
            inputRef.current?.contains(details.event.target)
          ) {
            return;
          }
          if (next) setOpen(true);
          else close();
        }}
        // ComboboxRoot's typings narrow `autoHighlight` to boolean, but the runtime (shared with
        // AutocompleteRoot) supports 'always': highlight the first item as soon as the list opens.
        autoHighlight={'always' as unknown as boolean}
        modal={false}
      >
        <div
          data-slot="filter-bar-input-trigger"
          className={cn(
            // Same trigger recipe as every other DS Combobox (fill, radius, `[&>svg]` icon sizing
            // and the Button icon offset); the bar itself has no chrome. Focus lives on the
            // nested input, so the recipe's `focus-visible` border becomes `focus-within`.
            comboboxTriggerClass({ variant: 'default', size: FILTER_BAR_CONTROL_SIZE }),
            'w-auto cursor-text',
            'focus-within:bg-fill-hover',
            inputFocusBorderWithin,
            step === 'field' ? 'min-w-40' : 'min-w-28',
            className,
          )}
        >
          <ListFilterIcon aria-hidden className="text-muted-foreground -ml-[.3em] shrink-0" />
          <ComboboxPrimitive.Input
            ref={el => {
              inputRef.current = el;
              ctx.registerInput(el);
            }}
            aria-label={ariaLabel}
            spellCheck={false}
            data-slot="filter-bar-input"
            data-step={step}
            data-target={targetGroup?.id}
            inputMode={step === 'value' && field?.type === 'number' ? 'decimal' : undefined}
            placeholder={inputPlaceholder}
            className={cn(
              unstyledFormElementStyle,
              'min-w-0 flex-1 bg-transparent',
              'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal focus:placeholder:opacity-70',
            )}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <ComboboxPrimitive.Portal container={container}>
          <ComboboxPrimitive.Positioner
            align="start"
            sideOffset={MENU_SIDE_OFFSET}
            positionMethod={FLOATING_POSITION_METHOD}
            className={comboboxStyles.positioner}
          >
            <ComboboxPrimitive.Popup // The input stretches across the bar, so drop the anchor-width floor: size to content.
              className={cn(comboboxStyles.popup, 'min-w-56')}
              data-slot="filter-bar-editor"
            >
              {(step !== 'value' || valueStep.hasSuggestions) && (
                // Search row mirroring the bar input, so the popup reads as a searchable combobox.
                // The bar input stays the only real input: focus and keyboard navigation never move.
                <div
                  className={cn(comboboxStyles.searchContainer, 'cursor-text')}
                  data-slot="filter-bar-search"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => inputRef.current?.focus()}
                >
                  <Search className={comboboxStyles.searchIcon} />
                  <span
                    className={cn(
                      comboboxStyles.searchInput,
                      'flex items-center truncate',
                      query === '' && comboboxStyles.placeholder,
                    )}
                  >
                    {query === '' ? searchPlaceholder : query}
                  </span>
                </div>
              )}
              {step === 'field' && (
                <FilterBarOptionList<FilterBarField>
                  aria-label="Fields"
                  getKey={f => f.id}
                  renderOption={f => <FilterBarFieldLabel field={f} />}
                  emptyText="No matching field."
                />
              )}
              {step === 'operator' && (
                <FilterBarOptionList<FilterBarOperator>
                  aria-label="Operators"
                  getKey={o => o.id}
                  renderOption={o => o.label}
                  emptyText="No matching operator."
                />
              )}
              {step === 'value' && valueStep.hasSuggestions && (
                <FilterBarOptionList<FilterBarOption>
                  aria-label="Values"
                  aria-multiselectable={valueStep.isMany || undefined}
                  getKey={o => o.value}
                  renderOption={o => o.label ?? o.value}
                  isSelected={o => valueStep.isMany && valueStep.selected.includes(o.value)}
                  isLoading={valueStep.isLoading}
                  error={valueStep.error}
                  emptyText={
                    valueStep.allowFreeText ? 'No suggestions — press Enter to use your text.' : 'No matching value.'
                  }
                />
              )}
              {step === 'value' && !valueStep.hasSuggestions && (
                <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-[.9em]">
                  <Txt variant="caption" tone="muted">
                    Type a value
                  </Txt>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!valueStep.canCommitQuery}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => valueStep.commitFreeText()}
                  >
                    Apply
                    <Kbd size="xs">↵</Kbd>
                  </Button>
                </div>
              )}
              {step === 'value' && valueStep.isMany && (
                <div className="border-border flex items-center justify-end gap-1 border-t p-1">
                  <Button
                    size="sm"
                    variant="default"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => valueStep.commitSelection() || valueStep.commitFreeText()}
                  >
                    Done
                    <Kbd size="xs">{modEnterLabel}</Kbd>
                  </Button>
                </div>
              )}
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
    </>
  );
}
