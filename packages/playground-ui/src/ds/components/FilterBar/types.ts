import type { ReactNode } from 'react';

/** How many values an operator takes: `none` (is empty), `one` (default) or `many` (string[]). */
export type FilterBarArity = 'none' | 'one' | 'many';

export type FilterBarOperator = {
  id: string;
  label: string;
  arity?: FilterBarArity;
};

export type FilterBarOption = {
  value: string;
  label?: string;
};

export type FilterBarSuggestionsContext = {
  query: string;
  operatorId: string;
  signal: AbortSignal;
};

export type FilterBarSuggestionsResolver = (
  ctx: FilterBarSuggestionsContext,
) => FilterBarOption[] | Promise<FilterBarOption[]>;

/**
 * Value kind of a field. Defaults to `text`.
 * - `number`: free text must parse as a finite number; the input gets a decimal keyboard.
 * - `boolean`: strict `true` / `false` suggestions are provided unless the field supplies its own.
 */
export type FilterBarFieldType = 'text' | 'number' | 'boolean';

/** A committed scalar value, typed according to the field's `type`. */
export type FilterBarScalar = string | number | boolean;
export type FilterBarValue = FilterBarScalar | FilterBarScalar[];

/** Parses raw input text into the field's value type. Suggestion values and free text both go through this. */
export const parseFieldValue = (type: FilterBarFieldType | undefined, text: string): FilterBarScalar => {
  if (type === 'number') return Number(text);
  if (type === 'boolean') return text.toLowerCase() === 'true';
  return text;
};

export type FilterBarField = {
  id: string;
  label: string;
  icon?: ReactNode;
  type?: FilterBarFieldType;
  /** Operator ids allowed for this field. Defaults to every root operator. */
  operators?: string[];
  /**
   * Optional value suggestions. Absent → free text.
   * - array: static list, filtered locally by the query.
   * - function: lazy resolver, called only once the value step opens (never at
   *   mount), re-invoked (debounced) when the query changes. Receives an
   *   AbortSignal; stale responses are discarded.
   */
  suggestions?: FilterBarOption[] | FilterBarSuggestionsResolver;
  /** When true, the value must come from suggestions (no free text). */
  strict?: boolean;
  /** Never offered in the input's field step; existing chips for it still render with the field label. */
  hidden?: boolean;
};

export type FilterBarItem = {
  id: string;
  fieldId: string;
  operatorId: string;
  value: FilterBarValue;
};

export type FilterBarSegment = 'field' | 'operator' | 'value' | 'remove';
