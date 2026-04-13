import type { DatasetItem } from '@mastra/client-js';
import { Button, ButtonsGroup, Checkbox, EmptyState, EntityList, Spinner, Txt } from '@mastra/playground-ui';
import { format, isThisYear, isToday } from 'date-fns';
import { Plus, Upload, FileJson } from 'lucide-react';

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

  const gridColumns = [isSelectionActive ? '2rem' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');

  return (
    <EntityList columns={gridColumns}>
      <EntityList.Top>
        {isSelectionActive && !maxSelection && (
          <EntityList.TopCell>
            <Checkbox
              checked={isIndeterminate ? 'indeterminate' : isAllSelected}
              onCheckedChange={handleSelectAllToggle}
              aria-label="Select all items"
            />
          </EntityList.TopCell>
        )}
        {isSelectionActive && maxSelection && <EntityList.TopCell>&nbsp;</EntityList.TopCell>}
        {columns.map(col => (
          <EntityList.TopCell key={col.name}>{col.label || col.name}</EntityList.TopCell>
        ))}
      </EntityList.Top>

      {items.length === 0 && searchQuery ? (
        <EntityList.NoMatch message="No items match your search" />
      ) : (
        <EntityList.Rows>
          {items.map(item => {
            const createdAtDate = new Date(item.createdAt);
            const isSelected = featuredItemId === item.id;

            return (
              <EntityList.Row
                key={item.id}
                onClick={() => onItemClick?.(item.id)}
                selected={isSelected || selectedIds.has(item.id)}
              >
                {isSelectionActive && (
                  <EntityList.Cell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => {}} // no-op: selection handled by onClick for shift-key multi-select
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleSelection(item.id, e.shiftKey, allIds);
                      }}
                      aria-label={`Select item ${item.id}`}
                    />
                  </EntityList.Cell>
                )}
                <EntityList.TextCell>
                  <span className="truncate block font-mono">{item.id}</span>
                </EntityList.TextCell>
                <EntityList.TextCell>
                  <span className="truncate block font-mono">{truncateValue(item.input, 60)}</span>
                </EntityList.TextCell>
                {columns.some(col => col.name === 'groundTruth') && (
                  <EntityList.TextCell>
                    <span className="truncate block font-mono">
                      {item.groundTruth ? truncateValue(item.groundTruth, 40) : '-'}
                    </span>
                  </EntityList.TextCell>
                )}
                {columns.some(col => col.name === 'trajectory') && (
                  <EntityList.TextCell>
                    {item.expectedTrajectory ? (
                      <span className="text-xs">
                        {Array.isArray((item.expectedTrajectory as Record<string, unknown>)?.steps)
                          ? `${((item.expectedTrajectory as Record<string, unknown>).steps as unknown[]).length} steps`
                          : 'Yes'}
                      </span>
                    ) : (
                      <span className="text-neutral4">—</span>
                    )}
                  </EntityList.TextCell>
                )}
                <EntityList.TextCell>
                  <span className="truncate block text-neutral2">{formatDate(createdAtDate)}</span>
                </EntityList.TextCell>
              </EntityList.Row>
            );
          })}

          <div ref={setEndOfListElement} className="h-1 col-span-full">
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
            {!hasNextPage && items.length > 0 && (
              <Txt variant="ui-xs" className="text-icon3 text-center py-4 block">
                All items loaded
              </Txt>
            )}
          </div>
        </EntityList.Rows>
      )}
    </EntityList>
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
