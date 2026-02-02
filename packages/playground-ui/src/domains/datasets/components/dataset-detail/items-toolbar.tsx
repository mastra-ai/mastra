'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import {
  Plus,
  Upload,
  FileJson,
  MoreVertical,
  Download,
  FolderPlus,
  FolderOutput,
  Trash2,
  ChevronDownIcon,
} from 'lucide-react';
export interface ItemsToolbarProps {
  // Normal mode actions
  onAddClick: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onCreateDatasetClick: () => void;
  onDeleteClick: () => void;
  hasItems: boolean;

  // Selection mode state
  isSelectionActive: boolean;
  selectedCount: number;
  onExecuteAction: () => void;
  onCancelSelection: () => void;
  selectionMode: 'idle' | 'export' | 'create-dataset' | 'delete';
}

interface ActionsMenuProps {
  onExportClick: () => void;
  onCreateDatasetClick: () => void;
  onDeleteClick: () => void;
}

function ActionsMenu({ onExportClick, onCreateDatasetClick, onDeleteClick }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="default" aria-label="Actions menu">
          <MoreVertical />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1 bg-surface4 ">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onExportClick)}
          >
            <Icon>
              <Download className="w-4 h-4" />
            </Icon>
            Select and Export Items
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
            Select Items to Create Dataset
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" disabled>
            <Icon>
              <FolderOutput className="w-4 h-4" />
            </Icon>
            Add to Dataset (Coming Soon)
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
            Select Items to Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ItemsToolbar({
  onAddClick,
  onImportClick,
  onExportClick,
  onCreateDatasetClick,
  onDeleteClick,
  hasItems,
  isSelectionActive,
  selectedCount,
  onExecuteAction,
  onCancelSelection,
  selectionMode,
}: ItemsToolbarProps) {
  const [open, setOpen] = useState(false);

  if (isSelectionActive) {
    return (
      <div className="flex justify-between px-4 py-3 gap-2 bg-surface4 rounded-lg">
        <span className="text-sm text-neutral3 flex items-center">{selectedCount} selected</span>
        <div>
          <Button variant="primary" size="sm" disabled={selectedCount === 0} onClick={onExecuteAction}>
            {selectionMode === 'export' && 'Export CSV'}
            {selectionMode === 'create-dataset' && 'Create Dataset'}
            {selectionMode === 'delete' && 'Delete'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelSelection}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end px-4 py-3 gap-3 bg-surface4 rounded-lg">
      <div className="flex items-center gap-[.1rem]">
        <Button variant="secondary" size="default" hasRightSibling={true} onClick={onAddClick}>
          <Plus />
          New Item
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" hasLeftSibling={true} size="default" aria-label="Dataset actions menu">
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>

          <PopoverContent>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onImportClick}>
              <Icon>
                <Upload />
              </Icon>
              Import CSV
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" disabled>
              <Icon>
                <FileJson />
              </Icon>
              Import JSON (Coming Soon)
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {hasItems && (
        <ActionsMenu
          onExportClick={onExportClick}
          onCreateDatasetClick={onCreateDatasetClick}
          onDeleteClick={onDeleteClick}
        />
      )}
    </div>
  );
}
