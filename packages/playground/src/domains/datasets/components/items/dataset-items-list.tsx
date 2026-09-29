import type { DatasetItem } from '@mastra/client-js';
import { Button, CreateButton } from '@mastra/playground-ui/components/Button';
import { DataList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { ExternalLinkIcon, FileJson, Upload } from 'lucide-react';
import { z } from 'zod';

export type DatasetItemsSortKey = 'createdAt';

export interface DatasetItemsColumn {
  name: string;
  label: string;
  size: string;
  sortKey?: DatasetItemsSortKey;
}

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
  columns?: DatasetItemsColumn[];
  searchQuery?: string;
  /** Server-side sort; a column header is sortable when it declares a `sortKey` and `onSortChange` is provided. */
  sort?: ListSort<DatasetItemsSortKey>;
  onSortChange?: (direction: 'asc' | 'desc', key: DatasetItemsSortKey) => void;
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
function truncateValue(value: DatasetItem['input'] | DatasetItem['groundTruth'], maxLength = 100): string {
  if (value === undefined || value === null) return '-';
  const parsedString = z.string().safeParse(value);
  const str = parsedString.success ? parsedString.data : JSON.stringify(value);
  if (!str || str.length <= maxLength) return str || '-';
  return str.slice(0, maxLength) + '...';
}

const expectedTrajectorySchema = z.object({ steps: z.array(z.unknown()) });

function formatExpectedTrajectory(value: DatasetItem['expectedTrajectory']): string {
  const result = expectedTrajectorySchema.safeParse(value);
  return result.success ? `${result.data.steps.length} steps` : 'Yes';
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
  sort,
  onSortChange,
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

  const renderTopCell = (col: DatasetItemsColumn) =>
    col.sortKey && onSortChange ? (
      <DataList.SortableTopCell
        key={col.name}
        sortKey={col.sortKey}
        sort={sort?.key === col.sortKey ? sort.direction : undefined}
        onSortChange={onSortChange}
      >
        {col.label || col.name}
      </DataList.SortableTopCell>
    ) : (
      <DataList.TopCell key={col.name}>{col.label || col.name}</DataList.TopCell>
    );

  const gridColumns = [isSelectionActive ? 'auto' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');

  return (
    <DataList columns={gridColumns} scrollRef={containerRef} fit="container">
      <DataList.Top hasLeadingCell={isSelectionActive}>
        {isSelectionActive && (
          <DataList.TopSelectCell
            checked={isIndeterminate ? 'indeterminate' : isAllSelected}
            onToggle={handleSelectAllToggle}
            aria-label="Select all items"
          />
        )}
        {isSelectionActive ? (
          <DataList.TopCells colStart={2}>{columns.map(renderTopCell)}</DataList.TopCells>
        ) : (
          columns.map(renderTopCell)
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
                    <span className="text-body-sm text-muted-foreground">
                      {formatExpectedTrajectory(item.expectedTrajectory)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DataList.Cell>
                <DataList.Cell className="min-w-0">
                  <span className="block truncate text-body-sm text-placeholder">
                    {formatDate(createdAtDate, 'date-time')}
                  </span>
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
    <EmptyState
      titleSlot="No items yet"
      descriptionSlot={
        <>
          Add items to this dataset to use them <br />
          in experiment runs.
        </>
      }
      actionSlot={
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <CreateButton variant="primary" onClick={onAddClick} tooltip="Add an item">
              New item
            </CreateButton>
            {onImportClick && (
              <Button onClick={onImportClick} icon={<Upload />}>
                Import CSV
              </Button>
            )}
            {onImportJsonClick && (
              <Button onClick={onImportJsonClick} icon={<FileJson />}>
                Import JSON
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            render={<a href="https://mastra.ai/docs/evals/datasets" target="_blank" rel="noopener noreferrer" />}

            icon={<ExternalLinkIcon />}
          >
            Datasets Documentation
          </Button>
        </div>
      }
      variant="fill"
    />
  );
}
