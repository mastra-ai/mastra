import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** How many values an operator takes: `none` (is empty), `one` (default) or `many` (string[]). */
export type FilterBarArity = 'none' | 'one' | 'many';

export type FilterBarOperator = {
  id: string;
  label: string;
  arity?: FilterBarArity;
  /**
   * The value is typed text, such as a word to match: the field's suggestions are not offered
   * and a `strict` field accepts free text.
   */
  freeText?: boolean;
  /**
   * Id of the `many` operator that holds several of this operator's values (`is` → `is any of`).
   * When items are keyed by field (`createItemId`), adding another value to a field filtered
   * with this operator widens its chip to that operator instead of replacing the value.
   */
  widensTo?: string;
};

export type FilterBarOption = {
  value: string;
  label?: string;
  /** Leading node (avatar, swatch, icon) rendered before the label in value lists. */
  start?: ReactNode;
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
  /** Keep the operator label visible even when this field allows only one operator. */
  alwaysShowOperator?: boolean;
  /** Field-specific labels for operators, keyed by operator id (e.g. `notExists` → `is not recorded`). */
  operatorLabels?: Record<string, string>;
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
  /** Only offered at the root, for query options that cannot be nested in boolean groups. */
  rootOnly?: boolean;
  /** Cannot replace another chip's field when this field already has a chip. */
  singleton?: boolean;
  /** A validation message prevents committing free text until the input is valid. */
  validateInput?: (value: string) => string | undefined;
  /**
   * Free-text entry point. The field stays offered in the input's field step whatever the
   * query, so typed text never dead-ends on "No matching field"; picking it with text typed
   * commits that text as the value under the field's first operator, skipping both steps.
   * List it first to make it the default landing option.
   */
  search?: boolean;
};

export type FilterBarItem = {
  id: string;
  fieldId: string;
  operatorId: string;
  value: FilterBarValue;
  /** Matches what the condition does not. Only offered when the bar is `negatable`. */
  negated?: boolean;
};

export type FilterBarLogic = 'and' | 'or';

/**
 * Sub-filters joined by a single logic connector. Groups nest recursively (bounded by the
 * bar's `maxDepth`); a root-level group renders as one "Advanced filter" chip whose popover
 * edits the whole subtree.
 */
export type FilterBarGroup = {
  id: string;
  kind: 'group';
  logic: FilterBarLogic;
  nodes: FilterBarNode[];
  /** Matches what the group as a whole does not. Only offered when the bar is `negatable`. */
  negated?: boolean;
  /**
   * Conditions about related records rather than the filtered one ("has spans where…"): the
   * group's conditions use the scope's fields, joined to the record by the quantifier.
   */
  scope?: FilterBarGroupScope;
};

/** Which of the bar's `scopes` a group reads, and how it relates to the record. */
export type FilterBarGroupScope = {
  id: string;
  quantifierId: string;
};

export type FilterBarQuantifier = {
  id: string;
  /** Leads the group's header, e.g. `Has` / `Has no`. */
  label: string;
};

/**
 * A set of related records conditions can be about (spans of a trace, its scores…). Groups
 * reading it offer its own fields instead of the bar's.
 */
export type FilterBarScope = {
  id: string;
  /** Plural noun read after the quantifier: `Has` **spans** `where…`. */
  label: string;
  fields: FilterBarField[];
  /** The first one is the default for a new group. */
  quantifiers: FilterBarQuantifier[];
  /** Free-text field names offered inside the scope (see `FilterBarCustomField`). */
  customField?: FilterBarCustomField;
};

/**
 * Lets the field step take a name that is not in the list, under a fixed prefix (e.g.
 * `metadata.` + whatever is typed). The field's id and label are the full name; the rest
 * comes from `field`.
 */
export type FilterBarCustomField = {
  prefix: string;
  field?: Omit<FilterBarField, 'id' | 'label'>;
};

/** Where a condition sits: the facts operators and validation may depend on. */
export type FilterBarPlace = {
  /** Group holding it; `undefined` = root. */
  groupId?: string;
  /** It, or a group above it, is negated. */
  negated: boolean;
  /** Nearest scoped group above it. */
  scope?: FilterBarGroupScope;
};

export type FilterBarNode = FilterBarItem | FilterBarGroup;

/**
 * Tree-shaped value: root nodes joined by `logic`, groups nest their own. The bar joins root
 * nodes with `'and'` unless it offers a `rootLogicToggle`.
 */
export type FilterBarExpression = {
  logic: FilterBarLogic;
  nodes: FilterBarNode[];
};

export const isFilterBarGroup = (node: FilterBarNode): node is FilterBarGroup =>
  'kind' in node && node.kind === 'group';

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
  /** Group the draft is being built inside; `undefined` = root. */
  groupId?: string;
};

/** How far a draft had progressed: nothing yet, its field, or its field and operator. */
export type DraftStage = 'none' | 'field' | 'operator';

/**
 * The draft that just became an item. The provider keeps showing it until the consumer's
 * `value` includes it (URL-backed consumers update a tick later); the chip glints once, then settles.
 */
export type FilterBarCommit = {
  item: FilterBarItem;
  from: DraftStage;
  glint: boolean;
  /** Group the item was committed into; `undefined` = root. */
  groupId?: string;
};

export type FilterBarSegment = 'negate' | 'field' | 'operator' | 'value' | 'remove';
