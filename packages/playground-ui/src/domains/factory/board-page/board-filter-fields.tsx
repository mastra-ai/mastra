import { factoryParticipantId, PULL_REQUEST_SOURCE_FILTER } from '@internal/factory-contract';
import type { LucideIcon } from 'lucide-react';
import { BOARD_FILTER_OPERATORS, boardFilterOptions, boardFilterSummary } from '../board';
import type { BoardFilterField as SharedBoardFilterField, BoardFilterOption } from '../board';

import { boardFilterFieldIds } from './board-filters';
import type { BoardFilterFieldId, BoardFilterState } from './board-filters';
import type { BoardParticipant } from './board-people';
import { BOARD_SOURCE_OPTIONS } from './board-source-filters';

import { BoardSourceIcon } from './board-source-icon';
import { Avatar } from '@/ds/components/Avatar';
import type { FilterBarOption } from '@/ds/components/FilterBar';
import { IconElectrocardiogram } from '@/ds/icons/central/IconElectrocardiogram';
import { IconInboxEmpty } from '@/ds/icons/central/IconInboxEmpty';
import { IconKanbanView } from '@/ds/icons/central/IconKanbanView';
import { IconPersona } from '@/ds/icons/central/IconPersona';
import { IconPullRequest } from '@/ds/icons/central/IconPullRequest';
import { IconShieldCheck } from '@/ds/icons/central/IconShieldCheck';
import { IconTag } from '@/ds/icons/central/IconTag';
import { IconUserAdded } from '@/ds/icons/central/IconUserAdded';

import { IconUserDuo } from '@/ds/icons/central/IconUserDuo';
import { IconUserEdit } from '@/ds/icons/central/IconUserEdit';

/** Which issue sources the host has connected, so the board only offers filters that can match. */
export interface BoardFilterSources {
  connectedSources: ReadonlySet<string>;
  linearProjects?: readonly { id: string; name: string }[];
}
export type FactoryBoardFilterField = SharedBoardFilterField<BoardFilterFieldId>;

const FIELD_PRESENTATION: Record<BoardFilterFieldId, { label: string; icon: LucideIcon }> = {
  source: { label: 'Intake source', icon: IconInboxEmpty },
  linearProject: { label: 'Linear project', icon: IconKanbanView },
  pullRequest: { label: 'Pull request', icon: IconPullRequest },
  trust: { label: 'Trust', icon: IconShieldCheck },
  teammate: { label: 'Involves', icon: IconUserDuo },
  author: { label: 'Author', icon: IconUserEdit },
  assignee: { label: 'Assignee', icon: IconUserAdded },
  reviewer: { label: 'Review requested', icon: IconPersona },
  worked: { label: 'Worked on by', icon: IconElectrocardiogram },
  label: { label: 'Label', icon: IconTag },
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
  reviewsPullRequests: boolean;
  filters: BoardFilterState;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  connectedSources?: ReadonlySet<string>;
  linearProjects?: readonly { id: string; name: string }[];
}

export function boardFilterFields({
  reviewsPullRequests,
  filters,
  participants,
  availableLabels,
  currentUserId,
  connectedSources,
  linearProjects = [],
}: BoardFilterFieldsOptions): FactoryBoardFilterField[] {
  const people = peopleOptions(participants, currentUserId);
  const suggestions: Record<BoardFilterFieldId, FilterBarOption[]> = {
    // Keep already-picked sources so saved views still label and edit them after a provider disconnects.
    source: BOARD_SOURCE_OPTIONS.filter(
      option =>
        option.value === 'manual' ||
        option.value === 'detail' ||
        connectedSources?.has(option.value) ||
        (option.value === PULL_REQUEST_SOURCE_FILTER &&
          (connectedSources?.has('github') === true || connectedSources?.has('gitlab') === true)) ||
        filters.source.has(option.value),
    ).map(option => ({ value: option.value, label: option.label, start: <BoardSourceIcon option={option} /> })),
    linearProject: linearProjects.map(project => ({
      value: project.id,
      label: project.name,
      start: <IconKanbanView aria-hidden />,
    })),
    pullRequest: [
      { value: 'with', label: 'Has a pull request', start: <IconPullRequest aria-hidden /> },
      { value: 'without', label: 'No pull request', start: <IconPullRequest aria-hidden /> },
    ],
    trust: [
      { value: 'trusted', label: 'Trusted', start: <IconShieldCheck aria-hidden /> },
      { value: 'untrusted', label: 'From outside', start: <IconShieldCheck aria-hidden /> },
    ],
    teammate: people,
    author: people,
    assignee: people,
    reviewer: people,
    worked: people,
    label: availableLabels.map(label => ({ value: label, start: <IconTag aria-hidden /> })),
  };
  const linearProjectOffered = filters.source.has('linear') || filters.linearProject.size > 0;

  return boardFilterFieldIds(reviewsPullRequests).map(fieldId => ({
    id: fieldId,
    ...FIELD_PRESENTATION[fieldId],
    operators: ['in'],
    strict: true,
    hidden: fieldId === 'linearProject' && !linearProjectOffered,
    suggestions: suggestions[fieldId],
  }));
}
