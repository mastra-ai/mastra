'use client';

import { DropdownMenu } from '@/ds/components/DropdownMenu';
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
  MoveRightIcon,
  Search,
  History,
  ArrowRightIcon,
} from 'lucide-react';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Badge } from '@/ds/components/Badge';
import { Input } from '@/ds/components/Input';

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
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="default" aria-label="Actions menu">
          <ArrowRightIcon /> Select and ...
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-72">
        <DropdownMenu.Item onSelect={onExportClick}>
          <Download />
          <span>Export Items as CSV</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onExportJsonClick}>
          <FileJson />
          <span>Export Items as JSON</span>
        </DropdownMenu.Item>

        <DropdownMenu.Item onSelect={onCreateDatasetClick}>
          <FolderPlus />
          <span>Create Dataset from Items</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onAddToDatasetClick}>
          <FolderOutput />
          <span>Copy Items to Dataset</span>
        </DropdownMenu.Item>

        <DropdownMenu.Item onSelect={onDeleteClick} className="text-red-500 focus:text-red-400">
          <Trash2 />
          <span>Delete Items</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export type DatasetItemsToolbarProps = {
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

  // Versions panel
  onVersionsClick: () => void;
  isItemPanelOpen?: boolean;
  isVersionsPanelOpen?: boolean;
  isViewingOldVersion?: boolean;
};

export function DatasetItemsToolbar({
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
  isSelectionActive,
  onSearchChange,
  selectedCount,
  onExecuteAction,
  onCancelSelection,
  selectionMode,
  onVersionsClick,
  isItemPanelOpen,
  isVersionsPanelOpen,
  isViewingOldVersion,
}: DatasetItemsToolbarProps) {
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

      <ButtonsGroup>
        {!isItemPanelOpen && !isViewingOldVersion && (
          <ButtonsGroup spacing="close">
            <Button variant="secondary" size="default" hasRightSibling={true} onClick={onAddClick}>
              <Plus /> New Item
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary" hasLeftSibling={true} size="default" aria-label="Dataset actions menu">
                  <ChevronDownIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onSelect={onImportClick}>
                  <Upload /> Import CSV
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onImportJsonClick}>
                  <FileJson /> Import JSON
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </ButtonsGroup>
        )}

        {hasItems && !isViewingOldVersion && (
          <ActionsMenu
            onExportClick={onExportClick}
            onExportJsonClick={onExportJsonClick}
            onCreateDatasetClick={onCreateDatasetClick}
            onAddToDatasetClick={onAddToDatasetClick}
            onDeleteClick={onDeleteClick}
          />
        )}

        {!isItemPanelOpen && !isVersionsPanelOpen && (
          <Button variant="secondary" size="default" onClick={onVersionsClick} aria-label="View versions">
            <History className="w-4 h-4" />
            Versions
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}
