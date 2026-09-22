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

/** Every board narrowing in one value: what the URL carries, and what the cards are matched against. */
export interface BoardFilterState {
  search: string;
  participantId?: string;
  /** Relevance kinds kept for the selected teammate. The full set means "not narrowed". */
  relevanceTypes: ReadonlySet<BoardRelevanceType>;
  labels: ReadonlySet<string>;
}

export function boardFiltersFromParams(params: URLSearchParams, kind: BoardKind): BoardFilterState {
  return {
    search: params.get('q') ?? '',
    participantId: params.get('teammate') || undefined,
    relevanceTypes: boardRelevanceFromQuery(params.get('relevance'), kind),
    labels: boardLabelsFromQuery(params.getAll('label')),
  };
}

/** Copy of `params` carrying `state`, leaving every unrelated parameter untouched. */
export function boardFilterParams(params: URLSearchParams, state: BoardFilterState, kind: BoardKind): URLSearchParams {
  const next = new URLSearchParams(params);
  const relevance = state.participantId ? boardRelevanceQueryValue(state.relevanceTypes, kind) : undefined;
  const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key));

  set('q', state.search.trim() || undefined);
  set('teammate', state.participantId);
  set('relevance', relevance);
  next.delete('label');
  for (const label of boardLabelsQueryValues(state.labels)) next.append('label', label);
  return next;
}

/** Whether anything is narrowing the board — the one fact both the bar and the empty state read. */
export function boardFiltersActive(state: BoardFilterState, kind: BoardKind): boolean {
  return (
    state.search !== '' ||
    state.participantId !== undefined ||
    state.labels.size > 0 ||
    boardRelevanceQueryValue(state.relevanceTypes, kind) !== undefined
  );
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

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
  if (state.participantId) {
    items.push({
      id: BOARD_FILTER_FIELD.teammate,
      fieldId: BOARD_FILTER_FIELD.teammate,
      operatorId: 'is',
      value: state.participantId,
    });
  }
  if (state.participantId && boardRelevanceQueryValue(state.relevanceTypes, kind)) {
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
  const teammate = valueOf(BOARD_FILTER_FIELD.teammate);

  return {
    search: typeof search === 'string' ? search : '',
    participantId: typeof teammate === 'string' && teammate !== '' ? teammate : undefined,
    relevanceTypes: new Set(selected.length > 0 ? selected : available),
    labels: new Set(asStrings(valueOf(BOARD_FILTER_FIELD.label))),
  };
}
