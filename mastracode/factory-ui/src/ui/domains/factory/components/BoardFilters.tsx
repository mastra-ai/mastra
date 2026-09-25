import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { ListFilter, Search, Tag, UsersRound } from 'lucide-react';
import { useMemo } from 'react';

import { BOARD_FILTER_FIELD, boardFilterItems, boardFilterStateFromItems } from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardKind } from '../boardStages';

/** `contains` carries the free-text search; the closed dimensions pick one or several values. */
const OPERATORS: FilterBarOperator[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
  { id: 'in', label: 'is any of', arity: 'many' },
];

/**
 * Board narrowing as one filter bar: typing goes straight to a text search, and teammate,
 * relevance and labels are chips built from the same input.
 */
export function BoardFilters({
  kind,
  participants,
  availableLabels,
  currentUserId,
  filters,
  onFiltersChange,
}: {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  filters: BoardFilterState;
  onFiltersChange: (filters: BoardFilterState) => void;
}) {
  const teammateSelected = filters.participantId !== undefined;
  const fields = useMemo<FilterBarField[]>(
    () => [
      { id: BOARD_FILTER_FIELD.text, label: 'Text', icon: Search, search: true, operators: ['contains'] },
      {
        id: BOARD_FILTER_FIELD.teammate,
        label: 'Teammate',
        icon: UsersRound,
        operators: ['is'],
        strict: true,
        suggestions: participants.map(participant => ({
          value: participant.id,
          label: participant.id === `factory:${currentUserId}` ? `${participant.name} (you)` : participant.name,
          start: <Avatar src={participant.avatarUrl} name={participant.name} size="sm" />,
        })),
      },
      {
        id: BOARD_FILTER_FIELD.relevance,
        label: 'Relevant because',
        icon: ListFilter,
        operators: ['in'],
        strict: true,
        // Relevance narrows one teammate's cards: with nobody picked there is nothing to be relevant to.
        hidden: !teammateSelected,
        suggestions: boardRelevanceOptions(kind).map(option => ({ value: option.id, label: option.label })),
      },
      {
        id: BOARD_FILTER_FIELD.label,
        label: 'Label',
        icon: Tag,
        operators: ['in'],
        strict: true,
        suggestions: availableLabels.map(label => ({ value: label })),
      },
    ],
    [availableLabels, currentUserId, kind, participants, teammateSelected],
  );

  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={boardFilterItems(filters, kind)}
      onValueChange={(items: FilterBarItem[]) => onFiltersChange(boardFilterStateFromItems(items, kind))}
      // Items are rebuilt from the URL with `id: fieldId`, so the draft chip is the committed chip.
      createItemId={fieldId => fieldId}
      aria-label="Board filters"
      className="w-full max-w-full sm:w-auto"
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter cards…" />
    </FilterBar>
  );
}
