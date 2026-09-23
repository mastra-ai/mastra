import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FilterBarField, FilterBarOperator, FilterBarOption, FilterBarValue } from './types';
import { parseFieldValue } from './types';
import { useValueSuggestions } from './use-value-suggestions';

export type UseValueStepOptions = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  query: string;
  enabled: boolean;
  initialValue?: FilterBarValue;
  onCommit: (value: FilterBarValue) => void;
};

const toStrings = (value: FilterBarValue | undefined): string[] => (Array.isArray(value) ? value.map(String) : []);

/**
 * Shared value-editing logic for the typeahead value step and the chip value
 * editor. Single arity: picking an option (or Enter on free text) commits.
 * Many arity: Enter/click toggles the highlighted option; Ctrl/Meta+Enter (or
 * `commitSelection`) commits the selection. List navigation itself is owned by
 * the surrounding `ComboboxPrimitive.Root`.
 */
export function useValueStep({ field, operator, query, enabled, initialValue, onCommit }: UseValueStepOptions) {
  const isMany = operator?.arity === 'many';
  // Selection is tracked as option strings; values are parsed to the field type on commit.
  const [selected, setSelected] = useState<string[]>(() => toStrings(initialValue));
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  // The editor stays mounted across opens: re-seed from the current value each time it opens.
  useEffect(() => {
    setSelected(enabled ? toStrings(initialValueRef.current) : []);
  }, [enabled]);

  const suggestions = useValueSuggestions({ field, operatorId: operator?.id ?? '', query, enabled });
  const type = field?.type;
  const allowFreeText = !field?.strict && type !== 'boolean';

  const toggle = useCallback((value: string) => {
    setSelected(current => (current.includes(value) ? current.filter(v => v !== value) : [...current, value]));
  }, []);

  const commit = useCallback(
    (values: string | string[]) =>
      onCommit(Array.isArray(values) ? values.map(v => parseFieldValue(type, v)) : parseFieldValue(type, values)),
    [onCommit, type],
  );

  const handleSelect = useCallback(
    (option: FilterBarOption) => {
      if (isMany) toggle(option.value);
      else commit(option.value);
    },
    [isMany, toggle, commit],
  );

  const commitSelection = useCallback(() => {
    if (selected.length === 0) return false;
    commit(selected);
    return true;
  }, [selected, commit]);

  const canCommitFreeText = useCallback(
    (text: string) => allowFreeText && text.length > 0 && (type !== 'number' || Number.isFinite(Number(text))),
    [allowFreeText, type],
  );

  const commitFreeText = useCallback(() => {
    const text = query.trim();
    if (!canCommitFreeText(text)) return false;
    commit(isMany ? (selected.includes(text) ? selected : [...selected, text]) : text);
    return true;
  }, [canCommitFreeText, query, isMany, selected, commit]);

  /**
   * Enter handling that Base UI does not cover: Ctrl/Meta+Enter commits a
   * multi-selection; plain Enter with nothing highlighted commits free text.
   * Returns `true` when the event was consumed.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent, highlighted: FilterBarOption | null): boolean => {
      if (event.key !== 'Enter') return false;
      if (isMany && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        return commitSelection() || commitFreeText();
      }
      if (highlighted === null) {
        event.preventDefault();
        return commitFreeText();
      }
      return false;
    },
    [isMany, commitSelection, commitFreeText],
  );

  return {
    isMany,
    selected,
    toggle,
    options: suggestions.options,
    isLoading: suggestions.isLoading,
    error: suggestions.error,
    hasSuggestions: suggestions.hasSuggestions,
    allowFreeText,
    /** True when the current query can be committed as free text (non-empty, numeric when the field is a number). */
    canCommitQuery: canCommitFreeText(query.trim()),
    handleSelect,
    handleKeyDown,
    commitSelection,
    commitFreeText,
  };
}
