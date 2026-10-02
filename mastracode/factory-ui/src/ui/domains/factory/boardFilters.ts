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

/** Field ids shared by the filter bar chips and the query parameters they round-trip through. */
export const BOARD_FILTER_FIELD = {
  text: 'text',
  teammate: 'teammate',
  relevance: 'relevance',
  label: 'label',
} as const;

/** Query parameters each board narrowing is stored in. */
export const BOARD_FILTER_QUERY = {
  search: 'q',
  teammate: 'teammate',
  relevance: 'relevance',
  label: 'label',
} as const;

/** Every board narrowing in one value: what the URL carries, and what the cards are matched against. */
export interface BoardFilterState {
  search: string;
  /** Every identity of the people narrowed to (a Factory account and its GitHub login…). Empty = everyone. */
  participantIds: ReadonlySet<string>;
  /** Relevance kinds kept for the selected teammates. The full set means "not narrowed". */
  relevanceTypes: ReadonlySet<BoardRelevanceType>;
  labels: ReadonlySet<string>;
}

export function boardFiltersFromParams(params: URLSearchParams, kind: BoardKind): BoardFilterState {
  return {
    search: params.get(BOARD_FILTER_QUERY.search) ?? '',
    participantIds: new Set(params.getAll(BOARD_FILTER_QUERY.teammate).filter(Boolean)),
    relevanceTypes: boardRelevanceFromQuery(params.get(BOARD_FILTER_QUERY.relevance), kind),
    labels: boardLabelsFromQuery(params.getAll(BOARD_FILTER_QUERY.label)),
  };
}

/** Copy of `params` carrying `state`, leaving every unrelated parameter untouched. */
export function boardFilterParams(params: URLSearchParams, state: BoardFilterState, kind: BoardKind): URLSearchParams {
  const next = new URLSearchParams(params);
  const relevance = state.participantIds.size > 0 ? boardRelevanceQueryValue(state.relevanceTypes, kind) : undefined;
  const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key));

  set(BOARD_FILTER_QUERY.search, state.search.trim() || undefined);
  next.delete(BOARD_FILTER_QUERY.teammate);
  for (const participantId of state.participantIds) next.append(BOARD_FILTER_QUERY.teammate, participantId);
  set(BOARD_FILTER_QUERY.relevance, relevance);
  next.delete(BOARD_FILTER_QUERY.label);
  for (const label of boardLabelsQueryValues(state.labels)) next.append(BOARD_FILTER_QUERY.label, label);
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
    state.search !== '' ||
    state.participantIds.size > 0 ||
    state.labels.size > 0 ||
    boardRelevanceQueryValue(state.relevanceTypes, kind) !== undefined
  );
}

const asStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
};

/** One chip per active narrowing, keyed by field id so the URL order is the chip order. */
export function boardFilterItems(state: BoardFilterState, kind: BoardKind): FilterBarItem[] {
  const items: FilterBarItem[] = [];
  if (state.search) {
    items.push({
      id: BOARD_FILTER_FIELD.text,
      fieldId: BOARD_FILTER_FIELD.text,
      operatorId: 'contains',
      value: state.search,
    });
  }
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
  return items;
}

/**
 * Filter state the chips describe. A chip whose value is still being picked carries an empty
 * value and narrows nothing; dropping the relevance chip restores every relevance kind. Each
 * dimension holds one chip, so re-picking a field replaces it rather than stacking a second.
 */
export function boardFilterStateFromItems(items: readonly FilterBarItem[], kind: BoardKind): BoardFilterState {
  const valueOf = (fieldId: string) => items.findLast(item => item.fieldId === fieldId)?.value;
  const relevance = asStrings(valueOf(BOARD_FILTER_FIELD.relevance));
  const available = boardRelevanceOptions(kind).map(option => option.id);
  const selected = available.filter(type => relevance.includes(type));
  const search = valueOf(BOARD_FILTER_FIELD.text);

  return {
    search: typeof search === 'string' ? search : '',
    participantIds: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.teammate))),
    relevanceTypes: new Set(selected.length > 0 ? selected : available),
    labels: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.label))),
  };
}
