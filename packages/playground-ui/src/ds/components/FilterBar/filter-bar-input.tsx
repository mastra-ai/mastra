import type { BaseUIEvent } from '@base-ui/react/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarDraftChip } from './filter-bar-draft-chip';
import { FilterBarOptionList } from './filter-bar-option-list';
import { matchesQueryFilter } from './match-query';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from './types';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { Txt } from '@/ds/components/Txt';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { unstyledFormElementStyle } from '@/ds/primitives/form-element';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

type Step = 'field' | 'operator' | 'value';

type Draft = {
  step: Step;
  fieldId?: string;
  operatorId?: string;
};

type Item = FilterBarField | FilterBarOperator | FilterBarOption;

const INITIAL_DRAFT: Draft = { step: 'field' };

const getItemLabel = (item: Item) => ('label' in item && item.label ? item.label : 'value' in item ? item.value : '');

export type FilterBarInputProps = {
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/**
 * Typeahead entry point: type to pick a field, then an operator, then a value.
 * Focus never leaves the input; the popup is driven with the arrow keys.
 */
export function FilterBarInput({
  placeholder = 'Filter…',
  className,
  'aria-label': ariaLabel = 'Add filter',
}: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  const container = usePortalContainer();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [highlighted, setHighlighted] = useState<Item | null>(null);

  const field = draft.fieldId ? ctx.getField(draft.fieldId) : undefined;
  const operator = draft.operatorId ? ctx.getOperator(draft.operatorId) : undefined;
  const fieldOperators = useMemo(() => (field ? ctx.getFieldOperators(field) : []), [ctx, field]);

  const reset = useCallback(() => {
    setDraft(INITIAL_DRAFT);
    setQuery('');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const commit = useCallback(
    (fieldId: string, operatorId: string, value: string | string[]) => {
      ctx.addItem({ fieldId, operatorId, value });
      reset();
      inputRef.current?.focus();
    },
    [ctx, reset],
  );

  const selectField = useCallback((next: FilterBarField) => {
    setDraft({ step: 'operator', fieldId: next.id });
    setQuery('');
  }, []);

  const selectOperator = useCallback(
    (next: FilterBarOperator) => {
      if (!draft.fieldId) return;
      if (next.arity === 'none') {
        commit(draft.fieldId, next.id, '');
        return;
      }
      setDraft({ step: 'value', fieldId: draft.fieldId, operatorId: next.id });
      setQuery('');
    },
    [draft.fieldId, commit],
  );

  const valueStep = useValueStep({
    field,
    operator,
    query,
    enabled: open && draft.step === 'value',
    onCommit: value => {
      if (draft.fieldId && draft.operatorId) commit(draft.fieldId, draft.operatorId, value);
    },
  });

  const stepBack = useCallback(() => {
    if (draft.step === 'value') setDraft({ step: 'operator', fieldId: draft.fieldId });
    else if (draft.step === 'operator') setDraft(INITIAL_DRAFT);
    else setOpen(false);
    setQuery('');
  }, [draft]);

  // Selection is routed per step and never kept by Base UI (`value` stays null).
  const handleSelect = (item: Item) => {
    if (draft.step === 'field') selectField(item as FilterBarField);
    else if (draft.step === 'operator') selectOperator(item as FilterBarOperator);
    else valueStep.handleSelect(item as FilterBarOption);
  };

  // App-level keys run before Base UI's own input handling.
  const handleKeyDown = (event: BaseUIEvent<KeyboardEvent<HTMLInputElement>>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
        if (draft.step !== 'field') stepBack();
        else {
          const last = ctx.items[ctx.items.length - 1];
          if (last) ctx.removeItem(last.id);
        }
        return;
      }
      if (event.key === 'ArrowLeft' && draft.step === 'field') {
        if (ctx.focusChip(ctx.items.length - 1, -1, 'value')) event.preventDefault();
        return;
      }
    }
    if (!open) return;

    if (event.key === 'Tab' && highlighted && draft.step !== 'value' && (draft.step === 'operator' || query !== '')) {
      event.preventDefault();
      event.preventBaseUIHandler();
      handleSelect(highlighted);
      return;
    }
    if (draft.step === 'value') {
      const highlightedOption = valueStep.hasSuggestions ? (highlighted as FilterBarOption | null) : null;
      const handled = valueStep.handleKeyDown(event, highlightedOption);
      // Base UI closes on Enter when nothing is highlighted (form submission); the draft must stay open.
      if (handled || (event.key === 'Enter' && highlightedOption === null)) event.preventBaseUIHandler();
    }
  };

  const items: readonly Item[] =
    draft.step === 'field' ? ctx.fields : draft.step === 'operator' ? fieldOperators : valueStep.options;

  const inputPlaceholder =
    draft.step === 'field'
      ? placeholder
      : draft.step === 'operator'
        ? 'Operator…'
        : valueStep.hasSuggestions && valueStep.allowFreeText
          ? 'Search or type a value…'
          : 'Value…';

  return (
    <>
      <FilterBarDraftChip field={field} operator={operator} />
      <ComboboxPrimitive.Root<Item>
        items={items}
        itemToStringLabel={getItemLabel}
        // The value step is already filtered (locally or server-side) by useValueSuggestions.
        filter={draft.step === 'value' ? null : matchesQueryFilter}
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
        <ComboboxPrimitive.Input
          ref={el => {
            inputRef.current = el;
            ctx.registerInput(el);
          }}
          aria-label={ariaLabel}
          spellCheck={false}
          data-slot="filter-bar-input"
          data-step={draft.step}
          placeholder={inputPlaceholder}
          className={cn(
            // Naked control inside the styled FilterBar surface — same baseline as the DS Input `unstyled` variant.
            unstyledFormElementStyle,
            'h-form-sm flex-1 px-1 text-ui-smd leading-ui-sm text-neutral6',
            'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal focus:placeholder:opacity-70',
            draft.step === 'field' ? 'min-w-32' : 'min-w-24 pl-0',
            className,
          )}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ComboboxPrimitive.Portal container={container}>
          <ComboboxPrimitive.Positioner
            align="start"
            sideOffset={MENU_SIDE_OFFSET}
            positionMethod={FLOATING_POSITION_METHOD}
            className={comboboxStyles.positioner}
          >
            <ComboboxPrimitive.Popup className={cn(comboboxStyles.popup, 'w-64')} data-slot="filter-bar-editor">
              {draft.step === 'field' && (
                <FilterBarOptionList<FilterBarField>
                  aria-label="Fields"
                  getKey={f => f.id}
                  renderOption={f => f.label}
                  emptyText="No matching field."
                />
              )}
              {draft.step === 'operator' && (
                <FilterBarOptionList<FilterBarOperator>
                  aria-label="Operators"
                  getKey={o => o.id}
                  renderOption={o => o.label}
                  emptyText="No matching operator."
                />
              )}
              {draft.step === 'value' && valueStep.hasSuggestions && (
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
              {draft.step === 'value' && !valueStep.hasSuggestions && (
                <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-[.9em]">
                  <Txt variant="ui-sm" className="text-neutral3">
                    Type a value, then press Enter
                  </Txt>
                  <Button
                    size="xs"
                    variant="primary"
                    disabled={query.trim().length === 0}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => valueStep.commitFreeText()}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {draft.step === 'value' && valueStep.isMany && (
                <div className="border-border1 flex items-center justify-end gap-1 border-t p-1">
                  <Button
                    size="xs"
                    variant="primary"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => valueStep.commitSelection() || valueStep.commitFreeText()}
                  >
                    Done
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
