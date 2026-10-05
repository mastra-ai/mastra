import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { ListFilter, Search, Tag, UsersRound } from 'lucide-react';

import { BOARD_FILTER_FIELD, boardFilterItems, boardFilterStateFromItems } from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardKind } from '../boardStages';

/** `contains` carries the free-text search; the closed dimensions pick one or several values. */
export const BOARD_FILTER_OPERATORS: FilterBarOperator[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
  { id: 'in', label: 'is any of', arity: 'many' },
];

interface BoardFilterFieldsOptions {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  teammateSelected: boolean;
}

export function boardFilterFields({
  kind,
  participants,
  availableLabels,
  currentUserId,
  teammateSelected,
}: BoardFilterFieldsOptions): FilterBarField[] {
  return [
    { id: BOARD_FILTER_FIELD.text, label: 'Text', icon: Search, search: true, operators: ['contains'] },
    {
      id: BOARD_FILTER_FIELD.teammate,
      label: 'Teammate',
      icon: UsersRound,
      operators: ['in'],
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
      // Relevance narrows the picked teammates' cards: with nobody picked there is nothing to be relevant to.
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
  ];
}

/**
 * Board narrowing as one filter bar: typing goes straight to a text search, and teammate,
 * relevance and labels are chips built from the same input.
 */
export function BoardFilters({
  kind,
  fields,
  filters,
  onFiltersChange,
  removable,
  'aria-label': ariaLabel = 'Board filters',
}: {
  kind: BoardKind;
  fields: FilterBarField[];
  filters: BoardFilterState;
  onFiltersChange: (filters: BoardFilterState) => void;
  removable: boolean;
  'aria-label'?: string;
}) {
  return (
    <FilterBar
      fields={fields}
      operators={BOARD_FILTER_OPERATORS}
      value={boardFilterItems(filters, kind)}
      onValueChange={(items: FilterBarItem[]) => onFiltersChange(boardFilterStateFromItems(items, kind))}
      // Items are rebuilt from the URL with `id: fieldId`, so the draft chip is the committed chip.
      createItemId={fieldId => fieldId}
      aria-label={ariaLabel}
      className="w-full max-w-full sm:w-auto"
    >
      <FilterBar.Chips renderChip={item => <FilterBar.Chip item={item} removable={removable} />} />
      <FilterBar.Input placeholder="Add filter…" />
    </FilterBar>
  );
}
