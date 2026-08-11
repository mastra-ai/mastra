'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { MoreVertical, Download, FolderPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
            <MoreVertical className="h-4 w-4" />
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
              <Download className="h-4 w-4" />
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
              <FolderPlus className="h-4 w-4" />
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
              <Trash2 className="h-4 w-4" />
            </Icon>
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
