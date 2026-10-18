import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { matchesQuery } from './match-query';
import type { FilterBarField, FilterBarOperator, FilterBarOption, FilterBarValue } from './types';
import { parseFieldValue } from './types';
import { useValueSuggestions } from './use-value-suggestions';

export type UseValueStepOptions = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  query: string;
  enabled: boolean;
  initialValue?: FilterBarValue;
  /** Replaces the query; many arity clears it after adding typed text to the selection. */
  setQuery: (query: string) => void;
  onCommit: (value: FilterBarValue) => void;
};

const toStrings = (value: FilterBarValue | undefined): string[] => (Array.isArray(value) ? value.map(String) : []);

/**
 * Shared value-editing logic for the typeahead value step and the chip value
 * editor. Single arity: picking an option (or Enter on free text) commits.
 * Many arity: Enter/click toggles the highlighted option, Enter on free text adds
 * it to the selection; Ctrl/Meta+Enter (or `commitDone`) commits the selection.
 * List navigation itself is owned by the surrounding `ComboboxPrimitive.Root`.
 */
export function useValueStep({
  field,
  operator,
  query,
  enabled,
  initialValue,
  setQuery,
  onCommit,
}: UseValueStepOptions) {
  const isMany = operator?.arity === 'many';
  // Selection is tracked as option strings; values are parsed to the field type on commit.
  const [selected, setSelected] = useState<string[]>(() => toStrings(initialValue));
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  // The editor stays mounted across opens: re-seed from the current value each time it opens.
  useEffect(() => {
    setSelected(enabled ? toStrings(initialValueRef.current) : []);
  }, [enabled]);

  const freeTextOperator = operator?.freeText === true;
  const suggestions = useValueSuggestions({
    field: freeTextOperator ? undefined : field,
    operatorId: operator?.id ?? '',
    query,
    enabled,
  });
  const type = field?.type;
  const allowFreeText = (!field?.strict || freeTextOperator) && type !== 'boolean';

  // Selected values the suggestions do not list (typed in, or not matching the current
  // search) are listed too, so every value of a multi-selection can be seen and removed.
  // Memoized for correctness, not speed: these are the Combobox `items`, and Base UI
  // re-syncs (and loops on "Maximum update depth exceeded") when it gets a new array each render.
  const options = useMemo(() => {
    if (!isMany) return suggestions.options;
    const unlisted = unlistedSelection(selected, suggestions.options, suggestions.hasSuggestions, query);
    if (unlisted.length === 0) return suggestions.options;
    return [...suggestions.options, ...unlisted];
  }, [isMany, selected, suggestions.options, suggestions.hasSuggestions, query]);

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
    (text: string) =>
      allowFreeText &&
      text.length > 0 &&
      (type !== 'number' || Number.isFinite(Number(text))) &&
      // A text-match literal needs a word: letters, marks, or digits.
      (!freeTextOperator || /[\p{L}\p{M}\p{N}]/u.test(text)),
    [allowFreeText, freeTextOperator, type],
  );

  /** Many arity: adds the typed text to the selection and clears the query, keeping the editor open. */
  function addFreeText() {
    const text = query.trim();
    if (!canCommitFreeText(text)) return false;
    setSelected(current => (current.includes(text) ? current : [...current, text]));
    setQuery('');
    return true;
  }

  const commitFreeText = useCallback(() => {
    const text = query.trim();
    if (!canCommitFreeText(text)) return false;
    commit(isMany ? (selected.includes(text) ? selected : [...selected, text]) : text);
    return true;
  }, [canCommitFreeText, query, isMany, selected, commit]);

  /** Enter on free text (or Apply): commits a single value, adds to a multi-selection. */
  function submitFreeText() {
    if (isMany) return addFreeText();
    return commitFreeText();
  }

  /** Done (or Ctrl/Meta+Enter) on a multi-selection. */
  function commitDone() {
    // Typed text that matches no suggestion is a value being entered (Enter would add it), so it
    // joins the selection. Text that matches suggestions is a search and is left out.
    if (suggestions.options.length === 0) return commitFreeText() || commitSelection();
    return commitSelection() || commitFreeText();
  }

  /**
   * Enter handling that Base UI does not cover: Ctrl/Meta+Enter commits a
   * multi-selection; plain Enter with nothing highlighted submits free text.
   * Returns `true` when the event was consumed.
   */
  function handleKeyDown(event: KeyboardEvent, highlighted: FilterBarOption | null): boolean {
    if (event.key !== 'Enter') return false;
    if (isMany && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      return commitDone();
    }
    if (highlighted === null) {
      event.preventDefault();
      return submitFreeText();
    }
    return false;
  }

  return {
    isMany,
    selected,
    toggle,
    options,
    isLoading: suggestions.isLoading,
    error: suggestions.error,
    hasSuggestions: suggestions.hasSuggestions,
    /** True when there is a list to show: suggestions, or values already added to a multi-selection. */
    hasOptions: suggestions.hasSuggestions || options.length > 0,
    allowFreeText,
    /** True when the current query can be committed as free text (non-empty, numeric when the field is a number). */
    canCommitQuery: canCommitFreeText(query.trim()),
    handleSelect,
    handleKeyDown,
    submitFreeText,
    commitDone,
  };
}

/** Selected values missing from `options`; with suggestions, only those matching the search. */
function unlistedSelection(
  selected: string[],
  options: FilterBarOption[],
  hasSuggestions: boolean,
  query: string,
): FilterBarOption[] {
  const listed = new Set(options.map(option => option.value));
  const isShown = (value: string) => !hasSuggestions || matchesQuery(value, query);
  return selected.filter(value => !listed.has(value) && isShown(value)).map(value => ({ value }));
}
