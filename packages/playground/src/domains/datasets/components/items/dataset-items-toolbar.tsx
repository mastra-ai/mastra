'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { Column } from '@mastra/playground-ui/components/Columns';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { SearchFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import {
  Plus,
  Upload,
  FileJson,
  Download,
  FolderPlus,
  FolderOutput,
  Trash2,
  ChevronDownIcon,
  EllipsisVerticalIcon,
} from 'lucide-react';

export type DatasetItemsToolbarProps = {
  // Normal mode actions
  onAddClick: () => void;
  onImportClick: () => void;
  onImportJsonClick: () => void;
  hasItems: boolean;

  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;

  // Selection state + contextual actions (hidden when a handler is absent)
  selectedCount: number;
  onExportClick?: () => void;
  onExportJsonClick?: () => void;
  onCreateDatasetClick?: () => void;
  onAddToDatasetClick?: () => void;
  onDeleteClick?: () => void;
  onCancelSelection: () => void;

  isItemPanelOpen?: boolean;
  isViewingOldVersion?: boolean;
};

export function DatasetItemsToolbar({
  onAddClick,
  onImportClick,
  onImportJsonClick,
  hasItems,
  searchQuery,
  onSearchChange,
  selectedCount,
  onExportClick,
  onExportJsonClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  onDeleteClick,
  onCancelSelection,
  isItemPanelOpen,
  isViewingOldVersion,
}: DatasetItemsToolbarProps) {
  const searchField = (
    <SearchFieldBlock
      name="search-items"
      label="Search"
      labelIsHidden
      size="md"
      placeholder="Search items..."
      value={searchQuery ?? ''}
      onChange={e => onSearchChange?.(e.target.value)}
      onReset={() => onSearchChange?.('')}
      disabled={!hasItems && !searchQuery}
    />
  );

  if (selectedCount > 0) {
    const hasMoreActions = Boolean(onCreateDatasetClick || onAddToDatasetClick);

    return (
      <Column.Toolbar className="">
        {searchField}

        <div className="flex items-center gap-5">
          <div className="text-neutral3 flex items-center gap-2 text-sm">
            <Chip size="large" color="green">
              {selectedCount}
            </Chip>
            <span>selected</span>
          </div>
          <ButtonsGroup>
            {onDeleteClick && (
              <Button onClick={onDeleteClick} className="text-red-500">
                <Trash2 /> Delete
              </Button>
            )}
            {onExportClick && (
              <Button onClick={onExportClick}>
                <Download /> Export CSV
              </Button>
            )}
            {onExportJsonClick && (
              <Button onClick={onExportJsonClick}>
                <Download /> Export JSON
              </Button>
            )}
            {hasMoreActions && (
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button aria-label="More selection actions">
                    <EllipsisVerticalIcon />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" className="w-72">
                  {onCreateDatasetClick && (
                    <DropdownMenu.Item onSelect={onCreateDatasetClick}>
                      <FolderPlus />
                      <span>Create Dataset from Items</span>
                    </DropdownMenu.Item>
                  )}
                  {onAddToDatasetClick && (
                    <DropdownMenu.Item onSelect={onAddToDatasetClick}>
                      <FolderOutput />
                      <span>Copy Items to Dataset</span>
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
            <Button onClick={onCancelSelection}>Cancel</Button>
          </ButtonsGroup>
        </div>
      </Column.Toolbar>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      {searchField}

      <ButtonsGroup>
        {(hasItems || Boolean(searchQuery)) && !isItemPanelOpen && !isViewingOldVersion && (
          <ButtonsGroup spacing="close">
            <Button onClick={onAddClick}>
              <Plus /> Add Item
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button aria-label="Dataset actions menu">
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
      </ButtonsGroup>
    </div>
  );
}
