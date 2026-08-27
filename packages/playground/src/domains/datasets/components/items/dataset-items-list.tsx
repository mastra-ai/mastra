import type { DatasetItem } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { format, isThisYear, isToday } from 'date-fns';
import { Plus, Upload, FileJson } from 'lucide-react';

export interface DatasetItemsListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onItemClick?: (itemId: string) => void;
  featuredItemId?: string | null;
  /** When false, arrow/page keyboard navigation only moves focus without opening the item. Defaults to true. */
  selectOnNavigate?: boolean;
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

function formatDate(date: Date): string {
  const dayMonth = isToday(date) ? 'Today' : format(date, 'MMM dd');
  const year = !isThisYear(date) ? format(date, 'yyyy') : '';
  const time = format(date, "'at' h:mm aaa");
  return `${dayMonth} ${year} ${time}`.replace(/\s+/g, ' ').trim();
}

export function DatasetItemsList({
  items,
  isLoading,
  onItemClick,
  featuredItemId,
  selectOnNavigate = true,
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
  onAddClick,
  onImportClick,
  onImportJsonClick,
}: DatasetItemsListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({
    count: items.length,
    // Arrow/page navigation opens the focused item, keeping the side panel in sync.
    // Guard against the clamped boundary case (same id would toggle the panel closed).
    onNavigate: selectOnNavigate
      ? index => {
          const item = items[index];
          if (item && item.id !== featuredItemId) onItemClick?.(item.id);
        }
      : undefined,
  });

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
    onToggleSelection(id, shiftKey, allIds);
  };

  const gridColumns = [isSelectionActive ? 'auto' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');

  return (
    <DataList columns={gridColumns} scrollRef={containerRef}>
      <DataList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive && (
          <DataList.TopSelectCell
            checked={isIndeterminate ? 'indeterminate' : isAllSelected}
            onToggle={handleSelectAllToggle}
            aria-label="Select all items"
          />
        )}
        {isSelectionActive ? (
          <DataList.TopCells colStart={2}>
            {columns.map(col => (
              <DataList.TopCell key={col.name}>{col.label || col.name}</DataList.TopCell>
            ))}
          </DataList.TopCells>
        ) : (
          columns.map(col => <DataList.TopCell key={col.name}>{col.label || col.name}</DataList.TopCell>)
        )}
      </DataList.Top>

      {items.length === 0 && searchQuery ? (
        <DataList.NoMatch message="No items match your search" />
      ) : (
        <>
          {items.map((item, index) => {
            const createdAtDate = new Date(item.createdAt);
            const isFeatured = featuredItemId === item.id;

            const rowCells = (
              <>
                <DataList.IdCell id={item.id} />
                <DataList.TextCell font="mono">{truncateValue(item.input, 150)}</DataList.TextCell>
                <DataList.TextCell font="mono">
                  {item.groundTruth ? truncateValue(item.groundTruth, 150) : '-'}
                </DataList.TextCell>
                <DataList.Cell className="min-w-0">
                  {item.expectedTrajectory ? (
                    <span className="text-ui-smd text-neutral3">
                      {Array.isArray((item.expectedTrajectory as Record<string, unknown>)?.steps)
                        ? `${((item.expectedTrajectory as Record<string, unknown>).steps as unknown[]).length} steps`
                        : 'Yes'}
                    </span>
                  ) : (
                    <span className="text-neutral4">—</span>
                  )}
                </DataList.Cell>
                <DataList.Cell className="min-w-0">
                  <span className="text-ui-smd text-neutral2 block truncate">{formatDate(createdAtDate)}</span>
                </DataList.Cell>
              </>
            );

            if (!isSelectionActive) {
              return (
                <DataList.RowButton
                  key={item.id}
                  featured={isFeatured}
                  data-selected={isFeatured || undefined}
                  onClick={() => onItemClick?.(item.id)}
                  {...getRowProps(index)}
                >
                  {rowCells}
                </DataList.RowButton>
              );
            }

            return (
              <DataList.RowWrapper key={item.id}>
                <DataList.SelectCell
                  checked={selectedIds.has(item.id)}
                  onToggle={shiftKey => handleToggleSelection(item.id, shiftKey, allIds)}
                  aria-label={`Select item ${item.id}`}
                />
                <DataList.RowButton
                  colStart={2}
                  featured={isFeatured}
                  data-selected={isFeatured || undefined}
                  onClick={() => onItemClick?.(item.id)}
                  {...getRowProps(index)}
                >
                  {rowCells}
                </DataList.RowButton>
              </DataList.RowWrapper>
            );
          })}
          <DataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </DataList>
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
        iconSlot={<Plus className="text-neutral3 h-8 w-8" />}
        titleSlot="No items yet"
        descriptionSlot="Add items to this dataset to use them in experiment runs."
        actionSlot={
          <ButtonsGroup>
            <Button onClick={onAddClick} size="md">
              <Plus />
              Add Single Item
            </Button>
            {onImportClick && (
              <Button onClick={onImportClick} size="md">
                <Upload />
                Import CSV
              </Button>
            )}
            {onImportJsonClick && (
              <Button onClick={onImportJsonClick} size="md">
                <FileJson />
                Import JSON
              </Button>
            )}
          </ButtonsGroup>
        }
      />
    </div>
  );
}
