import type { BaseUIEvent } from '@base-ui/react/types';
import { BracesIcon, ListFilterIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { FILTER_BAR_CONTROL_SIZE, FilterBarFieldLabel, alwaysHighlightProps } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import { FilterBarOptionLabel, FilterBarOptionList } from './filter-bar-option-list';
import { findGroup } from './filter-bar-tree';
import { matchesQueryFilter } from './match-query';
import type { FilterBarDraft, FilterBarField, FilterBarOperator, FilterBarOption, FilterBarValue } from './types';
import { parseFieldValue } from './types';
import { useValueStep } from './use-value-step';
import { Button } from '@/ds/components/Button/Button';
import { ComboboxPrimitive, comboboxStyles } from '@/ds/components/Combobox';
import { comboboxTriggerClass } from '@/ds/components/Combobox/combobox-styles';
import { Kbd } from '@/ds/components/Kbd/kbd';
import { Txt } from '@/ds/components/Txt';
import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { inputFocusBorderWithin, unstyledFormElementStyle } from '@/ds/primitives/form-element';
import { MENU_SIDE_OFFSET } from '@/ds/primitives/menu-item';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';
import { usePortalContainer } from '@/ds/primitives/portal-container';
import { useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

type Step = 'field' | 'operator' | 'value';

type Item = FilterBarField | FilterBarOperator | FilterBarOption;

const getItemLabel = (item: Item) => ('label' in item && item.label ? item.label : 'value' in item ? item.value : '');

const EMPTY_ITEMS: readonly Item[] = [];
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
  groupId?: string;
  onLeave?: () => void;
};

export function FilterBarInput(props: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  if (ctx.inputTarget !== props.groupId) return null;
  return <FilterBarInputImpl {...props} />;
}

function FilterBarInputImpl({
  placeholder = 'Filter',
  className,
  'aria-label': ariaLabel = 'Add filter',
  groupId,
  onLeave,
}: FilterBarInputProps) {
  const ctx = useFilterBarContext();
  const container = usePortalContainer();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState<Item | null>(null);
  const [emptyForStepChange, setEmptyForStepChange] = useState(false);
  const modEnterLabel = useIsApplePlatform() ? '⌘↵' : 'Ctrl ↵';

  const { draft, setDraft: setDraftState, commitDraft } = ctx;
  const step: Step = !draft ? 'field' : !draft.operatorId ? 'operator' : 'value';
  const field = draft ? ctx.getField(draft.fieldId) : undefined;
  const fieldOperators = useMemo(() => (field ? ctx.getFieldOperators(field) : []), [ctx, field]);
  const operator = draft?.operatorId
    ? (fieldOperators.find(o => o.id === draft.operatorId) ?? ctx.getOperator(draft.operatorId))
    : undefined;
  const offerAdvanced = ctx.groupsEnabled && groupId === undefined;
  const visibleFields = useMemo(() => {
    const fields = ctx.fields.filter(f => !f.hidden);
    return offerAdvanced ? [...fields, ADVANCED_FIELD] : fields;
  }, [ctx.fields, offerAdvanced]);
  const targetGroup = groupId ? findGroup(ctx.expression, groupId) : undefined;

  useEffect(() => {
    if (groupId) inputRef.current?.focus();
  }, [groupId]);

  // Clear Base UI highlighting before changing steps.
  const withHighlightReset = useCallback((change: () => void) => {
    flushSync(() => setEmptyForStepChange(true));
    change();
    setEmptyForStepChange(false);
  }, []);

  const setDraft = useCallback(
    (next: Omit<FilterBarDraft, 'id' | 'from'> | null) => withHighlightReset(() => setDraftState(next)),
    [withHighlightReset, setDraftState],
  );

  const reset = useCallback(() => {
    setDraftState(null);
    setQuery('');
  }, [setDraftState]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const commit = useCallback(
    (fieldId: string, operatorId: string, value: FilterBarValue) => {
      withHighlightReset(() => commitDraft({ fieldId, operatorId }, value));
      setQuery('');
      inputRef.current?.focus();
    },
    [withHighlightReset, commitDraft],
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
        const id = ctx.addGroup(undefined, 'or');
        ctx.setOpenGroup(id);
        ctx.openGroupInput(id);
        setQuery('');
        setOpen(false);
        return;
      }
      const [only, ...rest] = ctx.getFieldOperators(next);
      if (next.search && only && query.trim() !== '') {
        commit(next.id, only.id, parseFieldValue(next.type, query));
        return;
      }
      if (only && rest.length === 0) {
        selectOperator(next.id, only);
        return;
      }
      setDraft({ fieldId: next.id });
      setQuery('');
    },
    [ctx, commit, query, selectOperator, setDraft],
  );

  const valueStep = useValueStep({
    field,
    operator,
    query,
    enabled: open && step === 'value',
    setQuery,
    onCommit: value => {
      if (draft?.operatorId) commit(draft.fieldId, draft.operatorId, value);
    },
  });

  const leaveGroup = useCallback(() => {
    if (!groupId) return false;
    ctx.openGroupInput(undefined);
    onLeave?.();
    return true;
  }, [ctx, groupId, onLeave]);

  const stepBack = useCallback(() => {
    if (step === 'value' && draft) {
      const skipOperator = field ? fieldOperators.length === 1 : false;
      setDraft(skipOperator ? null : { fieldId: draft.fieldId });
    } else if (step === 'operator') setDraft(null);
    else if (!leaveGroup()) setOpen(false);
    setQuery('');
  }, [step, draft, field, fieldOperators, setDraft, leaveGroup]);

  const handleSelect = (item: Item) => {
    if (step === 'field') selectField(item as FilterBarField);
    else if (step === 'operator' && draft) selectOperator(draft.fieldId, item as FilterBarOperator);
    else valueStep.handleSelect(item as FilterBarOption);
  };

  const handleKeyDown = (event: BaseUIEvent<KeyboardEvent<HTMLInputElement>>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
          const last = targetGroup.nodes.findLast(node => !ctx.leaving.has(node.id));
          if (last) ctx.removeItem(last.id);
          else leaveGroup();
        } else {
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
      // Base UI submits on Enter without a highlight.
      if (handled || (event.key === 'Enter' && highlightedOption === null)) event.preventBaseUIHandler();
    }
  };

  const optionsForStep: Record<Step, readonly Item[]> = {
    field: visibleFields,
    operator: fieldOperators,
    value: valueStep.options,
  };
  const items: readonly Item[] = emptyForStepChange ? EMPTY_ITEMS : optionsForStep[step];

  const filterItem = useCallback(
    (item: Item, text: string, itemToString?: (item: Item) => string) =>
      ('search' in item && item.search === true) || matchesQueryFilter(item, text, itemToString),
    [],
  );

  const inputPlaceholder =
    step === 'field'
      ? placeholder
      : step === 'operator'
        ? 'Operator'
        : valueStep.hasSuggestions && valueStep.allowFreeText
          ? 'Search or type a value'
          : field?.type === 'number'
            ? 'Number'
            : 'Value';

  return (
    <>
      <ComboboxPrimitive.Root<Item>
        items={items}
        itemToStringLabel={getItemLabel}
        filter={step === 'value' ? null : filterItem}
        value={null}
        onValueChange={(item, details) => {
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
          if (!next && details.reason === 'escape-key') return;
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
        {...alwaysHighlightProps}
        modal={false}
      >
        <div
          ref={anchorRef}
          data-slot="filter-bar-input-trigger"
          className={cn(
            comboboxTriggerClass({ variant: 'default', size: FILTER_BAR_CONTROL_SIZE }),
            'w-auto cursor-text',
            'focus-within:bg-fill-hover',
            inputFocusBorderWithin,
            step === 'field' ? 'min-w-40' : 'min-w-28',
            className,
          )}
        >
          <ListFilterIcon aria-hidden className="shrink-0" />
          <ComboboxPrimitive.Input
            ref={el => {
              inputRef.current = el;
              ctx.registerInput(el);
            }}
            aria-label={ariaLabel}
            spellCheck={false}
            {...passwordManagerOptOutProps}
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
            // Base UI anchors to the input, which starts after the filter icon; align with the pill instead.
            anchor={anchorRef}
            align="start"
            sideOffset={MENU_SIDE_OFFSET}
            positionMethod={FLOATING_POSITION_METHOD}
            className={comboboxStyles.positioner}
          >
            <ComboboxPrimitive.Popup
              className={cn(comboboxStyles.popup, 'w-(--anchor-width) min-w-44')}
              data-slot="filter-bar-editor"
            >
              {step === 'field' && (
                <FilterBarOptionList<FilterBarField>
                  aria-label="Fields"
                  getKey={f => f.id}
                  renderOption={f => (
                    <>
                      <FilterBarFieldLabel field={f} />
                      {f.search && query !== '' && (
                        <span className="min-w-0 truncate text-muted-foreground">
                          {ctx.getFieldOperators(f)[0]?.label} "{query}"
                        </span>
                      )}
                    </>
                  )}
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
              {step === 'value' && valueStep.hasOptions && (
                <FilterBarOptionList<FilterBarOption>
                  aria-label="Values"
                  aria-multiselectable={valueStep.isMany || undefined}
                  getKey={o => o.value}
                  renderOption={option => <FilterBarOptionLabel option={option} />}
                  isSelected={o => valueStep.isMany && valueStep.selected.includes(o.value)}
                  isLoading={valueStep.isLoading}
                  error={valueStep.error}
                  emptyText={
                    valueStep.allowFreeText ? 'No suggestions. Press Enter to use your text.' : 'No matching value.'
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
                    onClick={() => valueStep.submitFreeText()}
                  >
                    Apply
                    <Kbd size="xs">↵</Kbd>
                  </Button>
                </div>
              )}
              {step === 'value' && valueStep.isMany && (
                <div className="flex items-center justify-end gap-1 border-t border-border p-1">
                  <Button
                    size="sm"
                    variant="default"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => valueStep.commitDone()}
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
