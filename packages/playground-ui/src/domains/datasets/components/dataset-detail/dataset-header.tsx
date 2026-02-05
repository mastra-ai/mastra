'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { MoreVertical, Pencil, Copy, Trash2, Play, DatabaseIcon, Calendar1Icon, HistoryIcon } from 'lucide-react';
import { MainHeader } from '@/ds/components/MainHeader';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Dataset } from '@mastra/core/storage';
import { format } from 'date-fns/format';
import { TextAndIcon } from '@/ds/components/Text';

/**
 * Format version date for display
 */
function formatVersion(version: Date | string | undefined): string {
  if (!version) return '';
  const d = typeof version === 'string' ? new Date(version) : version;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface HeaderActionsMenuProps {
  onEditClick?: () => void;
  onDuplicateClick?: () => void;
  onDeleteClick?: () => void;
}

/**
 * Three-dot actions menu for dataset header.
 * Options: Edit Dataset, Duplicate Dataset, Delete Dataset
 */
function HeaderActionsMenu({ onEditClick, onDuplicateClick, onDeleteClick }: HeaderActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (callback?: () => void) => {
    callback?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="default" aria-label="Dataset actions menu">
          <MoreVertical />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onEditClick)}
          >
            <Icon>
              <Pencil className="w-4 h-4" />
            </Icon>
            Edit Dataset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onDuplicateClick)}
          >
            <Icon>
              <Copy className="w-4 h-4" />
            </Icon>
            Duplicate Dataset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-red-500 hover:text-red-400"
            onClick={() => handleAction(onDeleteClick)}
          >
            <Icon>
              <Trash2 className="w-4 h-4" />
            </Icon>
            Delete Dataset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface DatasetHeaderProps {
  dataset?: any;
  isLoading?: boolean;
  onEditClick?: () => void;
  onDuplicateClick?: () => void;
  onDeleteClick?: () => void;
  runTriggerSlot?: React.ReactNode;
  onRunClick?: () => void;
  className?: string;
}

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
  runTriggerSlot,
  onRunClick,
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
            <HistoryIcon /> Latest version{' '}
            {dataset?.version ? format(new Date(dataset.version), "MMM d, yyyy 'at' h:mm a") : ''}
          </TextAndIcon>
        </MainHeader.Description>
      </MainHeader.Column>
      <MainHeader.Column>
        <ButtonsGroup>
          {runTriggerSlot ? (
            runTriggerSlot
          ) : onRunClick ? (
            <Button variant="outline" size="sm" onClick={onRunClick}>
              <Play />
              Run Experiment
            </Button>
          ) : null}
          <HeaderActionsMenu
            onEditClick={onEditClick}
            onDuplicateClick={onDuplicateClick}
            onDeleteClick={onDeleteClick}
          />
        </ButtonsGroup>
      </MainHeader.Column>
    </MainHeader>
  );
}
