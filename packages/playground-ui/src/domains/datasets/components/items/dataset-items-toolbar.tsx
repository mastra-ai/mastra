'use client';

import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
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
  ScaleIcon,
} from 'lucide-react';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Badge } from '@/ds/components/Badge';
import { Column } from '@/ds/components/Columns/column';
import { SearchField } from '@/ds/components/FormFields/search-field';

interface ActionsMenuProps {
  onExportClick: () => void;
  onExportJsonClick: () => void;
  onCreateDatasetClick: () => void;
  onAddToDatasetClick: () => void;
  onDeleteClick: () => void;
  onCompareClick: () => void;
}

function ActionsMenu({
  onExportClick,
  onExportJsonClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  onDeleteClick,
  onCompareClick,
}: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="standard" size="default" aria-label="Actions menu">
          <ArrowRightIcon /> Select and ...
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-72">
        <DropdownMenu.Item onSelect={onCompareClick}>
          <ScaleIcon />
          <span>Compare Items</span>
        </DropdownMenu.Item>
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
        <DropdownMenu.Separator />
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
  onCompareClick: () => void;
  hasItems: boolean;

  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;

  // Selection mode state
  isSelectionActive: boolean;
  selectedCount: number;
  onExecuteAction: () => void;
  onCancelSelection: () => void;
  selectionMode: 'idle' | 'export' | 'export-json' | 'create-dataset' | 'add-to-dataset' | 'delete' | 'compare-items';

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
  onCompareClick,
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
      <Column.Toolbar>
        <SearchField
          label="Search"
          placeholder="Search items..."
          value={searchQuery ?? ''}
          onChange={e => onSearchChange?.(e.target.value)}
          variant="experimental"
          size="default"
          onReset={() => onSearchChange?.('')}
        />

        <div className="flex gap-5">
          <div className="text-sm text-neutral3 flex items-center gap-2 pl-6">
            <Badge className="text-ui-md">{selectedCount}</Badge>
            <span>selected items</span>
            <MoveRightIcon />
          </div>
          <ButtonsGroup>
            <ButtonWithTooltip
              variant="cta"
              size="default"
              disabled={selectionMode === 'compare-items' ? selectedCount !== 2 : selectedCount === 0}
              onClick={onExecuteAction}
              tooltipContent={
                selectionMode === 'compare-items'
                  ? selectedCount !== 2
                    ? 'Select exactly 2 items to compare'
                    : undefined
                  : selectedCount === 0
                    ? 'Select at least one item'
                    : undefined
              }
            >
              {selectionMode === 'compare-items' && 'Compare Items'}
              {selectionMode === 'export' && 'Export Items as CSV'}
              {selectionMode === 'export-json' && 'Export Items as JSON'}
              {selectionMode === 'create-dataset' && 'Create a new Dataset with Items'}
              {selectionMode === 'add-to-dataset' && 'Add Items to a Dataset'}
              {selectionMode === 'delete' && 'Delete Items'}
            </ButtonWithTooltip>
            <Button variant="standard" size="default" onClick={onCancelSelection}>
              Cancel
            </Button>
          </ButtonsGroup>
        </div>
      </Column.Toolbar>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 w-full">
      <SearchField
        label="Search"
        placeholder="Search items..."
        value={searchQuery ?? ''}
        onChange={e => onSearchChange?.(e.target.value)}
        variant="experimental"
        size="default"
        onReset={() => onSearchChange?.('')}
        disabled={!hasItems}
      />

      <ButtonsGroup>
        {!isItemPanelOpen && !isViewingOldVersion && (
          <ButtonsGroup spacing="close">
            <Button variant="standard" size="default" onClick={onAddClick}>
              <Plus /> New Item
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="standard" size="default" aria-label="Dataset actions menu">
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
            onCompareClick={onCompareClick}
          />
        )}

        {!isItemPanelOpen && !isVersionsPanelOpen && (
          <Button variant="standard" size="default" onClick={onVersionsClick} aria-label="View versions">
            <History className="w-4 h-4" />
            Versions
          </Button>
        )}
      </ButtonsGroup>
    </div>
  );
}
