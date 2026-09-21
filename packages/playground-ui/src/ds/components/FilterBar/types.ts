import type { LucideIcon } from 'lucide-react';

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
  /** Leading icon, shown in the field step and on the chip's field segment. */
  icon?: LucideIcon;
  /** Accent (any CSS color) applied to the chip's field segment (label + icon). */
  color?: string;
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

/**
 * The filter being built in the typeahead input. Its `id` is kept when it becomes an
 * item, so the chip rendered for the draft is the very node the committed chip lands on.
 */
export type FilterBarDraft = {
  id: string;
  fieldId: string;
  operatorId?: string;
  /** What the draft chip showed before this step, so only the new segments animate in. */
  from: DraftStage;
};

/** How far a draft had progressed: nothing yet, its field, or its field and operator. */
export type DraftStage = 'none' | 'field' | 'operator';

/** The draft that just became an item — the chip glints once, then settles. */
export type FilterBarCommit = {
  id: string;
  from: DraftStage;
};

export type FilterBarSegment = 'field' | 'operator' | 'value' | 'remove';
