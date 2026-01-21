import type { DatasetItem } from '@mastra/client-js';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns, DatasetItemRow, DatasetItemsTableMeta } from './columns';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { EmptyState } from '@/ds/components/EmptyState';
import { DbIcon } from '@/ds/icons';

export type DatasetItemsTableProps = {
  items: DatasetItem[];
  isLoading: boolean;
  onEdit?: (item: DatasetItem) => void;
  onDelete?: (item: DatasetItem) => void;
};

export function DatasetItemsTable({ items, isLoading, onEdit, onDelete }: DatasetItemsTableProps) {
  const meta: DatasetItemsTableMeta = { onEdit, onDelete };

  const table = useReactTable({
    data: items,
    columns: columns as ColumnDef<DatasetItemRow>[],
    getCoreRowModel: getCoreRowModel(),
    meta,
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyDatasetItemsTable />;
  }

  return (
    <div>
      {isLoading ? (
        <DatasetItemsTableSkeleton />
      ) : (
        <ScrollableContainer>
          <TooltipProvider>
            <Table>
              <Thead className="sticky top-0">
                {ths.headers.map(header => (
                  <Th key={header.id} style={{ width: header.column.getSize() ?? 'auto' }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </Thead>
              <Tbody>
                {rows.map(row => {
                  return (
                    <Row key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <React.Fragment key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </React.Fragment>
                      ))}
                    </Row>
                  );
                })}
              </Tbody>
            </Table>
          </TooltipProvider>
        </ScrollableContainer>
      )}
    </div>
  );
}

const DatasetItemsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Input</Th>
      <Th>Expected Output</Th>
      <Th>Created</Th>
      <Th> </Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-32" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-32" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyDatasetItemsTable = () => (
  <div className="flex h-full items-center justify-center py-12">
    <EmptyState
      iconSlot={<DbIcon />}
      titleSlot="No Items"
      descriptionSlot="This dataset has no items yet. Add items to start evaluating."
      actionSlot={<span />}
    />
  </div>
);
