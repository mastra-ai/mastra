import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ListFilter, RotateCcw, UsersRound } from 'lucide-react';

import type { BoardKind } from '../boardStages';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant, BoardRelevanceType } from '../boardRelevance';

const ALL_TEAMMATES = 'all';

export function BoardRelevanceFilters({
  kind,
  participants,
  selectedParticipantId,
  selectedTypes,
  currentUserId,
  onParticipantChange,
  onTypeChange,
  onReset,
}: {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  selectedParticipantId?: string;
  selectedTypes: ReadonlySet<BoardRelevanceType>;
  currentUserId?: string;
  onParticipantChange: (participantId: string | undefined) => void;
  onTypeChange: (type: BoardRelevanceType, selected: boolean) => void;
  onReset: () => void;
}) {
  const options = boardRelevanceOptions(kind);
  const selectedLabels = options.filter(option => selectedTypes.has(option.id)).map(option => option.label);
  const relevanceLabel = selectedLabels.length === options.length ? 'All relevance' : selectedLabels.join(', ');
  const hasActiveFilters = selectedParticipantId !== undefined || selectedLabels.length !== options.length;
  const teammateOptions = [
    {
      label: 'All teammates',
      value: ALL_TEAMMATES,
      start: <UsersRound size={14} aria-hidden />,
    },
    ...participants.map(participant => ({
      label: participant.name,
      value: participant.id,
      description: participant.id === `factory:${currentUserId}` ? `${participant.source} · you` : participant.source,
      start: <Avatar src={participant.avatarUrl} name={participant.name} size="sm" />,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Board filters">
      <Combobox
        options={teammateOptions}
        value={selectedParticipantId ?? ALL_TEAMMATES}
        onValueChange={value => onParticipantChange(value === ALL_TEAMMATES ? undefined : value)}
        placeholder="All teammates"
        searchPlaceholder="Search teammates..."
        emptyText="No teammate found."
        size="sm"
        variant="outline"
        className="w-auto min-w-44"
      />

      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedParticipantId === undefined}
            aria-label="Filter by relevance"
          >
            <ListFilter size={14} aria-hidden />
            <span className="max-w-48 truncate">{relevanceLabel || 'No relevance selected'}</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          <DropdownMenu.Label>Relevant because</DropdownMenu.Label>
          {options.map(option => (
            <DropdownMenu.CheckboxItem
              key={option.id}
              checked={selectedTypes.has(option.id)}
              onCheckedChange={checked => onTypeChange(option.id, checked === true)}
            >
              {option.label}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={14} aria-hidden />
          Reset filters
        </Button>
      )}
    </div>
  );
}
