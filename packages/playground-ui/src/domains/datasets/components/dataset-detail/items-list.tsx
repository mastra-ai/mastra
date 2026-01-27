import { useState } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';

export interface ItemsListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onAddClick: () => void;
  onEditItem?: (item: DatasetItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onImportClick?: () => void;
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

export function ItemsList({ items, isLoading, onAddClick, onEditItem, onDeleteItem, onImportClick }: ItemsListProps) {
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

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
      </div>

      <ScrollableContainer>
        <Table>
          <Thead>
            <Th>Input</Th>
            <Th style={{ width: 200 }}>Expected Output</Th>
            <Th style={{ width: 120 }}>Created</Th>
            <Th style={{ width: 100 }}>Actions</Th>
          </Thead>
          <Tbody>
            {items.map(item => (
              <Row key={item.id}>
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
