'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Icon } from '@/ds/icons/Icon';
import { MoreVertical, Pencil, Copy, Trash2, Play } from 'lucide-react';

export interface DatasetHeaderProps {
  name?: string;
  description?: string;
  version?: Date | string;
  isLoading?: boolean;
  onEditClick?: () => void;
  onDuplicateClick?: () => void;
  onDeleteClick?: () => void;
  runTriggerSlot?: React.ReactNode;
  onRunClick?: () => void;
}

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

/**
 * Dataset header with name, description, actions menu, and run button.
 * Edit/Delete/Duplicate in three-dot menu.
 * Schema Settings moved to Edit Dataset dialog.
 */
export function DatasetHeader({
  name,
  description,
  version,
  isLoading = false,
  onEditClick,
  onDuplicateClick,
  onDeleteClick,
  runTriggerSlot,
  onRunClick,
}: DatasetHeaderProps) {
  return (
    <header className="flex items-start justify-between py-6 gap-4">
      {/* Left side: Name + Description */}
      <div className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-neutral6">{name ?? 'Dataset'}</h1>
              {version && <span className="text-ui-sm text-neutral3 font-normal">v{formatVersion(version)}</span>}
            </div>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </>
        )}
      </div>

      {/* Right side: Menu + Run button */}
      <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}
