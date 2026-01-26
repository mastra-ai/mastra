import { DatasetItem } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Icon } from '@/ds/icons/Icon';
import { Plus } from 'lucide-react';

export interface ItemsListProps {
  items: DatasetItem[];
  isLoading: boolean;
  onAddClick: () => void;
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

export function ItemsList({ items, isLoading, onAddClick }: ItemsListProps) {
  if (isLoading) {
    return <ItemsListSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyItemsList onAddClick={onAddClick} />;
  }

  return (
    <ScrollableContainer>
      <Table>
        <Thead>
          <Th>Input</Th>
          <Th style={{ width: 200 }}>Expected Output</Th>
          <Th style={{ width: 120 }}>Created</Th>
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
            </Row>
          ))}
        </Tbody>
      </Table>
    </ScrollableContainer>
  );
}

function ItemsListSkeleton() {
  return (
    <Table>
      <Thead>
        <Th>Input</Th>
        <Th style={{ width: 200 }}>Expected Output</Th>
        <Th style={{ width: 120 }}>Created</Th>
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
          </Row>
        ))}
      </Tbody>
    </Table>
  );
}

interface EmptyItemsListProps {
  onAddClick: () => void;
}

function EmptyItemsList({ onAddClick }: EmptyItemsListProps) {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <EmptyState
        iconSlot={<Plus className="w-8 h-8 text-neutral3" />}
        titleSlot="No items yet"
        descriptionSlot="Add items to this dataset to use them in evaluation runs."
        actionSlot={
          <Button size="lg" variant="primary" onClick={onAddClick}>
            <Icon>
              <Plus />
            </Icon>
            Add Item
          </Button>
        }
      />
    </div>
  );
}
