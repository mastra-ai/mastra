import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from './types';
import { useListbox } from './use-listbox';
import { useValueSuggestions } from './use-value-suggestions';

export type UseValueStepOptions = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  query: string;
  enabled: boolean;
  initialValue?: string | string[];
  onCommit: (value: string | string[]) => void;
};

const getOptionLabel = (option: FilterBarOption) => option.label ?? option.value;

/**
 * Shared value-editing logic for the typeahead value step and the chip value
 * editor. Single arity: picking an option (or Enter on free text) commits.
 * Many arity: Enter/click toggles the highlighted option; Ctrl/Meta+Enter (or
 * `commitSelection`) commits the selection.
 */
export function useValueStep({ field, operator, query, enabled, initialValue, onCommit }: UseValueStepOptions) {
  const isMany = operator?.arity === 'many';
  const [selected, setSelected] = useState<string[]>(() => (Array.isArray(initialValue) ? initialValue : []));

  useEffect(() => {
    if (!enabled) setSelected([]);
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

  const listbox = useListbox({
    options: suggestions.options,
    getLabel: getOptionLabel,
    // Lazy resolvers already filter server-side; static lists were filtered by useValueSuggestions.
    query: '',
    onSelect: handleSelect,
  });

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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === 'Enter' && isMany && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        return commitSelection() || commitFreeText();
      }
      if (listbox.handleKeyDown(event)) return true;
      if (event.key === 'Enter') {
        event.preventDefault();
        return commitFreeText();
      }
      return false;
    },
    [isMany, commitSelection, commitFreeText, listbox],
  );

  return {
    isMany,
    selected,
    toggle,
    listbox,
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
