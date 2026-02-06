import { useState, useEffect } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { EntryList } from '@/ds/components/EntryList';
import { Checkbox } from '@/ds/components/Checkbox';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Upload, FileJson } from 'lucide-react';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { exportItemsToJSON } from '../../utils/json-export';
import { ItemsToolbar } from './items-toolbar';
import { toast } from '@/lib/toast';
import { format, isToday } from 'date-fns';

type SelectionMode = 'idle' | 'export' | 'export-json' | 'create-dataset' | 'add-to-dataset' | 'delete';

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
  onImportJsonClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  onAddToDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
  onItemClick?: (itemId: string) => void;
  featuredItemId?: string | null;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Versions panel props
  onVersionsClick?: () => void;
  isVersionsPanelOpen?: boolean;
  hideVersionsButton?: boolean;
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

export function DatasetItemList({
  items,
  isLoading,
  onAddClick,
  onImportClick,
  onImportJsonClick,
  onBulkDeleteClick,
  onCreateDatasetClick,
  onAddToDatasetClick,
  datasetName,
  clearSelectionTrigger,
  onItemClick,
  featuredItemId,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  searchQuery,
  onSearchChange,
  onVersionsClick,
  isVersionsPanelOpen,
  hideVersionsButton,
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
    } else if (selectionMode === 'export-json') {
      try {
        exportItemsToJSON(selectedItems, `${datasetName || 'dataset'}-items.json`);
        toast.success(`Exported ${selection.selectedCount} items to JSON`);
      } catch (error) {
        toast.error('Failed to export items to JSON');
        console.error('JSON export error:', error);
      }
      handleCancelSelection(); // Clear immediately for export
    } else if (selectionMode === 'create-dataset') {
      onCreateDatasetClick?.(selectedItems);
      // Don't clear yet - parent increments clearSelectionTrigger after dialog closes
    } else if (selectionMode === 'add-to-dataset') {
      onAddToDatasetClick?.(selectedItems);
      // Don't clear yet - parent increments clearSelectionTrigger after dialog closes
    } else if (selectionMode === 'delete') {
      onBulkDeleteClick?.(Array.from(selection.selectedIds));
      // Don't clear yet - parent increments clearSelectionTrigger after delete completes
    }
  };

  // Only show empty state if there are no items AND no search is active AND not loading
  // If search is active with no results, we show the list with "no results" message
  if (items.length === 0 && !searchQuery && !isLoading) {
    return (
      <EmptyDatasetItemList
        onAddClick={onAddClick}
        onImportClick={onImportClick}
        onImportJsonClick={onImportJsonClick}
      />
    );
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
      {/* Toolbar with search */}
      <ItemsToolbar
        onAddClick={onAddClick}
        onImportClick={onImportClick ?? (() => {})}
        onImportJsonClick={onImportJsonClick ?? (() => {})}
        onExportClick={() => setSelectionMode('export')}
        onExportJsonClick={() => setSelectionMode('export-json')}
        onCreateDatasetClick={() => setSelectionMode('create-dataset')}
        onAddToDatasetClick={() => setSelectionMode('add-to-dataset')}
        onDeleteClick={() => setSelectionMode('delete')}
        hasItems={items.length > 0}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        isSelectionActive={isSelectionActive}
        selectedCount={selection.selectedCount}
        onExecuteAction={handleExecuteAction}
        onCancelSelection={handleCancelSelection}
        selectionMode={selectionMode}
        onVersionsClick={onVersionsClick ?? (() => {})}
        isVersionsPanelOpen={isVersionsPanelOpen}
        hideVersionsButton={hideVersionsButton}
      />

      {/* Show skeleton during loading, otherwise show the item list */}
      {isLoading ? (
        <DatasetItemListSkeleton />
      ) : (
        <EntryList>
          <EntryList.Trim>
            <EntryList.Header columns={columns} />
            <EntryList.Entries>
              {items.length === 0 && searchQuery ? (
                <div className="flex items-center justify-center py-12 text-neutral4">No items match your search</div>
              ) : (
                items.map((item: DatasetItem) => {
                  const createdAtDate = new Date(item.createdAt);
                  const isTodayDate = isToday(createdAtDate);

                  const entry = {
                    id: item.id,
                    input: truncateValue(item.input, 60),
                    expectedOutput: item.expectedOutput ? truncateValue(item.expectedOutput, 40) : '-',
                    metadata: item.context ? Object.keys(item.context as Record<string, unknown>).length + ' keys' : '-',
                    date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                  };

                  return (
                    <EntryList.Entry
                      key={item.id}
                      entry={entry}
                      isSelected={featuredItemId === item.id}
                      columns={columns}
                      onClick={handleEntryClick}
                    >
                      {isSelectionActive && (
                        <div className="flex items-center justify-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Checkbox
                            checked={selection.selectedIds.has(item.id)}
                            onCheckedChange={() => {}}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              selection.toggle(item.id, e.shiftKey, allIds);
                            }}
                            aria-label={`Select item ${item.id}`}
                          />
                        </div>
                      )}
                      <EntryList.EntryText>{entry.input}</EntryList.EntryText>
                      <EntryList.EntryText>{entry.expectedOutput}</EntryList.EntryText>
                      <EntryList.EntryText>{entry.metadata}</EntryList.EntryText>
                      <EntryList.EntryText>{entry.date}</EntryList.EntryText>
                    </EntryList.Entry>
                  );
                })
              )}
            </EntryList.Entries>
          </EntryList.Trim>
          <EntryList.NextPageLoading
            setEndOfListElement={setEndOfListElement}
            loadingText="Loading more items..."
            noMoreDataText="All items loaded"
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
          />
        </EntryList>
      )}
    </div>
  );
}

function DatasetItemListSkeleton() {
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={itemsListColumns} />
        <EntryList.Entries>
          {Array.from({ length: 5 }).map((_: unknown, index: number) => (
            <EntryList.Entry key={index} columns={itemsListColumns}>
              {itemsListColumns.map((_col: { name: string; label: string; size: string }, colIndex: number) => (
                <EntryList.EntryText key={colIndex} isLoading>
                  Loading...
                </EntryList.EntryText>
              ))}
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
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
            {onImportJsonClick && (
              <Button size="lg" variant="outline" onClick={onImportJsonClick}>
                <Icon>
                  <FileJson />
                </Icon>
                Import JSON
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
