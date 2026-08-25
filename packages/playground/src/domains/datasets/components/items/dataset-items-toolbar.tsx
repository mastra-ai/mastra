'use client';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
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
  ChevronDown,
  ArrowRightToLineIcon,
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

  isItemPanelOpen?: boolean;
  isViewingOldVersion?: boolean;
  activeDatasetVersion?: number | null;
  onReturnToLatestVersion?: () => void;
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
  isItemPanelOpen,
  isViewingOldVersion,
  activeDatasetVersion,
  onReturnToLatestVersion,
}: DatasetItemsToolbarProps) {
  const oldVersionNotice = isViewingOldVersion && activeDatasetVersion != null && (
    <div className="text-icon3 text-ui-sm flex min-w-0 items-center gap-3">
      <span className="truncate">You are seeing v{activeDatasetVersion}, which is an older version of the dataset</span>
      {onReturnToLatestVersion && (
        <Button onClick={onReturnToLatestVersion}>
          <ArrowRightToLineIcon /> Return to latest
        </Button>
      )}
    </div>
  );

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
    return (
      <Column.Toolbar className="">
        {searchField}

        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button>
              {selectedCount} selected <ChevronDown />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className="w-72">
            {onExportClick && (
              <DropdownMenu.Item onSelect={onExportClick}>
                <Download /> Export CSV
              </DropdownMenu.Item>
            )}
            {onExportJsonClick && (
              <DropdownMenu.Item onSelect={onExportJsonClick}>
                <Download /> Export JSON
              </DropdownMenu.Item>
            )}
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
            {onDeleteClick && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={onDeleteClick} className="text-red-500 focus:text-red-400">
                  <Trash2 /> Delete Items
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </Column.Toolbar>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      {searchField}

      {oldVersionNotice}

      <ButtonsGroup>
        {(hasItems || Boolean(searchQuery)) && !isItemPanelOpen && !isViewingOldVersion && (
          <ButtonsGroup spacing="close">
            <Button onClick={onAddClick}>
              <Plus /> Add Item
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button aria-label="Dataset actions menu">
                  <ChevronDown />
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
