'use client';

import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Button } from '@/ds/components/Button';
import { MoreVertical, Pencil, Copy, Trash2, Play, DatabaseIcon, Calendar1Icon, HistoryIcon } from 'lucide-react';
import { MainHeader } from '@/ds/components/MainHeader';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { format } from 'date-fns/format';
import { TextAndIcon } from '@/ds/components/Text';

export type DatasetHeaderProps = {
  dataset?: any;
  isLoading?: boolean;
  onEditClick?: () => void;
  onDuplicateClick?: () => void;
  onDeleteClick?: () => void;
  experimentTriggerSlot?: React.ReactNode;
  onExperimentClick?: () => void;
  className?: string;
};

/**
 * Dataset header with name, description, actions menu, and run button.
 * Edit/Delete/Duplicate in three-dot menu.
 * Schema Settings moved to Edit Dataset dialog.
 */
export function DatasetHeader({
  dataset,
  isLoading = false,
  onEditClick,
  onDuplicateClick,
  onDeleteClick,
  experimentTriggerSlot,
  onExperimentClick,
  className,
}: DatasetHeaderProps) {
  return (
    <MainHeader className={className}>
      <MainHeader.Column>
        <MainHeader.Title isLoading={isLoading}>
          <DatabaseIcon /> {dataset?.name}
        </MainHeader.Title>
        <MainHeader.Description isLoading={isLoading}>{dataset?.description}</MainHeader.Description>
        <MainHeader.Description isLoading={isLoading}>
          <TextAndIcon>
            <Calendar1Icon /> Created at {dataset?.createdAt ? format(new Date(dataset.createdAt), 'MMM d, yyyy') : ''}
          </TextAndIcon>
          <TextAndIcon>
            <HistoryIcon /> Latest version v{dataset?.version ?? ''}
          </TextAndIcon>
        </MainHeader.Description>
      </MainHeader.Column>
      <MainHeader.Column>
        <ButtonsGroup>
          {experimentTriggerSlot ? (
            experimentTriggerSlot
          ) : onExperimentClick ? (
            <Button variant="outline" size="sm" onClick={onExperimentClick}>
              <Play />
              Run Experiment
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="standard" size="default" aria-label="Dataset actions menu">
                <MoreVertical />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="w-48">
              <DropdownMenu.Item onSelect={onEditClick}>
                <Pencil /> Edit Dataset
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onDuplicateClick}>
                <Copy /> Duplicate Dataset
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onDeleteClick} className="text-red-500 focus:text-red-400">
                <Trash2 /> Delete Dataset
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </ButtonsGroup>
      </MainHeader.Column>
    </MainHeader>
  );
}
