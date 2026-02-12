'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { MoreVertical, Download, FolderPlus, Trash2 } from 'lucide-react';

export interface ActionsMenuProps {
  onExportClick: () => void;
  onCreateDatasetClick: () => void;
  onDeleteClick: () => void;
  disabled?: boolean;
}

/**
 * Three-dot actions menu for bulk operations on dataset items.
 * Options: Export, Create Dataset from selection, Delete selected
 */
export function ActionsMenu({
  onExportClick,
  onCreateDatasetClick,
  onDeleteClick,
  disabled = false,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);

  // Invoke callback and close popover
  const handleAction = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label="Actions menu">
          <Icon>
            <MoreVertical className="w-4 h-4" />
          </Icon>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onExportClick)}
          >
            <Icon>
              <Download className="w-4 h-4" />
            </Icon>
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onCreateDatasetClick)}
          >
            <Icon>
              <FolderPlus className="w-4 h-4" />
            </Icon>
            Create Dataset
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
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
