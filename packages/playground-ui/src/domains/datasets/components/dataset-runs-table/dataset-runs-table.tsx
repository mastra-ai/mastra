import type { DatasetRun } from '@mastra/client-js';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns, DatasetRunRow, DatasetRunsTableMeta } from './columns';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { EmptyState } from '@/ds/components/EmptyState';
import { Play } from 'lucide-react';

export type DatasetRunsTableProps = {
  runs: DatasetRun[];
  isLoading: boolean;
  onViewRun?: (run: DatasetRun) => void;
};

export function DatasetRunsTable({ runs, isLoading, onViewRun }: DatasetRunsTableProps) {
  const meta: DatasetRunsTableMeta = { onViewRun };

  const table = useReactTable({
    data: runs,
    columns: columns as ColumnDef<DatasetRunRow>[],
    getCoreRowModel: getCoreRowModel(),
    meta,
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyDatasetRunsTable />;
  }

  return (
    <div>
      {isLoading ? (
        <DatasetRunsTableSkeleton />
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

const DatasetRunsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Status</Th>
      <Th>Target</Th>
      <Th>Progress</Th>
      <Th>Started</Th>
      <Th>Completed</Th>
      <Th> </Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-12" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-28" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-28" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-8" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyDatasetRunsTable = () => (
  <div className="flex h-full items-center justify-center py-12">
    <EmptyState
      iconSlot={<Play className="h-6 w-6" />}
      titleSlot="No Runs"
      descriptionSlot="No evaluation runs have been executed yet. Run the dataset against an agent to see results."
      actionSlot={<span />}
    />
  </div>
);
