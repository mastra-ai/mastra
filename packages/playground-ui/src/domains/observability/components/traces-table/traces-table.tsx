import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, DateTimeCell, Row, Table, Tbody, Th, Thead, TxtCell } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, forwardRef } from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { SpanRecord } from '@mastra/core/storage';
import { EyeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TracesTools, EntityOptions } from '../traces-tools';

type Trace = Pick<SpanRecord, 'traceId' | 'name' | 'entityType' | 'entityId' | 'entityName'> & {
  attributes?: Record<string, any> | null;
  createdAt: Date | string;
};

export type TracesTableData = Trace & {
  id: string;
};

export interface TracesTableProps {
  traces?: Trace[];
  isLoading?: boolean;
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  errorMsg?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  // Filter props
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange?: (val: EntityOptions) => void;
  selectedDateFrom?: Date;
  selectedDateTo?: Date;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  onReset?: () => void;
}

const StatusIndicator = ({ status }: { status?: 'success' | 'failed' }) => {
  return (
    <div className={cn('flex justify-center items-center w-full relative')}>
      {status ? (
        <div
          className={cn('w-[0.6rem] h-[0.6rem] rounded-full', {
            'bg-green-600': status === 'success',
            'bg-red-700': status === 'failed',
          })}
        />
      ) : (
        <div className="text-neutral2 text-ui-sm leading-none">-</div>
      )}
    </div>
  );
};

const columns: ColumnDef<TracesTableData>[] = [
  {
    header: 'ID',
    accessorKey: 'shortId',
    size: 96,
    cell: ({ row }) => <TxtCell>{row.original.traceId?.slice(0, 8) || 'n/a'}</TxtCell>,
  },
  {
    header: 'Date/Time',
    accessorKey: 'createdAt',
    size: 176,
    cell: ({ row }) => <DateTimeCell dateTime={new Date(row.original.createdAt)} />,
  },
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ row }) => <TxtCell>{row.original.name}</TxtCell>,
  },
  {
    header: 'Entity',
    accessorKey: 'entityId',
    size: 160,
    cell: ({ row }) => (
      <TxtCell>
        {row.original.entityName ||
          row.original.entityId ||
          row.original.attributes?.agentId ||
          row.original.attributes?.workflowId ||
          '-'}
      </TxtCell>
    ),
  },
  {
    header: 'Status',
    accessorKey: 'status',
    size: 80,
    cell: ({ row }) => (
      <Cell>
        <StatusIndicator status={row.original.attributes?.status} />
      </Cell>
    ),
  },
];

export const TracesTable = forwardRef<HTMLDivElement, TracesTableProps>(function TracesTable(
  {
    traces = [],
    isLoading,
    selectedTraceId,
    onTraceClick,
    errorMsg,
    setEndOfListElement,
    filtersApplied,
    isFetchingNextPage,
    hasNextPage,
    // Filter props
    selectedEntity,
    entityOptions,
    onEntityChange,
    selectedDateFrom,
    selectedDateTo,
    onDateChange,
    onReset,
  },
  ref,
) {
  const tableData: TracesTableData[] = useMemo(
    () =>
      traces.map(trace => ({
        ...trace,
        id: trace.traceId,
      })),
    [traces],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  const showFilters = onEntityChange && entityOptions;

  if (errorMsg) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<EyeIcon />}
          titleSlot="Error loading traces"
          descriptionSlot={errorMsg}
          actionSlot={null}
        />
      </div>
    );
  }

  if (rows.length === 0 && !isLoading) {
    return (
      <div>
        {showFilters && (
          <div className="mb-6">
            <TracesTools
              onEntityChange={onEntityChange}
              onReset={onReset}
              selectedEntity={selectedEntity}
              entityOptions={entityOptions}
              onDateChange={onDateChange}
              selectedDateFrom={selectedDateFrom}
              selectedDateTo={selectedDateTo}
              isLoading={isLoading}
            />
          </div>
        )}
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<EyeIcon />}
            titleSlot={filtersApplied ? 'No traces found' : 'No traces yet'}
            descriptionSlot={
              filtersApplied
                ? 'No traces found for the applied filters. Try adjusting your filters.'
                : 'Traces will appear here once you start running agents or workflows.'
            }
            actionSlot={
              <Button
                size="lg"
                className="w-full"
                variant="light"
                as="a"
                href="https://mastra.ai/en/docs/observability/tracing/overview"
                target="_blank"
              >
                <Icon>
                  <EyeIcon />
                </Icon>
                Docs
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref}>
      {showFilters && (
        <div className="mb-6">
          <TracesTools
            onEntityChange={onEntityChange}
            onReset={onReset}
            selectedEntity={selectedEntity}
            entityOptions={entityOptions}
            onDateChange={onDateChange}
            selectedDateFrom={selectedDateFrom}
            selectedDateTo={selectedDateTo}
            isLoading={isLoading}
          />
        </div>
      )}

      {isLoading ? (
        <TracesTableSkeleton />
      ) : (
        <>
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
                    selected={selectedTraceId === row.original.traceId}
                    onClick={() => onTraceClick?.(row.original.traceId)}
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
          {setEndOfListElement && (
            <div ref={setEndOfListElement} className="text-ui-md text-neutral3 opacity-50 flex mt-8 justify-center">
              {isFetchingNextPage && 'Loading more traces...'}
              {!hasNextPage && !isFetchingNextPage && traces.length > 0 && 'All traces loaded'}
            </div>
          )}
        </>
      )}
    </div>
  );
});

const TracesTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>ID</Th>
      <Th>Date/Time</Th>
      <Th>Name</Th>
      <Th>Entity</Th>
      <Th>Status</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
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
            <Skeleton className="h-4 w-4 rounded-full" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);
