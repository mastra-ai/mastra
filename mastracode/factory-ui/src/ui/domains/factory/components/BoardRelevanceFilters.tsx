import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ListFilter, RotateCcw, Tag, UsersRound } from 'lucide-react';
import { useState } from 'react';

import type { BoardKind } from '../boardStages';
import { boardRelevanceOptions } from '../boardRelevance';
import type { BoardParticipant, BoardRelevanceType } from '../boardRelevance';

const ALL_TEAMMATES = 'all';

export function BoardRelevanceFilters({
  kind,
  participants,
  selectedParticipantId,
  selectedTypes,
  availableLabels,
  selectedLabels,
  currentUserId,
  onParticipantChange,
  onTypeChange,
  onLabelChange,
  onReset,
}: {
  kind: BoardKind;
  participants: readonly BoardParticipant[];
  selectedParticipantId?: string;
  selectedTypes: ReadonlySet<BoardRelevanceType>;
  availableLabels: readonly string[];
  selectedLabels: ReadonlySet<string>;
  currentUserId?: string;
  onParticipantChange: (participantId: string | undefined) => void;
  onTypeChange: (type: BoardRelevanceType, selected: boolean) => void;
  onLabelChange: (label: string, selected: boolean) => void;
  onReset: () => void;
}) {
  const options = boardRelevanceOptions(kind);
  const selectedRelevanceLabels = options.filter(option => selectedTypes.has(option.id)).map(option => option.label);
  const relevanceLabel =
    selectedRelevanceLabels.length === options.length ? 'All relevance' : selectedRelevanceLabels.join(', ');
  const labelButtonText =
    selectedLabels.size === 0
      ? 'All labels'
      : selectedLabels.size === 1
        ? [...selectedLabels][0]!
        : `${selectedLabels.size} labels`;
  const hasActiveFilters =
    selectedParticipantId !== undefined || selectedRelevanceLabels.length !== options.length || selectedLabels.size > 0;
  const [labelSearch, setLabelSearch] = useState('');
  const normalizedSearch = labelSearch.trim().toLowerCase();
  const visibleLabels = normalizedSearch
    ? availableLabels.filter(label => label.toLowerCase().includes(normalizedSearch))
    : availableLabels;
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

  const renderControls = (mobile: boolean) => (
    <>
      <Combobox
        options={teammateOptions}
        value={selectedParticipantId ?? ALL_TEAMMATES}
        onValueChange={value => onParticipantChange(value === ALL_TEAMMATES ? undefined : value)}
        placeholder="All teammates"
        searchPlaceholder="Search teammates..."
        emptyText="No teammate found."
        size="sm"
        variant="outline"
        className={mobile ? 'w-full' : 'w-auto min-w-44'}
      />

      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectedParticipantId === undefined}
            aria-label="Filter by relevance"
            className={mobile ? 'w-full justify-start' : undefined}
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

      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={availableLabels.length === 0 && selectedLabels.size === 0}
            aria-label="Filter by labels"
            className={mobile ? 'w-full justify-start' : undefined}
          >
            <Tag size={14} aria-hidden />
            <span className="max-w-48 truncate">{labelButtonText}</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="flex max-h-80 min-w-56 flex-col overflow-hidden">
          <div className="shrink-0">
            <DropdownMenu.Label>Labels</DropdownMenu.Label>
            <div className="px-2 pb-1">
              <input
                type="search"
                value={labelSearch}
                onChange={event => setLabelSearch(event.target.value)}
                onKeyDown={event => event.stopPropagation()}
                placeholder="Search labels..."
                aria-label="Search labels"
                className="border-border-1 bg-surface-3 focus:border-border-2 w-full rounded-md border px-2 py-1 text-xs outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto">
            {visibleLabels.length === 0 && (
              <div className="text-icon3 px-3 py-1.5 text-xs">
                {availableLabels.length === 0 ? 'No labels available.' : 'No labels match.'}
              </div>
            )}
            {visibleLabels.map(label => (
              <DropdownMenu.CheckboxItem
                key={label}
                checked={selectedLabels.has(label)}
                onCheckedChange={checked => onLabelChange(label, checked === true)}
                onSelect={event => event.preventDefault()}
              >
                {label}
              </DropdownMenu.CheckboxItem>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className={mobile ? 'w-full justify-start' : undefined}
        >
          <RotateCcw size={14} aria-hidden />
          Reset filters
        </Button>
      )}
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-3 lg:hidden" aria-label="Board filters mobile">
        {renderControls(true)}
      </div>
      <div className="hidden flex-wrap items-center gap-2 lg:flex" aria-label="Board filters">
        {renderControls(false)}
      </div>
    </>
  );
}
