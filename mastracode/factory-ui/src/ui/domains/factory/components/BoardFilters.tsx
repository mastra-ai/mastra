import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { ListFilter, Search, Tag, UsersRound } from 'lucide-react';

import { BOARD_FILTER_FIELD, boardFilterItems, boardFilterStateFromItems } from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardKind } from '../boardStages';

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
      createItemId={fieldId => fieldId}
      aria-label={ariaLabel}
      className="w-full max-w-full sm:w-auto"
    >
      <FilterBar.Chips renderChip={item => <FilterBar.Chip item={item} removable={removable} />} />
      <FilterBar.Input placeholder="Add filter…" />
    </FilterBar>
  );
}
