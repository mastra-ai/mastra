import type { DatasetRunResultWithInput } from '@mastra/client-js';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns, RunResultRow } from './columns';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { EmptyState } from '@/ds/components/EmptyState';
import { FileText } from 'lucide-react';

export type RunResultsTableProps = {
  results: DatasetRunResultWithInput[];
  isLoading: boolean;
};

export function RunResultsTable({ results, isLoading }: RunResultsTableProps) {
  const table = useReactTable({
    data: results,
    columns: columns as ColumnDef<RunResultRow>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyRunResultsTable />;
  }

  return (
    <div>
      {isLoading ? (
        <RunResultsTableSkeleton />
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

const RunResultsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Status</Th>
      <Th>Input</Th>
      <Th>Actual Output</Th>
      <Th>Error</Th>
      <Th>Duration</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
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

const EmptyRunResultsTable = () => (
  <div className="flex h-full items-center justify-center py-12">
    <EmptyState
      iconSlot={<FileText className="h-6 w-6" />}
      titleSlot="No Results"
      descriptionSlot="This run has no results yet."
      actionSlot={<span />}
    />
  </div>
);
