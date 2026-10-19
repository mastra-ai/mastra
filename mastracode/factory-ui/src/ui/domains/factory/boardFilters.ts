import type { FilterBarItem } from '@mastra/playground-ui/components/FilterBar';

import {
  boardLabelsFromQuery,
  boardLabelsQueryValues,
  boardRelevanceFromQuery,
  boardRelevanceOptions,
  boardRelevanceQueryValue,
} from './boardRelevance';
import type { BoardRelevanceType } from './boardRelevance';
import type { BoardKind } from './boardStages';

/** Field ids shared by the saved-view filter items and the query parameters they round-trip through. */
export const BOARD_FILTER_FIELD = {
  teammate: 'teammate',
  relevance: 'relevance',
  label: 'label',
  source: 'source',
  linearProject: 'linearProject',
} as const;

/** Query parameters each board narrowing is stored in. */
export const BOARD_FILTER_QUERY = {
  teammate: 'teammate',
  relevance: 'relevance',
  label: 'label',
  source: 'source',
  linearProject: 'linearProject',
} as const;

/** Every board narrowing in one value: what the URL carries, and what the cards are matched against. */
export interface BoardFilterState {
  /** Every identity of the people narrowed to (a Factory account and its GitHub login…). Empty = everyone. */
  participantIds: ReadonlySet<string>;
  /** Relevance kinds kept for the selected teammates. The full set means "not narrowed". */
  relevanceTypes: ReadonlySet<BoardRelevanceType>;
  labels: ReadonlySet<string>;
  sources: ReadonlySet<string>;
  linearProjectIds: ReadonlySet<string>;
}

export function boardFiltersFromParams(params: URLSearchParams, kind: BoardKind): BoardFilterState {
  return {
    participantIds: new Set(params.getAll(BOARD_FILTER_QUERY.teammate).filter(Boolean)),
    relevanceTypes: boardRelevanceFromQuery(params.get(BOARD_FILTER_QUERY.relevance), kind),
    labels: boardLabelsFromQuery(params.getAll(BOARD_FILTER_QUERY.label)),
    sources: new Set(params.getAll(BOARD_FILTER_QUERY.source).filter(Boolean)),
    linearProjectIds: new Set(params.getAll(BOARD_FILTER_QUERY.linearProject).filter(Boolean)),
  };
}

/** Copy of `params` carrying `state`, leaving every unrelated parameter untouched. */
export function boardFilterParams(params: URLSearchParams, state: BoardFilterState, kind: BoardKind): URLSearchParams {
  const next = new URLSearchParams(params);
  const relevance = state.participantIds.size > 0 ? boardRelevanceQueryValue(state.relevanceTypes, kind) : undefined;
  const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key));

  next.delete(BOARD_FILTER_QUERY.teammate);
  for (const participantId of state.participantIds) next.append(BOARD_FILTER_QUERY.teammate, participantId);
  set(BOARD_FILTER_QUERY.relevance, relevance);
  next.delete(BOARD_FILTER_QUERY.label);
  for (const label of boardLabelsQueryValues(state.labels)) next.append(BOARD_FILTER_QUERY.label, label);
  for (const [key, values] of [
    [BOARD_FILTER_QUERY.source, state.sources],
    [BOARD_FILTER_QUERY.linearProject, state.linearProjectIds],
  ] as const) {
    next.delete(key);
    for (const value of values) next.append(key, value);
  }
  return next;
}

/** The open card and the comment it deep-links to are one selection: clear them together. */
export function clearOpenCard(params: URLSearchParams) {
  params.delete('item');
  params.delete('comment');
}

/** Whether anything is narrowing the board — the one fact both the bar and the empty state read. */
export function boardFiltersActive(state: BoardFilterState, kind: BoardKind): boolean {
  return (
    state.participantIds.size > 0 ||
    state.labels.size > 0 ||
    state.sources.size > 0 ||
    state.linearProjectIds.size > 0 ||
    boardRelevanceQueryValue(state.relevanceTypes, kind) !== undefined
  );
}

const asStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
};

/** One item per active narrowing, keyed by field id so the URL order is the item order. */
export function boardFilterItems(state: BoardFilterState, kind: BoardKind): FilterBarItem[] {
  const items: FilterBarItem[] = [];
  if (state.participantIds.size > 0) {
    items.push({
      id: BOARD_FILTER_FIELD.teammate,
      fieldId: BOARD_FILTER_FIELD.teammate,
      operatorId: 'in',
      value: [...state.participantIds],
    });
  }
  if (state.participantIds.size > 0 && boardRelevanceQueryValue(state.relevanceTypes, kind)) {
    items.push({
      id: BOARD_FILTER_FIELD.relevance,
      fieldId: BOARD_FILTER_FIELD.relevance,
      operatorId: 'in',
      value: [...state.relevanceTypes],
    });
  }
  if (state.labels.size > 0) {
    items.push({
      id: BOARD_FILTER_FIELD.label,
      fieldId: BOARD_FILTER_FIELD.label,
      operatorId: 'in',
      value: [...state.labels],
    });
  }
  for (const [fieldId, values] of [
    [BOARD_FILTER_FIELD.source, state.sources],
    [BOARD_FILTER_FIELD.linearProject, state.linearProjectIds],
  ] as const) {
    if (values.size > 0) items.push({ id: fieldId, fieldId, operatorId: 'in', value: [...values] });
  }
  return items;
}

/** Values checked for one filter field. Relevance is never empty: every kind counts until some are unchecked. */
export function boardFilterValues(state: BoardFilterState, kind: BoardKind, fieldId: string): string[] {
  if (fieldId === BOARD_FILTER_FIELD.relevance) return [...state.relevanceTypes];
  return asStrings(boardFilterItems(state, kind).find(item => item.fieldId === fieldId)?.value);
}

/** `state` with one field's picked values replaced; no values drops the field. */
export function withBoardFilterValues(
  state: BoardFilterState,
  kind: BoardKind,
  fieldId: string,
  values: readonly string[],
): BoardFilterState {
  const items = boardFilterItems(state, kind).filter(item => item.fieldId !== fieldId);
  if (values.length > 0) items.push({ id: fieldId, fieldId, operatorId: 'in', value: [...values] });
  return boardFilterStateFromItems(items, kind);
}

/**
 * Filter state the items describe. An item with an empty value narrows nothing; dropping the
 * relevance item restores every relevance kind. Each dimension holds one item, so a later item
 * for the same field replaces an earlier one rather than stacking.
 */
export function boardFilterStateFromItems(items: readonly FilterBarItem[], kind: BoardKind): BoardFilterState {
  const valueOf = (fieldId: string) => items.findLast(item => item.fieldId === fieldId)?.value;
  const relevance = asStrings(valueOf(BOARD_FILTER_FIELD.relevance));
  const available = boardRelevanceOptions(kind).map(option => option.id);
  const selected = available.filter(type => relevance.includes(type));

  return {
    participantIds: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.teammate))),
    relevanceTypes: new Set(selected.length > 0 ? selected : available),
    labels: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.label))),
    sources: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.source))),
    linearProjectIds: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.linearProject))),
  };
}
