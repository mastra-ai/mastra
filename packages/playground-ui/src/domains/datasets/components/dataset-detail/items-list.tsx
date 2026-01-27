import { useState, useEffect } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Checkbox } from '@/ds/components/Checkbox';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import { useItemSelection } from '../../hooks/use-item-selection';
import { exportItemsToCSV } from '../../utils/csv-export';
import { ActionsMenu } from './items-list-actions';
import { toast } from '@/lib/toast';

type SelectionMode = 'idle' | 'export' | 'create-dataset' | 'delete';

export interface ItemsListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onAddClick: () => void;
  onEditItem?: (item: DatasetItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onImportClick?: () => void;
  onBulkDeleteClick?: (itemIds: string[]) => void;
  onCreateDatasetClick?: (items: DatasetItem[]) => void;
  datasetName?: string;
  clearSelectionTrigger?: number;
}

/**
 * Truncate a string to maxLength characters with ellipsis
 */
function truncateValue(value: unknown, maxLength = 100): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ItemsList({
  items,
  isLoading,
  onAddClick,
  onEditItem,
  onDeleteItem,
  onImportClick,
  onBulkDeleteClick,
  onCreateDatasetClick,
  datasetName,
  clearSelectionTrigger,
}: ItemsListProps) {
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
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
    return <ItemsListSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyItemsList onAddClick={onAddClick} onImportClick={onImportClick} />;
  }

  const handleDeleteConfirm = () => {
    if (deleteItemId && onDeleteItem) {
      onDeleteItem(deleteItemId);
      setDeleteItemId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action buttons above table */}
      <div className="flex justify-end px-4 py-2 gap-2">
        {selectionMode !== 'idle' ? (
          <>
            <span className="text-sm text-neutral3 flex items-center">
              {selection.selectedCount} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={selection.selectedCount === 0}
              onClick={handleExecuteAction}
            >
              {selectionMode === 'export' && 'Export CSV'}
              {selectionMode === 'create-dataset' && 'Create Dataset'}
              {selectionMode === 'delete' && 'Delete'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancelSelection}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {onImportClick && (
              <Button variant="outline" size="sm" onClick={onImportClick}>
                <Icon>
                  <Upload />
                </Icon>
                Import CSV
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAddClick}>
              <Icon>
                <Plus />
              </Icon>
              Add Item
            </Button>
            {items.length > 0 && (
              <ActionsMenu
                onExportClick={() => setSelectionMode('export')}
                onCreateDatasetClick={() => setSelectionMode('create-dataset')}
                onDeleteClick={() => setSelectionMode('delete')}
              />
            )}
          </>
        )}
      </div>

      <ScrollableContainer>
        <Table>
          <Thead>
            {selectionMode !== 'idle' && (
              <Th style={{ width: 40 }}>
                <Checkbox
                  checked={selection.selectedCount === items.length && items.length > 0}
                  onCheckedChange={checked => {
                    if (checked) selection.selectAll(allIds);
                    else selection.clearSelection();
                  }}
                  aria-label="Select all items"
                />
              </Th>
            )}
            <Th>Input</Th>
            <Th style={{ width: 200 }}>Expected Output</Th>
            <Th style={{ width: 120 }}>Created</Th>
            <Th style={{ width: 100 }}>Actions</Th>
          </Thead>
          <Tbody>
            {items.map(item => (
              <Row key={item.id}>
                {selectionMode !== 'idle' && (
                  <Cell>
                    <Checkbox
                      checked={selection.selectedIds.has(item.id)}
                      onCheckedChange={() => {}}
                      onClick={e => {
                        e.stopPropagation();
                        selection.toggle(item.id, e.shiftKey, allIds);
                      }}
                      aria-label={`Select item ${item.id}`}
                    />
                  </Cell>
                )}
                <Cell className="font-mono text-ui-sm text-neutral4">
                  {truncateValue(item.input)}
                </Cell>
                <Cell className="font-mono text-ui-sm text-neutral3">
                  {item.expectedOutput ? truncateValue(item.expectedOutput) : '-'}
                </Cell>
                <Cell className="text-ui-sm text-neutral3">
                  {formatDate(item.createdAt)}
                </Cell>
                <Cell>
                  <div className="flex items-center gap-1">
                    {onEditItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditItem(item)}
                        aria-label="Edit item"
                      >
                        <Icon>
                          <Pencil className="w-4 h-4" />
                        </Icon>
                      </Button>
                    )}
                    {onDeleteItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteItemId(item.id)}
                        aria-label="Delete item"
                      >
                        <Icon>
                          <Trash2 className="w-4 h-4" />
                        </Icon>
                      </Button>
                    )}
                  </div>
                </Cell>
              </Row>
            ))}
          </Tbody>
        </Table>
      </ScrollableContainer>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Item</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDeleteConfirm}>Delete</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

function ItemsListSkeleton() {
  return (
    <Table>
      <Thead>
        <Th>Input</Th>
        <Th style={{ width: 200 }}>Expected Output</Th>
        <Th style={{ width: 120 }}>Created</Th>
        <Th style={{ width: 100 }}>Actions</Th>
      </Thead>
      <Tbody>
        {Array.from({ length: 5 }).map((_, index) => (
          <Row key={index}>
            <Cell>
              <Skeleton className="h-4 w-3/4" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-1/2" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-20" />
            </Cell>
            <Cell>
              <Skeleton className="h-4 w-12" />
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
  );
}

interface EmptyItemsListProps {
  onAddClick: () => void;
  onImportClick?: () => void;
}

function EmptyItemsList({ onAddClick, onImportClick }: EmptyItemsListProps) {
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
