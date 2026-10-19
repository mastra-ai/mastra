import { Avatar } from '@mastra/playground-ui/components/Avatar';
import type { FilterBarField, FilterBarOperator, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import {
  Activity,
  FolderKanban,
  Inbox,
  Tag,
  UserRoundCheck,
  UserRoundPen,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { boardFilterFieldIds } from '../boardFilters';
import type { BoardFilterFieldId, BoardFilterState } from '../boardFilters';
import { factoryParticipantId } from '../boardPeople';
import type { BoardParticipant } from '../boardPeople';
import type { BoardKind } from '../boardStages';
import { BOARD_SOURCE_OPTIONS } from '../boardSourceFilters';
import type { LinearProject } from '../services/linear';

export const BOARD_FILTER_OPERATORS: FilterBarOperator[] = [{ id: 'in', label: 'is any of', arity: 'many' }];

export type BoardFilterOption = FilterBarOption & { alsoMatches?: string };

export type BoardFilterField = FilterBarField & { id: BoardFilterFieldId; suggestions: BoardFilterOption[] };

const FIELD_PRESENTATION: Record<BoardFilterFieldId, { label: string; icon: LucideIcon }> = {
  source: { label: 'Intake source', icon: Inbox },
  linearProject: { label: 'Linear project', icon: FolderKanban },
  teammate: { label: 'Involves', icon: UsersRound },
  author: { label: 'Author', icon: UserRoundPen },
  assignee: { label: 'Assignee', icon: UserRoundCheck },
  reviewer: { label: 'Review requested', icon: UserRoundSearch },
  worked: { label: 'Worked on by', icon: Activity },
  label: { label: 'Label', icon: Tag },
};

function peopleOptions(
  participants: readonly BoardParticipant[],
  currentUserId: string | undefined,
): BoardFilterOption[] {
  const you = currentUserId ? factoryParticipantId(currentUserId) : undefined;
  const option = (participant: BoardParticipant): BoardFilterOption => ({
    value: participant.id,
    label: participant.id === you ? 'You' : participant.name,
    alsoMatches: participant.id === you ? participant.name : undefined,
    start: <Avatar src={participant.avatarUrl} name={participant.name} size="sm" />,
  });
  return [
    ...participants.filter(participant => participant.id === you).map(option),
    ...participants.filter(participant => participant.id !== you).map(option),
  ];
}

interface BoardFilterFieldsOptions {
  kind: BoardKind;
  filters: BoardFilterState;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  connectedSources?: ReadonlySet<string>;
  linearProjects?: readonly LinearProject[];
}

export function boardFilterFields({
  kind,
  filters,
  participants,
  availableLabels,
  currentUserId,
  connectedSources,
  linearProjects = [],
}: BoardFilterFieldsOptions): BoardFilterField[] {
  const people = peopleOptions(participants, currentUserId);
  const suggestions: Record<BoardFilterFieldId, FilterBarOption[]> = {
    // Keep already-picked sources so saved views still label and edit them after a provider disconnects.
    source: BOARD_SOURCE_OPTIONS.filter(
      option => option.value === 'manual' || connectedSources?.has(option.value) || filters.source.has(option.value),
    ),
    linearProject: linearProjects.map(project => ({ value: project.id, label: project.name })),
    teammate: people,
    author: people,
    assignee: people,
    reviewer: people,
    worked: people,
    label: availableLabels.map(label => ({ value: label })),
  };
  const linearProjectOffered = filters.source.has('linear') || filters.linearProject.size > 0;

  return boardFilterFieldIds(kind).map(fieldId => ({
    id: fieldId,
    ...FIELD_PRESENTATION[fieldId],
    operators: ['in'],
    strict: true,
    hidden: fieldId === 'linearProject' && !linearProjectOffered,
    suggestions: suggestions[fieldId],
  }));
}

/** The field's options, plus any picked value no longer offered (a disconnected source, a person off the board). */
export function boardFilterOptions(field: BoardFilterField, selected: readonly string[]): BoardFilterOption[] {
  const offered = new Set(field.suggestions.map(option => option.value));
  const orphaned = selected.filter(value => !offered.has(value)).map((value): BoardFilterOption => ({ value }));
  return [...field.suggestions, ...orphaned];
}

export function boardFilterSummary(field: BoardFilterField, selected: readonly string[]): string {
  if (selected.length > 1) return `${selected.length} selected`;
  const only = boardFilterOptions(field, selected).find(option => option.value === selected[0]);
  return only?.label ?? selected[0];
}
