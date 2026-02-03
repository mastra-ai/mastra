import { useState, useEffect } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { Checkbox } from '@/ds/components/Checkbox';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Upload } from 'lucide-react';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { ItemsToolbar } from './items-toolbar';
import { toast } from '@/lib/toast';
import { format, isToday } from 'date-fns';

type SelectionMode = 'idle' | 'export' | 'create-dataset' | 'delete';

const itemsListColumns = [
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'expectedOutput', label: 'Expected Output', size: '1fr' },
  { name: 'metadata', label: 'Metadata', size: '8rem' },
  { name: 'date', label: 'Created', size: '5rem' },
];

const itemsListColumnsWithCheckbox = [{ name: 'checkbox', label: 'c', size: '2.5rem' }, ...itemsListColumns];

export interface DatasetItemListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onAddClick: () => void;
  onImportClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
  onItemClick?: (itemId: string) => void;
  featuredItemId?: string | null;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
}

/**
 * Truncate a string to maxLength characters with ellipsis
 */
function truncateValue(value: unknown, maxLength = 100): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function DatasetItemList({
  items,
  isLoading,
  onAddClick,
  onImportClick,
  onBulkDeleteClick,
  onCreateDatasetClick,
  datasetName,
  clearSelectionTrigger,
  onItemClick,
  featuredItemId,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: DatasetItemListProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('idle');
  const selection = useItemSelection();

  // Compute derived values
  const allIds = items.map(i => i.id);
  const selectedItems = items.filter(i => selection.selectedIds.has(i.id));

  // Clear selection when parent increments trigger (after dialog closes or action completes)
  useEffect(() => {
    if (clearSelectionTrigger !== undefined && clearSelectionTrigger > 0) {
      selection.clearSelection();
      setSelectionMode('idle');
    }
  }, [clearSelectionTrigger]);

  const handleCancelSelection = () => {
    setSelectionMode('idle');
    selection.clearSelection();
  };

  const handleExecuteAction = () => {
    if (selection.selectedCount === 0) return;

    if (selectionMode === 'export') {
      try {
        exportItemsToCSV(selectedItems, `${datasetName || 'dataset'}-items.csv`);
        toast.success(`Exported ${selection.selectedCount} items to CSV`);
      } catch (error) {
        toast.error('Failed to export items to CSV');
        console.error('CSV export error:', error);
      }
      handleCancelSelection(); // Clear immediately for export
    } else if (selectionMode === 'create-dataset') {
      onCreateDatasetClick?.(selectedItems);
      // Don't clear yet - parent increments clearSelectionTrigger after dialog closes
    } else if (selectionMode === 'delete') {
      onBulkDeleteClick?.(Array.from(selection.selectedIds));
      // Don't clear yet - parent increments clearSelectionTrigger after delete completes
    }
  };

  if (isLoading) {
    return <DatasetItemListSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyDatasetItemList onAddClick={onAddClick} onImportClick={onImportClick} />;
  }

  const isSelectionActive = selectionMode !== 'idle';
  const columns = isSelectionActive ? itemsListColumnsWithCheckbox : itemsListColumns;

  // Select all state
  const isAllSelected = items.length > 0 && selection.selectedCount === items.length;
  const isIndeterminate = selection.selectedCount > 0 && selection.selectedCount < items.length;

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      selection.clearSelection();
    } else {
      selection.selectAll(allIds);
    }
  };

  const handleEntryClick = (itemId: string) => {
    // Always open item details - selection is handled by checkbox click
    onItemClick?.(itemId);
  };

  return (
    <div className="grid grid-rows-[auto_1fr] gap-8 h-full">
      <ItemsToolbar
        onAddClick={onAddClick}
        onImportClick={onImportClick ?? (() => {})}
        onExportClick={() => setSelectionMode('export')}
        onCreateDatasetClick={() => setSelectionMode('create-dataset')}
        onDeleteClick={() => setSelectionMode('delete')}
        hasItems={items.length > 0}
        isSelectionActive={isSelectionActive}
        selectedCount={selection.selectedCount}
        onExecuteAction={handleExecuteAction}
        onCancelSelection={handleCancelSelection}
        selectionMode={selectionMode}
      />

      <ItemList>
        <ItemList.Header columns={columns}>
          {columns?.map(col => (
            <>
              {col.name === 'checkbox' ? (
                <ItemList.HeaderCol key={col.name} className="flex items-center justify-center">
                  <Checkbox
                    checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                    onCheckedChange={handleSelectAllToggle}
                    aria-label="Select all items"
                  />
                </ItemList.HeaderCol>
              ) : (
                <ItemList.HeaderCol key={col.name}>{col.label || col.name}</ItemList.HeaderCol>
              )}
            </>
          ))}
        </ItemList.Header>

        <ItemList.Scroller>
          <ItemList.Items>
            {items.map(item => {
              const createdAtDate = new Date(item.createdAt);
              const isTodayDate = isToday(createdAtDate);

              const entry = {
                id: item.id,
                input: truncateValue(item.input, 60),
                expectedOutput: item.expectedOutput ? truncateValue(item.expectedOutput, 40) : '-',
                metadata: item.metadata ? Object.keys(item.metadata).length + ' keys' : '-',
                date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
              };

              return (
                <ItemList.Row key={item.id} isSelected={featuredItemId === item.id}>
                  <ItemList.RowButton
                    entry={entry}
                    isSelected={featuredItemId === item.id}
                    columns={columns}
                    onClick={handleEntryClick}
                  >
                    {isSelectionActive && (
                      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selection.selectedIds.has(item.id)}
                          onCheckedChange={() => {}}
                          onClick={e => {
                            e.stopPropagation();
                            selection.toggle(item.id, e.shiftKey, allIds);
                          }}
                          aria-label={`Select item ${item.id}`}
                        />
                      </div>
                    )}
                    <ItemList.ItemText>{entry.input}</ItemList.ItemText>
                    <ItemList.ItemText>{entry.expectedOutput}</ItemList.ItemText>
                    <ItemList.ItemText>{entry.metadata}</ItemList.ItemText>
                    <ItemList.ItemText>{entry.date}</ItemList.ItemText>
                  </ItemList.RowButton>
                </ItemList.Row>
              );
            })}
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
    </div>
  );
}

function DatasetItemListSkeleton() {
  return (
    <ItemList>
      <ItemList.Header columns={itemsListColumns} />
      <ItemList.Items>
        {Array.from({ length: 5 }).map((_, index) => (
          <ItemList.Row key={index}>
            <ItemList.RowButton columns={itemsListColumns}>
              {itemsListColumns.map((col, colIndex) => (
                <ItemList.ItemText key={colIndex} isLoading>
                  Loading...
                </ItemList.ItemText>
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
}

function EmptyDatasetItemList({ onAddClick, onImportClick }: EmptyDatasetItemListProps) {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <EmptyState
        iconSlot={<Plus className="w-8 h-8 text-neutral3" />}
        titleSlot="No items yet"
        descriptionSlot="Add items to this dataset to use them in evaluation runs."
        actionSlot={
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="primary" onClick={onAddClick}>
              <Icon>
                <Plus />
              </Icon>
              Add Item
            </Button>
            {onImportClick && (
              <Button size="lg" variant="outline" onClick={onImportClick}>
                <Icon>
                  <Upload />
                </Icon>
                Import CSV
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
