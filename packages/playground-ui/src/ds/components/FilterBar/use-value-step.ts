import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from './types';
import { useValueSuggestions } from './use-value-suggestions';

export type UseValueStepOptions = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  query: string;
  enabled: boolean;
  initialValue?: string | string[];
  onCommit: (value: string | string[]) => void;
};

/**
 * Shared value-editing logic for the typeahead value step and the chip value
 * editor. Single arity: picking an option (or Enter on free text) commits.
 * Many arity: Enter/click toggles the highlighted option; Ctrl/Meta+Enter (or
 * `commitSelection`) commits the selection. List navigation itself is owned by
 * the surrounding `ComboboxPrimitive.Root`.
 */
export function useValueStep({ field, operator, query, enabled, initialValue, onCommit }: UseValueStepOptions) {
  const isMany = operator?.arity === 'many';
  const [selected, setSelected] = useState<string[]>(() => (Array.isArray(initialValue) ? initialValue : []));
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  // The editor stays mounted across opens: re-seed from the current value each time it opens.
  useEffect(() => {
    const initial = initialValueRef.current;
    setSelected(enabled && Array.isArray(initial) ? initial : []);
  }, [enabled]);

  const suggestions = useValueSuggestions({ field, operatorId: operator?.id ?? '', query, enabled });
  const allowFreeText = !field?.strict;

  const toggle = useCallback((value: string) => {
    setSelected(current => (current.includes(value) ? current.filter(v => v !== value) : [...current, value]));
  }, []);

  const handleSelect = useCallback(
    (option: FilterBarOption) => {
      if (isMany) toggle(option.value);
      else onCommit(option.value);
    },
    [isMany, toggle, onCommit],
  );

  const commitSelection = useCallback(() => {
    if (selected.length === 0) return false;
    onCommit(selected);
    return true;
  }, [selected, onCommit]);

  const commitFreeText = useCallback(() => {
    const text = query.trim();
    if (!allowFreeText || text.length === 0) return false;
    if (isMany) {
      onCommit(selected.includes(text) ? selected : [...selected, text]);
    } else {
      onCommit(text);
    }
    return true;
  }, [allowFreeText, query, isMany, selected, onCommit]);

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
    handleSelect,
    handleKeyDown,
    commitSelection,
    commitFreeText,
  };
}
