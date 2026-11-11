'use client';

import { Button, CreateButton } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useListSearch } from '@mastra/playground-ui/hooks/use-list-search';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Upload,
  FileJson,
  Download,
  FolderPlus,
  FolderOutput,
  Trash2,
  ChevronDown,
  SearchIcon,
  XIcon,
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

  /** Extra actions rendered before the "New item" action. */
  actionsSlot?: React.ReactNode;
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
  actionsSlot,
}: DatasetItemsToolbarProps) {
  const search = useListSearch({ value: searchQuery ?? '', onSearch: query => onSearchChange?.(query) });
  const oldVersionNotice = isViewingOldVersion && activeDatasetVersion != null && (
    <div className="flex min-w-0 items-center gap-3 text-warning-foreground">
      <Txt as="span" variant="caption" className="truncate">
        You are seeing v{activeDatasetVersion}, which is an older version of the dataset
      </Txt>
      {onReturnToLatestVersion && (
        <button
          type="button"
          onClick={onReturnToLatestVersion}
          className={cn(quietTextHover, controlStateColorTransition, 'shrink-0 underline underline-offset-2')}
        >
          <Txt as="span" variant="caption" className="block">
            Return to latest
          </Txt>
        </button>
      )}
    </div>
  );

  // Hidden on an empty dataset: the list's empty state takes over. Kept while a
  // search is active so a query with no results can still be edited.
  const showItemActions = hasItems || Boolean(searchQuery);

  const searchField = showItemActions && (
    <div className="max-w-120 flex-1">
      <InputGroup size="sm" className="w-full max-w-120">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput {...search.inputProps} aria-label="Search items" placeholder="Search items" />
        {search.value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Clear search" onClick={search.clear}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );

  const selectionDropdown = selectedCount > 0 && (
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
            <span>Create dataset from items</span>
          </DropdownMenu.Item>
        )}
        {onAddToDatasetClick && (
          <DropdownMenu.Item onSelect={onAddToDatasetClick}>
            <FolderOutput />
            <span>Copy items to dataset</span>
          </DropdownMenu.Item>
        )}
        {onDeleteClick && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={onDeleteClick} variant="destructive">
              <Trash2 /> Delete items
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );

  return (
    <div
      className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 whitespace-nowrap"
      data-testid="dataset-items-toolbar"
    >
      {/* The search keeps a sane minimum width; when the actions do not fit next to it
          they wrap onto their own row instead of squeezing the search. */}
      <div className="flex min-w-64 flex-1 items-center gap-4">
        {searchField}
        {oldVersionNotice}
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {selectionDropdown}
        {actionsSlot}
        {showItemActions && !isItemPanelOpen && !isViewingOldVersion && (
          <ButtonsGroup>
            <CreateButton onClick={onAddClick} tooltip="Add an item">
              New item
            </CreateButton>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button size="icon-md" aria-label="Dataset actions menu">
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
      </div>
    </div>
  );
}
