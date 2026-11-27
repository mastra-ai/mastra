import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { FilterBarAdvancedChip } from './filter-bar-advanced-chip';
import { FilterBarChip } from './filter-bar-chip';
import { FilterBarClear } from './filter-bar-clear';
import { FILTER_BAR_SCOPE_ATTR, FilterBarProvider, useFilterBarContext } from './filter-bar-context';
import { FilterBarLogicToggle } from './filter-bar-group-editor';
import { FilterBarInput } from './filter-bar-input';
import { FilterBarTimeRange } from './filter-bar-time-range';
import { ROOT_GROUP_ID } from './filter-bar-tree';
import { isFilterBarGroup } from './types';
import type {
  FilterBarCustomField,
  FilterBarExpression,
  FilterBarField,
  FilterBarItem,
  FilterBarOperator,
  FilterBarPlace,
  FilterBarScope,
} from './types';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

type FilterBarValueProps =
  | {
      /** Flat list of filters, implicitly joined with `and`. Advanced filters are never offered. */
      value: FilterBarItem[];
      onValueChange: (items: FilterBarItem[]) => void;
    }
  | {
      /**
       * Tree of filters and groups. Root nodes are joined with the expression's `logic` (`and`
       * unless `rootLogicToggle` lets the user switch it); each root group renders as one
       * "Advanced filter" chip whose popover edits the nested `and` / `or` logic.
       */
      value: FilterBarExpression;
      onValueChange: (expression: FilterBarExpression) => void;
    };

export type FilterBarProps = FilterBarValueProps & {
  fields: FilterBarField[];
  operators: FilterBarOperator[];
  /**
   * Id given to a newly added item. Defaults to a random id. Consumers that rebuild `value` from
   * their own store (URL, query params…) should return the id they will rebuild it with, so the
   * draft chip and the committed chip are the same element.
   */
  createItemId?: (fieldId: string) => string;
  /** How deep advanced-filter groups may nest (root-level group = 1). Defaults to 3. */
  maxDepth?: number;
  'aria-label'?: string;
  /**
   * Text shown in a value list when the field's `suggestions` resolver rejects, for example
   * to explain a server limit. Return `undefined` to keep the default "Couldn't load values.".
   */
  describeSuggestionsError?: (error: unknown) => string | undefined;
  /** Lets each condition and group be negated ("not …"), stored as `negated: true` on the node. */
  negatable?: boolean;
  /**
   * Shows an `and` / `or` toggle between root chips that switches the expression's root logic.
   * Ignored for a flat `value`, which has no logic to keep.
   */
  rootLogicToggle?: boolean;
  /**
   * Lets the field step take a name outside `fields` under a prefix (e.g. `metadata.` + what
   * was typed). Keep the object stable: custom fields are cached per instance.
   */
  customField?: FilterBarCustomField;
  /**
   * Message for a committed condition that is wrong where it sits (e.g. an operator not allowed
   * under a negation); shown on its chip. Field-level `validateInput` runs first.
   */
  validateItem?: (item: FilterBarItem, place: FilterBarPlace) => string | undefined;
  /**
   * Operator ids a field allows where a condition sits (e.g. no word search under a negation);
   * `undefined` keeps every operator of the field. Fields left with none are not offered there,
   * and a chip whose operator is ruled out reads invalid. Keep the function stable.
   */
  operatorsFor?: (field: FilterBarField, place: FilterBarPlace) => readonly string[] | undefined;
  /**
   * Related clauses a group can read ("Has spans where …"): each scope brings its own fields
   * and quantifiers. Offered from the bar and from the advanced editor; ignored for flat values.
   */
  scopes?: readonly FilterBarScope[];
  /** Most related clauses the value may hold. Unlimited by default. */
  maxScopedGroups?: number;
  /** Accessible label of the trailing "remove every filter" button. */
  clearLabel?: string;
  className?: string;
  children: ReactNode;
};

function FilterBarSurface({
  className,
  clearLabel,
  children,
}: {
  className?: string;
  clearLabel: string;
  children: ReactNode;
}) {
  const ctx = useFilterBarContext();
  return (
    <div
      role="group"
      aria-label={ctx.ariaLabel}
      data-slot="filter-bar"
      {...{ [FILTER_BAR_SCOPE_ATTR]: 'bar' }}
      className={cn(
        // No chrome of its own: chips and the typeahead input sit directly on the parent surface.
        // Layout: chips, input, then Clear right beside the input — all in one wrapping row so
        // Clear never drifts to the far edge of a wide container.
        'flex w-full flex-wrap items-center gap-1.5',
        className,
      )}
    >
      {children}
      <span className="flex shrink-0 items-center empty:hidden">
        <FilterBarClear label={clearLabel} />
      </span>
      <VisuallyHidden aria-live="polite">{ctx.announcement}</VisuallyHidden>
    </div>
  );
}

/**
 * Braintrust-style filter bar: `field → operator → value` filters built from a
 * single typeahead input, rendered as inline editable chips. Domain-agnostic —
 * fields, operators and values are plain strings supplied by the consumer.
 *
 * Pass a `FilterBarExpression` as `value` to enable Linear-style advanced filters:
 * the input offers "Advanced filter…", which adds one chip whose popover hosts a
 * recursive rule builder (`and` / `or` connectors, nested groups). The bar itself
 * stays flat. A flat `FilterBarItem[]` stays flat.
 *
 * @example
 * <FilterBar value={items} onValueChange={setItems} fields={fields} operators={DEFAULT_FILTER_OPERATORS}>
 *   <FilterBar.Chips />
 *   <FilterBar.Input />
 * </FilterBar>
 */
export function FilterBar({
  fields,
  operators,
  value,
  onValueChange,
  createItemId,
  maxDepth,
  'aria-label': ariaLabel = 'Filters',
  describeSuggestionsError,
  negatable,
  rootLogicToggle,
  customField,
  validateItem,
  operatorsFor,
  scopes,
  maxScopedGroups,
  clearLabel = 'Clear filters',
  className,
  children,
}: FilterBarProps) {
  return (
    <FilterBarProvider
      fields={fields}
      operators={operators}
      value={value}
      onValueChange={onValueChange}
      createItemId={createItemId}
      maxDepth={maxDepth}
      ariaLabel={ariaLabel}
      describeSuggestionsError={describeSuggestionsError}
      negatable={negatable}
      rootLogicToggle={rootLogicToggle}
      customField={customField}
      validateItem={validateItem}
      operatorsFor={operatorsFor}
      scopes={scopes}
      maxScopedGroups={maxScopedGroups}
    >
      <FilterBarSurface className={className} clearLabel={clearLabel}>
        {children}
      </FilterBarSurface>
    </FilterBarProvider>
  );
}

/**
 * Default layout: one editable chip per root item, one "Advanced filter" chip per root
 * group, in order, then the chip of the filter being built in the bar's input (which
 * becomes the last item's chip once committed).
 */
export function FilterBarChips({ renderChip = defaultRenderChip }: FilterBarChipsProps) {
  const ctx = useFilterBarContext();
  // One keyed array: the draft chip and the item it becomes share a key, so React
  // keeps the element across the commit instead of mounting a new chip.
  const chips: ReactNode[] = [];
  // The toggle sits inside the fragment of the chip it precedes, so it keeps that key too.
  const push = (id: string, chip: ReactNode) => {
    const joined = ctx.rootLogicToggle && chips.length > 0;
    chips.push(
      <Fragment key={id}>
        {joined && (
          <FilterBarLogicToggle groupId={ROOT_GROUP_ID} logic={ctx.expression.logic} className="w-auto px-1.5" />
        )}
        {chip}
      </Fragment>,
    );
  };
  for (const node of ctx.expression.nodes) {
    const chip = isFilterBarGroup(node) ? <FilterBarAdvancedChip group={node} /> : renderChip(node);
    if (chip !== null) push(node.id, chip);
  }
  if (ctx.draft && !ctx.draft.groupId) {
    // `FilterBarChip` needs a full item; the draft's missing parts are blank until picked.
    const { id, fieldId, operatorId = '' } = ctx.draft;
    push(id, <FilterBarChip draft item={{ id, fieldId, operatorId, value: '' }} />);
  }
  return <>{chips}</>;
}

export type FilterBarChipsProps = {
  /**
   * Chip for an item; return `null` to render none (e.g. an item only held in the
   * value for scoping). Defaults to a plain editable `FilterBar.Chip`.
   */
  renderChip?: (item: FilterBarItem) => ReactNode;
};

const defaultRenderChip = (item: FilterBarItem) => <FilterBarChip item={item} />;

FilterBar.Chips = FilterBarChips;
FilterBar.Chip = FilterBarChip;
FilterBar.AdvancedChip = FilterBarAdvancedChip;
FilterBar.Input = FilterBarInput;
FilterBar.TimeRange = FilterBarTimeRange;
