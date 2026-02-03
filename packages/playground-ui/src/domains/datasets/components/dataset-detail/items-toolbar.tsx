'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import {
  Plus,
  Upload,
  FileJson,
  Download,
  FolderPlus,
  FolderOutput,
  Trash2,
  ChevronDownIcon,
  AmpersandIcon,
  MoveRightIcon,
  Search,
} from 'lucide-react';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Badge } from '@/ds/components/Badge';
import { Input } from '@/ds/components/Input';

export interface ItemsToolbarProps {
  // Normal mode actions
  onAddClick: () => void;
  onImportClick: () => void;
  onImportJsonClick: () => void;
  onExportClick: () => void;
  onExportJsonClick: () => void;
  onCreateDatasetClick: () => void;
  onAddToDatasetClick: () => void;
  onDeleteClick: () => void;
  hasItems: boolean;

  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;

  // Selection mode state
  isSelectionActive: boolean;
  selectedCount: number;
  onExecuteAction: () => void;
  onCancelSelection: () => void;
  selectionMode: 'idle' | 'export' | 'export-json' | 'create-dataset' | 'add-to-dataset' | 'delete';
}

interface ActionsMenuProps {
  onExportClick: () => void;
  onExportJsonClick: () => void;
  onCreateDatasetClick: () => void;
  onAddToDatasetClick: () => void;
  onDeleteClick: () => void;
}

function ActionsMenu({
  onExportClick,
  onExportJsonClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  onDeleteClick,
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="default" aria-label="Actions menu">
          Select <AmpersandIcon />
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
            Export Items as CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onExportJsonClick)}
          >
            <Icon>
              <FileJson className="w-4 h-4" />
            </Icon>
            Export Items as JSON
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
            Create Dataset from Items
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => handleAction(onAddToDatasetClick)}
          >
            <Icon>
              <FolderOutput className="w-4 h-4" />
            </Icon>
            Copy Items to Dataset
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
            Delete Items
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ItemsToolbar({
  onAddClick,
  onImportClick,
  onImportJsonClick,
  onExportClick,
  onExportJsonClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  onDeleteClick,
  hasItems,
  searchQuery,
  onSearchChange,
  isSelectionActive,
  selectedCount,
  onExecuteAction,
  onCancelSelection,
  selectionMode,
}: ItemsToolbarProps) {
  const [open, setOpen] = useState(false);

  if (isSelectionActive) {
    return (
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Search input - always visible */}
        <div className="relative flex-1 max-w-xs">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral4 pointer-events-none">
            <Search className="w-4 h-4" />
          </Icon>
          <Input
            placeholder="Search items..."
            value={searchQuery ?? ''}
            onChange={e => onSearchChange?.(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-5">
          <div className="text-sm text-neutral3 flex items-center gap-2 pl-6">
            <Badge className="text-ui-md">{selectedCount}</Badge>
            <span>selected items</span>
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <Button variant="standard" size="default" disabled={selectedCount === 0} onClick={onExecuteAction}>
              {selectionMode === 'export' && 'Export Items as CSV'}
              {selectionMode === 'export-json' && 'Export Items as JSON'}
              {selectionMode === 'create-dataset' && 'Create a new Dataset with Items'}
              {selectionMode === 'add-to-dataset' && 'Add Items to a Dataset'}
              {selectionMode === 'delete' && 'Delete Items'}
            </Button>
            <Button variant="secondary" size="default" onClick={onCancelSelection}>
              Cancel
            </Button>
          </ButtonsGroup>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 w-full">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral4 pointer-events-none">
          <Search className="w-4 h-4" />
        </Icon>
        <Input
          placeholder="Search items..."
          value={searchQuery ?? ''}
          onChange={e => onSearchChange?.(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex justify-end gap-3">
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
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onImportClick();
                  setOpen(false);
                }}
              >
                <Icon>
                  <Upload />
                </Icon>
                Import CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onImportJsonClick();
                  setOpen(false);
                }}
              >
                <Icon>
                  <FileJson />
                </Icon>
                Import JSON
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {hasItems && (
          <ActionsMenu
            onExportClick={onExportClick}
            onExportJsonClick={onExportJsonClick}
            onCreateDatasetClick={onCreateDatasetClick}
            onAddToDatasetClick={onAddToDatasetClick}
            onDeleteClick={onDeleteClick}
          />
        )}
      </div>
    </div>
  );
}
