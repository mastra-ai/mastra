'use client';

import { Button, CreateButton } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { SearchInput, listSearchProps } from '@/ds/components/SearchInput';
import { Txt } from '@/ds/components/Txt';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconArrowOutOfBox } from '@/ds/icons/central/IconArrowOutOfBox';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconFolderAddRight } from '@/ds/icons/central/IconFolderAddRight';
import { IconMoveFolder } from '@/ds/icons/central/IconMoveFolder';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/utils/cn';

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
      <SearchInput
        {...listSearchProps}
        label="Search items"
        placeholder="Search items"
        value={searchQuery ?? ''}
        onValueChange={query => onSearchChange?.(query)}
      />
    </div>
  );

  const selectionDropdown = selectedCount > 0 && (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button iconEnd={<IconChevronDownMedium />}>{selectedCount} selected</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-72">
        {onExportClick && (
          <DropdownMenu.Item onSelect={onExportClick}>
            <IconArrowInbox /> Export CSV
          </DropdownMenu.Item>
        )}
        {onExportJsonClick && (
          <DropdownMenu.Item onSelect={onExportJsonClick}>
            <IconArrowInbox /> Export JSON
          </DropdownMenu.Item>
        )}
        {onCreateDatasetClick && (
          <DropdownMenu.Item onSelect={onCreateDatasetClick}>
            <IconFolderAddRight />
            <span>Create dataset from items</span>
          </DropdownMenu.Item>
        )}
        {onAddToDatasetClick && (
          <DropdownMenu.Item onSelect={onAddToDatasetClick}>
            <IconMoveFolder />
            <span>Copy items to dataset</span>
          </DropdownMenu.Item>
        )}
        {onDeleteClick && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={onDeleteClick} variant="destructive">
              <TrashIcon /> Delete items
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
                  <IconChevronDownMedium />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onSelect={onImportClick}>
                  <IconArrowOutOfBox /> Import CSV
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onImportJsonClick}>
                  <IconFileText /> Import JSON
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </ButtonsGroup>
        )}
      </div>
    </div>
  );
}
