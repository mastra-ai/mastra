import type { FilterBarItem } from '@mastra/playground-ui/components/FilterBar';

import { BOARD_PERSON_FIELDS } from './boardPeople';
import type { BoardKind } from './boardStages';

/** Every board filter, in menu order. Each id is also its query parameter and its saved-view item's `fieldId`. */
export const BOARD_FILTER_FIELDS = ['source', 'linearProject', ...BOARD_PERSON_FIELDS, 'label'] as const;
export type BoardFilterFieldId = (typeof BOARD_FILTER_FIELDS)[number];

/** The values picked per filter. An empty set narrows nothing; filters combine with AND. */
export type BoardFilterState = Readonly<Record<BoardFilterFieldId, ReadonlySet<string>>>;

/** Requested reviewers only exist on pull requests, so only the Review board filters by them. */
export function boardFilterFieldIds(kind: BoardKind): BoardFilterFieldId[] {
  return BOARD_FILTER_FIELDS.filter(fieldId => fieldId !== 'reviewer' || kind === 'review');
}

function boardFilterState(kind: BoardKind, valuesOf: (fieldId: BoardFilterFieldId) => readonly unknown[]) {
  const offered = new Set(boardFilterFieldIds(kind));
  const state: Record<BoardFilterFieldId, ReadonlySet<string>> = {
    source: new Set(),
    linearProject: new Set(),
    teammate: new Set(),
    author: new Set(),
    assignee: new Set(),
    reviewer: new Set(),
    worked: new Set(),
    label: new Set(),
  };
  for (const fieldId of offered) {
    state[fieldId] = new Set(
      valuesOf(fieldId).flatMap(value => (typeof value === 'string' && value.trim() ? [value.trim()] : [])),
    );
  }
  return state;
}

export function boardFiltersFromParams(params: URLSearchParams, kind: BoardKind): BoardFilterState {
  return boardFilterState(kind, fieldId => params.getAll(fieldId));
}

/** Copy of `params` carrying `state`, leaving every unrelated parameter untouched. */
export function boardFilterParams(params: URLSearchParams, state: BoardFilterState): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const fieldId of BOARD_FILTER_FIELDS) {
    next.delete(fieldId);
    for (const value of state[fieldId]) next.append(fieldId, value);
  }
  return next;
}

/** The open card and the comment it deep-links to are one selection: clear them together. */
export function clearOpenCard(params: URLSearchParams) {
  params.delete('item');
  params.delete('comment');
}

export function boardFilterItems(state: BoardFilterState): FilterBarItem[] {
  return BOARD_FILTER_FIELDS.filter(fieldId => state[fieldId].size > 0).map(fieldId => ({
    id: fieldId,
    fieldId,
    operatorId: 'in',
    value: [...state[fieldId]],
  }));
}

/** Whether anything is narrowing the board — the one fact both the menu and the empty state read. */
export function boardFiltersActive(state: BoardFilterState): boolean {
  return BOARD_FILTER_FIELDS.some(fieldId => state[fieldId].size > 0);
}

/** `state` with one filter's picks replaced. Linear projects only narrow Linear, so they leave with it. */
export function withBoardFilterValues(
  state: BoardFilterState,
  fieldId: BoardFilterFieldId,
  values: readonly string[],
): BoardFilterState {
  const next = { ...state, [fieldId]: new Set(values) };
  if (fieldId === 'source' && !values.includes('linear')) next.linearProject = new Set();
  return next;
}

/**
 * Filter state a saved view's items describe. Items for fields the board no longer has (the
 * retired `relevance` and `q`) narrow nothing; a later item for a field replaces an earlier one.
 */
export function boardFilterStateFromItems(items: readonly FilterBarItem[], kind: BoardKind): BoardFilterState {
  return boardFilterState(kind, fieldId => {
    const value = items.findLast(item => item.fieldId === fieldId)?.value;
    return Array.isArray(value) ? value : [value];
  });
}
