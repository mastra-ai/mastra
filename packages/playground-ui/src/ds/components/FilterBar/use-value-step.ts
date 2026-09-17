import { useCallback, useEffect, useId, useRef, useState } from 'react';
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

function getNumberValidationMessage(type: FilterBarField['type'], text: string) {
  if (type !== 'number' || text.length === 0) return undefined;
  return Number.isFinite(Number(text)) ? undefined : 'Enter a number.';
}

export function useValueStep({ field, operator, query, enabled, initialValue, onCommit }: UseValueStepOptions) {
  const validationMessageId = useId();
  const isMany = operator?.arity === 'many';
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
  const canValidateQuery =
    enabled && !suggestions.isLoading && suggestions.error === undefined && suggestions.options.length === 0;

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
    (text: string) => allowFreeText && text.length > 0 && getNumberValidationMessage(type, text) === undefined,
    [allowFreeText, type],
  );

  const commitFreeText = useCallback(() => {
    const text = query.trim();
    if (!canCommitFreeText(text)) return false;
    commit(isMany ? (selected.includes(text) ? selected : [...selected, text]) : text);
    return true;
  }, [canCommitFreeText, query, isMany, selected, commit]);

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
    validationMessage: canValidateQuery ? getNumberValidationMessage(type, query.trim()) : undefined,
    validationMessageId,
    canCommitQuery: canCommitFreeText(query.trim()),
    handleSelect,
    handleKeyDown,
    commitSelection,
    commitFreeText,
  };
}
