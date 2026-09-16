import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { ChevronRightIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarListbox } from './filter-bar-listbox';
import type { FilterBarField, FilterBarOperator } from './types';
import { useListbox } from './use-listbox';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { PopoverContent } from '@/ds/components/Popover/popover';
import { MENU_SIDE_OFFSET, menuPopupClass } from '@/ds/primitives/menu-item';
import { cn } from '@/lib/utils';

type Step = 'field' | 'operator' | 'value';

type Draft = {
  step: Step;
  fieldId?: string;
  operatorId?: string;
};

const INITIAL_DRAFT: Draft = { step: 'field' };

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);

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

  const fieldListbox = useListbox({ options: ctx.fields, getLabel: f => f.label, query, onSelect: selectField });
  const operatorListbox = useListbox({
    options: fieldOperators,
    getLabel: o => o.label,
    query,
    onSelect: selectOperator,
  });
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stepBack();
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (query === '') {
      if (event.key === 'Backspace') {
        event.preventDefault();
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

    if (draft.step === 'field') {
      const highlightedField = fieldListbox.filtered[fieldListbox.highlighted];
      if (event.key === 'Tab' && highlightedField && query !== '') {
        event.preventDefault();
        selectField(highlightedField);
        return;
      }
      fieldListbox.handleKeyDown(event);
      return;
    }
    if (draft.step === 'operator') {
      const highlightedOperator = operatorListbox.filtered[operatorListbox.highlighted];
      if (event.key === 'Tab' && highlightedOperator) {
        event.preventDefault();
        selectOperator(highlightedOperator);
        return;
      }
      operatorListbox.handleKeyDown(event);
      return;
    }
    valueStep.handleKeyDown(event);
  };

  const activeListbox =
    draft.step === 'field' ? fieldListbox : draft.step === 'operator' ? operatorListbox : valueStep.listbox;
  const showListbox = draft.step !== 'value' || valueStep.hasSuggestions;

  const inputPlaceholder =
    draft.step === 'field'
      ? placeholder
      : draft.step === 'operator'
        ? 'Choose an operator…'
        : valueStep.hasSuggestions
          ? valueStep.allowFreeText
            ? 'Search or type a value…'
            : 'Search values…'
          : 'Type a value, then Enter';

  return (
    <PopoverPrimitive.Root
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
      modal={false}
    >
      <input
        ref={el => {
          inputRef.current = el;
          ctx.registerInput(el);
        }}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open && showListbox ? activeListbox.listboxId : undefined}
        aria-activedescendant={open && showListbox ? activeListbox.activeDescendant : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        data-slot="filter-bar-input"
        data-step={draft.step}
        placeholder={inputPlaceholder}
        value={query}
        className={cn(
          'h-form-sm min-w-32 flex-1 bg-transparent px-1 text-ui-smd leading-ui-sm text-neutral6 outline-none placeholder:text-neutral3',
          className,
        )}
        onChange={e => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <PopoverContent
        anchor={inputRef}
        align="start"
        sideOffset={MENU_SIDE_OFFSET}
        className={cn(menuPopupClass, 'w-64')}
        initialFocus={false}
        finalFocus={false}
      >
        {draft.step !== 'field' && (
          <div className="border-border1 text-ui-xs text-neutral3 flex items-center gap-1 border-b px-[.9em] py-1.5">
            <span className="text-neutral6">{field?.label}</span>
            <ChevronRightIcon className="size-[1.1em]" />
            {operator && (
              <>
                <span className="text-neutral6">{operator.label}</span>
                <ChevronRightIcon className="size-[1.1em]" />
              </>
            )}
          </div>
        )}
        {draft.step === 'field' && (
          <FilterBarListbox
            listbox={fieldListbox}
            aria-label="Fields"
            getKey={f => f.id}
            renderOption={f => f.label}
            onSelect={selectField}
            emptyText="No matching field."
          />
        )}
        {draft.step === 'operator' && (
          <FilterBarListbox
            listbox={operatorListbox}
            aria-label="Operators"
            getKey={o => o.id}
            renderOption={o => o.label}
            onSelect={selectOperator}
            emptyText="No matching operator."
          />
        )}
        {draft.step === 'value' && valueStep.hasSuggestions && (
          <FilterBarListbox
            listbox={valueStep.listbox}
            aria-label="Values"
            aria-multiselectable={valueStep.isMany || undefined}
            getKey={o => o.value}
            renderOption={o => o.label ?? o.value}
            isSelected={o => valueStep.isMany && valueStep.selected.includes(o.value)}
            onSelect={valueStep.handleSelect}
            isLoading={valueStep.isLoading}
            error={valueStep.error}
            emptyText={
              valueStep.allowFreeText ? 'No suggestions — press Enter to use your text.' : 'No matching value.'
            }
          />
        )}
        {draft.step === 'value' && !valueStep.hasSuggestions && (
          <div className="text-ui-xs text-neutral3 px-[.9em] py-2">Type a value and press Enter.</div>
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
      </PopoverContent>
    </PopoverPrimitive.Root>
  );
}
