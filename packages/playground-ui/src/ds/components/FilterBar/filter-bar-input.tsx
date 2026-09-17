import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import type { BaseUIEvent } from '@base-ui/react/types';
import { SearchIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './animation/filter-bar-animation.module.css';
import { FilterBarPopup } from './animation/filter-bar-popup';
import { useFilterDraftMotion } from './animation/use-filter-draft-motion';
import { FilterBarAddButton } from './filter-bar-add-button';
import { FilterBarFieldLabel, formatValue } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarDraftChip } from './filter-bar-draft-chip';
import { FilterBarOptionList } from './filter-bar-option-list';
import { matchesQueryFilter } from './match-query';
import type { FilterBarField, FilterBarOperator, FilterBarOption, FilterBarValue } from './types';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { comboboxStyles } from '@/ds/components/Combobox/combobox-styles';
import { Kbd } from '@/ds/components/Kbd/kbd';
import { Txt } from '@/ds/components/Txt/Txt';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { inputOutlineAndFocusStyle } from '@/ds/primitives/form-element';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

type Step = 'field' | 'operator' | 'value';

type Draft = {
  step: Step;
  fieldId?: string;
  operatorId?: string;
};

type Item = FilterBarField | FilterBarOperator | FilterBarOption;

const INITIAL_DRAFT: Draft = { step: 'field' };

function getItemLabel(item: Item) {
  if (item.label) return item.label;
  if ('value' in item) return item.value;
  return '';
}

function getInputPlaceholder(
  step: Step,
  placeholder: string,
  fieldType: FilterBarField['type'],
  canSearchAndCreate: boolean,
) {
  if (step === 'field') return placeholder;
  if (step === 'operator') return 'Operator…';
  if (canSearchAndCreate) return fieldType === 'number' ? 'Search or type a number…' : 'Search or type a value…';
  return fieldType === 'number' ? 'Number…' : 'Value…';
}

export type FilterBarInputProps = {
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

export function FilterBarInput({
  placeholder = 'Filter…',
  className,
  'aria-label': ariaLabel = 'Add filter',
}: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  const isButton = ctx.variant === 'button';
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draftMotion = useFilterDraftMotion(inputRef, ctx.animation);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [highlighted, setHighlighted] = useState<Item | null>(null);
  const modEnterLabel = useIsApplePlatform() ? '⌘↵' : 'Ctrl ↵';

  const field = draft.fieldId ? ctx.getField(draft.fieldId) : undefined;
  const operator = draft.operatorId ? ctx.getOperator(draft.operatorId) : undefined;
  const fieldOperators = useMemo(() => (field ? ctx.getFieldOperators(field) : []), [ctx, field]);
  const visibleFields = useMemo(() => ctx.fields.filter(f => !f.hidden), [ctx.fields]);

  const reset = useCallback(
    (transition: 'edit' | 'commit' = 'edit') => {
      draftMotion.capture(transition);
      setDraft(INITIAL_DRAFT);
      setQuery('');
    },
    [draftMotion],
  );

  const close = useCallback(() => {
    setOpen(false);
    if (!isButton) reset();
  }, [reset, isButton]);

  const commit = useCallback(
    (fieldId: string, operatorId: string, value: FilterBarValue) => {
      if (isButton) setOpen(false);
      else reset('commit');
      ctx.addItem({ fieldId, operatorId, value });
      (isButton ? buttonRef : inputRef).current?.focus();
    },
    [ctx, reset, isButton],
  );

  const selectOperator = useCallback(
    (fieldId: string, next: FilterBarOperator) => {
      draftMotion.capture();
      if (next.arity === 'none') {
        commit(fieldId, next.id, '');
        return;
      }
      setDraft({ step: 'value', fieldId, operatorId: next.id });
      setQuery('');
    },
    [commit, draftMotion],
  );

  const selectField = useCallback(
    (next: FilterBarField) => {
      draftMotion.capture();
      const [only, ...rest] = ctx.getFieldOperators(next);
      if (only && rest.length === 0) {
        selectOperator(next.id, only);
        return;
      }
      setDraft({ step: 'operator', fieldId: next.id });
      setQuery('');
    },
    [ctx, selectOperator, draftMotion],
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
    draftMotion.capture();
    if (draft.step === 'value') {
      const skipOperator = field ? fieldOperators.length === 1 : false;
      setDraft(skipOperator ? INITIAL_DRAFT : { step: 'operator', fieldId: draft.fieldId });
    } else if (draft.step === 'operator') setDraft(INITIAL_DRAFT);
    else setOpen(false);
    setQuery('');
  }, [draft, field, fieldOperators, draftMotion]);
  const handleSelect = (item: Item) => {
    if ('value' in item) {
      draftMotion.capture();
      if (draft.step === 'value') valueStep.handleSelect(item);
      return;
    }
    if (draft.step === 'field') {
      const selectedField = ctx.getField(item.id);
      if (selectedField) selectField(selectedField);
      return;
    }
    if (draft.step === 'operator' && draft.fieldId) {
      const selectedOperator = ctx.getOperator(item.id);
      if (selectedOperator) selectOperator(draft.fieldId, selectedOperator);
    }
  };
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
        if (ctx.focusChip(ctx.items.length - 1, -1, 'remove')) event.preventDefault();
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
      const highlightedOption = valueStep.hasSuggestions && highlighted && 'value' in highlighted ? highlighted : null;
      const handled = valueStep.handleKeyDown(event, highlightedOption);
      if (handled || (event.key === 'Enter' && highlightedOption === null)) event.preventBaseUIHandler();
    }
  };

  const itemsByStep: Record<Step, readonly Item[]> = {
    field: visibleFields,
    operator: fieldOperators,
    value: valueStep.options,
  };
  const inputPlaceholder = getInputPlaceholder(
    draft.step,
    placeholder,
    field?.type,
    valueStep.hasSuggestions && valueStep.allowFreeText,
  );
  const selectedValueLabel = valueStep.selected.length > 0 ? formatValue(valueStep.selected, field) : undefined;

  const inputControl = (
    <ComboboxPrimitive.Input
      ref={el => {
        inputRef.current = el;
        if (!isButton) ctx.registerInput(el);
      }}
      aria-label={isButton ? inputPlaceholder : ariaLabel}
      aria-invalid={valueStep.validationMessage ? true : undefined}
      aria-describedby={valueStep.validationMessage ? valueStep.validationMessageId : undefined}
      spellCheck={false}
      data-slot="filter-bar-input"
      data-step={draft.step}
      inputMode={draft.step === 'value' && field?.type === 'number' ? 'decimal' : undefined}
      placeholder={inputPlaceholder}
      className={
        isButton
          ? comboboxStyles.searchInput
          : cn(
              inputOutlineAndFocusStyle,
              controlSizeClasses.md,
              'w-48 min-w-24 px-2 leading-ui-sm text-neutral6',
              'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal focus:placeholder:opacity-70',
              styles.inlineInput,
              className,
            )
      }
      onFocus={isButton ? undefined : () => setOpen(true)}
      onKeyDown={handleKeyDown}
    />
  );

  return (
    <>
      <ComboboxPrimitive.Root<Item>
        items={itemsByStep[draft.step]}
        itemToStringLabel={getItemLabel}
        filter={draft.step === 'value' ? null : matchesQueryFilter}
        value={null}
        onValueChange={(item, details) => {
          details.cancel();
          if (open && item) handleSelect(item);
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
          if (!next && details.reason === 'escape-key') return;
          if (
            !next &&
            details.reason === 'outside-press' &&
            details.event.target instanceof Node &&
            inputRef.current?.contains(details.event.target)
          ) {
            return;
          }
          if (next) {
            if (isButton && !open) reset();
            setOpen(true);
          } else close();
        }}
        onOpenChangeComplete={next => {
          if (isButton && !next) reset();
        }}
        // ComboboxRoot's typings narrow `autoHighlight` to boolean, but the runtime (shared with
        // AutocompleteRoot) supports 'always': highlight the first item as soon as the list opens.
        autoHighlight={'always' as unknown as boolean}
        modal={false}
      >
        {isButton ? (
          <FilterBarAddButton
            ref={element => {
              buttonRef.current = element;
              ctx.registerInput(element);
              ctx.animation.register('composer', element);
            }}
            field={open ? field : undefined}
            operator={open ? operator : undefined}
            selectedValueLabel={selectedValueLabel}
            label={ariaLabel}
            className={className}
          />
        ) : (
          <FilterBarDraftChip
            motion={draftMotion}
            field={field}
            operator={fieldOperators.length === 1 ? undefined : operator}
            selectedValueLabel={selectedValueLabel}
          >
            {inputControl}
          </FilterBarDraftChip>
        )}
        <FilterBarPopup inputRef={inputRef} buttonRef={buttonRef}>
          {isButton && (
            <div className={comboboxStyles.searchContainer}>
              <SearchIcon aria-hidden className={comboboxStyles.searchIcon} />
              {inputControl}
            </div>
          )}
          {draft.step === 'field' && (
            <FilterBarOptionList<FilterBarField>
              aria-label="Fields"
              getKey={f => f.id}
              renderOption={f => <FilterBarFieldLabel field={f} />}
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
              emptyTextId={valueStep.validationMessageId}
              emptyText={
                valueStep.validationMessage ??
                (valueStep.allowFreeText ? 'No suggestions — press Enter to use your text.' : 'No matching value.')
              }
            />
          )}
          {draft.step === 'value' && !valueStep.hasSuggestions && (
            <div className="flex items-center justify-between gap-2 py-1 pr-1 pl-[.9em]">
              <Txt
                id={valueStep.validationMessageId}
                role={valueStep.validationMessage ? 'status' : undefined}
                variant="ui-sm"
                className={valueStep.validationMessage ? 'text-error' : 'text-neutral3'}
              >
                {valueStep.validationMessage ?? (field?.type === 'number' ? 'Type a number' : 'Type a value')}
              </Txt>
              <Button
                size="xs"
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
          {draft.step === 'value' && valueStep.isMany && (
            <div className="border-border1 flex items-center justify-end gap-1 border-t p-1">
              <Button
                size="xs"
                variant="default"
                onMouseDown={e => e.preventDefault()}
                onClick={() => valueStep.commitSelection() || valueStep.commitFreeText()}
              >
                Done
                <Kbd size="xs">{modEnterLabel}</Kbd>
              </Button>
            </div>
          )}
        </FilterBarPopup>
      </ComboboxPrimitive.Root>
    </>
  );
}
