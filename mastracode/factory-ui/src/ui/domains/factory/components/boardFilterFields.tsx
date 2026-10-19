import { Avatar } from '@mastra/playground-ui/components/Avatar';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { FolderKanban, Inbox, ListFilter, Tag, UsersRound } from 'lucide-react';

import { BOARD_FILTER_FIELD } from '../boardFilters';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardKind } from '../boardStages';
import { BOARD_SOURCE_OPTIONS } from '../boardSourceFilters';
import type { LinearProject } from '../services/linear';

export const BOARD_FILTER_OPERATORS: FilterBarOperator[] = [{ id: 'in', label: 'is any of', arity: 'many' }];

export type BoardFilterField = FilterBarField & { suggestions: FilterBarOption[]; keepsOnePicked?: boolean };

interface BoardFilterFieldsOptions {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  teammateSelected: boolean;
  connectedSources?: ReadonlySet<string>;
  selectedSources?: ReadonlySet<string>;
  linearProjects?: readonly LinearProject[];
}

export function boardFilterFields({
  kind,
  participants,
  availableLabels,
  currentUserId,
  teammateSelected,
  connectedSources,
  selectedSources,
  linearProjects = [],
}: BoardFilterFieldsOptions): BoardFilterField[] {
  return [
    {
      id: BOARD_FILTER_FIELD.source,
      label: 'Intake source',
      icon: Inbox,
      operators: ['in'],
      strict: true,
      // Keep already-selected sources so saved views still label and edit them after a provider disconnects.
      suggestions: BOARD_SOURCE_OPTIONS.filter(
        option =>
          option.value === 'manual' || connectedSources?.has(option.value) || selectedSources?.has(option.value),
      ),
    },
    {
      id: BOARD_FILTER_FIELD.linearProject,
      label: 'Linear project',
      icon: FolderKanban,
      operators: ['in'],
      strict: true,
      suggestions: linearProjects.map(project => ({ value: project.id, label: project.name })),
    },
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
      keepsOnePicked: true,
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
