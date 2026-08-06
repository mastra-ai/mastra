import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { ListFilter, UsersRound } from 'lucide-react';

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
}: {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  selectedParticipantId?: string;
  selectedTypes: ReadonlySet<BoardRelevanceType>;
  currentUserId?: string;
  onParticipantChange: (participantId: string | undefined) => void;
  onTypeChange: (type: BoardRelevanceType, selected: boolean) => void;
}) {
  const options = boardRelevanceOptions(kind);
  const selectedLabels = options.filter(option => selectedTypes.has(option.id)).map(option => option.label);
  const relevanceLabel = selectedLabels.length === options.length ? 'All relevance' : selectedLabels.join(', ');

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Board filters">
      <Select
        value={selectedParticipantId ?? ALL_TEAMMATES}
        onValueChange={value => onParticipantChange(value === ALL_TEAMMATES ? undefined : value)}
      >
        <SelectTrigger size="sm" variant="outline" className="w-auto min-w-44" aria-label="Filter by teammate">
          <UsersRound size={14} aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TEAMMATES}>All teammates</SelectItem>
          {participants.map(participant => (
            <SelectItem key={participant.id} value={participant.id}>
              <span className="flex items-center gap-2">
                <Avatar src={participant.avatarUrl} name={participant.name} size="sm" />
                <span>{participant.name}</span>
                {participant.id === `factory:${currentUserId}` ? <span className="text-icon3">(you)</span> : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
    </div>
  );
}
