import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { Plus, Upload, FileJson } from 'lucide-react';
import { isToday } from 'date-fns';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

export interface DatasetItemsListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onItemClick?: (itemId: string) => void;
  featuredItemId?: string | null;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  columns?: { name: string; label: string; size: string }[];
  searchQuery?: string;
  // Selection props (owned by parent)
  isSelectionActive: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string, shiftKey: boolean, allIds: string[]) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  maxSelection?: number;
  // Empty state props
  onAddClick: () => void;
  onImportClick?: () => void;
  onImportJsonClick?: () => void;
}

/**
 * Truncate a string to maxLength characters with ellipsis
 */
function truncateValue(value: unknown, maxLength = 100): string {
  if (value === undefined || value === null) return '-';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (!str || str.length <= maxLength) return str || '-';
  return str.slice(0, maxLength) + '...';
}

export function DatasetItemsList({
  items,
  isLoading,
  onItemClick,
  featuredItemId,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  columns = [],
  searchQuery,
  isSelectionActive,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  maxSelection,
  onAddClick,
  onImportClick,
  onImportJsonClick,
}: DatasetItemsListProps) {
  // Only show empty state if there are no items AND no search is active AND not loading
  if (items.length === 0 && !searchQuery && !isLoading) {
    return (
      <EmptyDatasetItemList
        onAddClick={onAddClick}
        onImportClick={onImportClick}
        onImportJsonClick={onImportJsonClick}
      />
    );
  }

  const allIds = items.map(i => i.id);
  const itemsListColumnsWithCheckbox = [{ name: 'checkbox', label: 'c', size: '1.25rem' }, ...columns];
  const columnsToRender = isSelectionActive ? itemsListColumnsWithCheckbox : columns;

  // Select all state
  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll(allIds);
    }
  };

  const handleToggleSelection = (id: string, shiftKey: boolean, allIds: string[]) => {
    if (maxSelection && !selectedIds.has(id) && selectedIds.size >= maxSelection) {
      // Drop most recent selection, keep oldest + add new one
      const [first] = Array.from(selectedIds);
      onSelectAll([first, id]);
      return;
    }
    onToggleSelection(id, shiftKey, allIds);
  };

  const handleEntryClick = (itemId: string) => {
    onItemClick?.(itemId);
  };

  return (
    <ItemList>
      <ItemList.Header columns={columnsToRender}>
        {columnsToRender?.map(col => (
          <>
            {col.name === 'checkbox' ? (
              <ItemList.Cell key={col.name}>
                {!maxSelection && (
                  <Checkbox
                    checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                    onCheckedChange={handleSelectAllToggle}
                    aria-label="Select all items"
                  />
                )}
              </ItemList.Cell>
            ) : (
              <ItemList.HeaderCol key={col.name}>{col.label || col.name}</ItemList.HeaderCol>
            )}
          </>
        ))}
      </ItemList.Header>

      <ItemList.Scroller>
        <ItemList.Items>
          {items.length === 0 && searchQuery ? (
            <div className="flex items-center justify-center py-12 text-neutral4">No items match your search</div>
          ) : (
            items.map(item => {
              const createdAtDate = new Date(item.createdAt);
              const isTodayDate = isToday(createdAtDate);

              const listItem = {
                id: item.id,
                input: truncateValue(item.input, 60),
                groundTruth: item.groundTruth ? truncateValue(item.groundTruth, 40) : '-',
                metadata: item.metadata ? Object.keys(item.metadata).length + ' keys' : '-',
                // date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                date: createdAtDate,
              };

              return (
                <ItemList.Row key={item.id} isSelected={selectedIds.has(item.id)}>
                  {isSelectionActive && (
                    <ItemList.Cell className="w-12 pl-4">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => {}}
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleSelection(item.id, e.shiftKey, allIds);
                        }}
                        aria-label={`Select item ${item.id}`}
                      />
                    </ItemList.Cell>
                  )}
                  <ItemList.RowButton
                    item={listItem}
                    isFeatured={featuredItemId === item.id}
                    columns={columns}
                    onClick={handleEntryClick}
                  >
                    <ItemList.IdCell id={listItem.id} />
                    <ItemList.TextCell className="font-mono">{listItem.input}</ItemList.TextCell>
                    {columns.some(col => col.name === 'groundTruth') && (
                      <ItemList.TextCell className="font-mono">{listItem.groundTruth}</ItemList.TextCell>
                    )}
                    <ItemList.DateCell date={listItem.date} withTime />
                  </ItemList.RowButton>
                </ItemList.Row>
              );
            })
          )}
        </ItemList.Items>

        <ItemList.NextPageLoading
          setEndOfListElement={setEndOfListElement}
          loadingText="Loading more items..."
          noMoreDataText="All items loaded"
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
        />
      </ItemList.Scroller>
    </ItemList>
  );
}

function DatasetItemListSkeleton({ columns = [] }: { columns?: { name: string; label: string; size: string }[] }) {
  return (
    <ItemList>
      <ItemList.Header columns={columns} />
      <ItemList.Items>
        {Array.from({ length: 5 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={columns}>
              {columns.map((col, colIndex) => (
                <ItemList.TextCell key={colIndex} isLoading>
                  Loading...
                </ItemList.TextCell>
              ))}
            </ItemList.RowButton>
          </ItemList.Row>
        ))}
      </ItemList.Items>
    </ItemList>
  );
}

interface EmptyDatasetItemListProps {
  onAddClick: () => void;
  onImportClick?: () => void;
  onImportJsonClick?: () => void;
}

function EmptyDatasetItemList({ onAddClick, onImportClick, onImportJsonClick }: EmptyDatasetItemListProps) {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <EmptyState
        iconSlot={<Plus className="w-8 h-8 text-neutral3" />}
        titleSlot="No items yet"
        descriptionSlot="Add items to this dataset to use them in experiment runs."
        actionSlot={
          <div className="flex flex-col gap-2">
            <ButtonsGroup spacing="close">
              <Button size="default" variant="standard" onClick={onAddClick}>
                <Plus />
                Add Single Item
              </Button>
              {onImportClick && (
                <Button size="default" variant="standard" onClick={onImportClick}>
                  <Upload />
                  Import CSV
                </Button>
              )}
              {onImportJsonClick && (
                <Button size="default" variant="standard" onClick={onImportJsonClick}>
                  <FileJson />
                  Import JSON
                </Button>
              )}
            </ButtonsGroup>
          </div>
        }
      />
    </div>
  );
}
