import { ClientScoreRowData } from '@mastra/client-js';
import { Cell, DateTimeCell, Row, Table, Tbody, Th, Thead, TxtCell } from '@/ds/components/Table';
import { EmptyState } from '@/ds/components/EmptyState';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { CircleGaugeIcon } from 'lucide-react';

type ScoresTableData = ClientScoreRowData & {
  inputStr: string;
};

type ScoresTableProps = {
  selectedScoreId?: string;
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  pagination?: {
    total: number;
    hasMore: boolean;
    perPage: number;
    page: number;
  };
  onPageChange?: (page: number) => void;
  errorMsg?: string;
  isLoading?: boolean;
};

const columns: ColumnDef<ScoresTableData>[] = [
  {
    header: 'Date/Time',
    accessorKey: 'createdAt',
    size: 176,
    cell: ({ row }) => <DateTimeCell dateTime={new Date(row.original.createdAt)} />,
  },
  {
    header: 'Input',
    accessorKey: 'inputStr',
    cell: ({ row }) => <TxtCell>{row.original.inputStr}</TxtCell>,
  },
  {
    header: 'Entity',
    accessorKey: 'entityId',
    size: 160,
    cell: ({ row }) => <TxtCell>{row.original.entityId || '-'}</TxtCell>,
  },
  {
    header: 'Score',
    accessorKey: 'score',
    size: 80,
    cell: ({ row }) => <TxtCell>{String(row.original.score ?? '')}</TxtCell>,
  },
];

export function ScoresTable({
  scores = [],
  pagination,
  onScoreClick,
  onPageChange,
  errorMsg,
  selectedScoreId,
  isLoading,
}: ScoresTableProps) {
  const tableData: ScoresTableData[] = useMemo(
    () =>
      scores.map(score => ({
        ...score,
        inputStr: JSON.stringify(score?.input),
      })),
    [scores],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  if (errorMsg) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <EmptyState
          iconSlot={<CircleGaugeIcon />}
          titleSlot="Error loading scores"
          descriptionSlot={errorMsg}
          actionSlot={null}
        />
      </div>
    );
  }

  if (isLoading) {
    return <ScoresTableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <EmptyState
          iconSlot={<CircleGaugeIcon />}
          titleSlot="No scores yet"
          descriptionSlot="No scores for this scorer yet."
          actionSlot={null}
        />
      </div>
    );
  }

  const hasMore = pagination?.hasMore;
  const currentPage = pagination?.page || 0;

  return (
    <div>
      <ScrollableContainer>
        <Table>
          <Thead className="sticky top-0">
            {ths.headers.map(header => (
              <Th key={header.id} style={{ width: header.column.getSize() ?? 'auto' }}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </Th>
            ))}
          </Thead>
          <Tbody>
            {rows.map(row => (
              <Row
                key={row.id}
                selected={selectedScoreId === row.original.id}
                onClick={() => onScoreClick?.(row.original.id)}
              >
                {row.getVisibleCells().map(cell => (
                  <React.Fragment key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </React.Fragment>
                ))}
              </Row>
            ))}
          </Tbody>
        </Table>
      </ScrollableContainer>
      {onPageChange && pagination && (
        <div className="flex justify-center gap-4 mt-4">
          <button
            className="text-ui-sm text-neutral4 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            ← Previous
          </button>
          <span className="text-ui-sm text-neutral3">Page {currentPage + 1}</span>
          <button
            className="text-ui-sm text-neutral4 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasMore}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const ScoresTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Date/Time</Th>
      <Th>Input</Th>
      <Th>Entity</Th>
      <Th>Score</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-32" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-12" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);
