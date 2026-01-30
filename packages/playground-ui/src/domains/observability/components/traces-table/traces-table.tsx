import React from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { EyeOff, BookOpen } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead, useTableKeyboardNavigation } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { SearchbarWrapper } from '@/ds/components/Searchbar';

import { TracesTools, EntityOptions } from '../traces-tools';
import { columns } from './columns';
import { TraceTableData } from './types';
import type { TraceTableColumn } from './types';

export interface TracesTableProps {
  traces: TraceTableData[];
  isLoading: boolean;
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  errorMsg?: string;
  filtersApplied?: boolean;
  // Filter props
  entityOptions: EntityOptions[];
  selectedEntity?: EntityOptions;
  onEntityChange: (option: EntityOptions | undefined) => void;
  selectedDateFrom?: Date;
  selectedDateTo?: Date;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  onReset: () => void;
  isLoadingFilters?: boolean;
  // Infinite scroll
  setEndOfListElement?: (el: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
}

export function TracesTable({
  traces,
  isLoading,
  selectedTraceId,
  onTraceClick,
  errorMsg,
  filtersApplied,
  entityOptions,
  selectedEntity,
  onEntityChange,
  selectedDateFrom,
  selectedDateTo,
  onDateChange,
  onReset,
  isLoadingFilters,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: TracesTableProps) {
  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: traces.length,
    global: true,
    onSelect: index => {
      const trace = traces[index];
      if (trace) {
        onTraceClick?.(trace.traceId);
      }
    },
  });

  const table = useReactTable({
    data: traces,
    columns: columns as ColumnDef<TraceTableColumn>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  const handleEntityChange = (option: EntityOptions) => {
    onEntityChange(option);
  };

  return (
    <div>
      <SearchbarWrapper>
        <TracesTools
          onEntityChange={handleEntityChange}
          onReset={onReset}
          selectedEntity={selectedEntity}
          entityOptions={entityOptions}
          onDateChange={onDateChange}
          selectedDateFrom={selectedDateFrom}
          selectedDateTo={selectedDateTo}
          isLoading={isLoadingFilters}
        />
      </SearchbarWrapper>

      {isLoading ? (
        <TracesTableSkeleton />
      ) : errorMsg ? (
        <EmptyTracesTable error={errorMsg} filtersApplied={false} />
      ) : traces.length === 0 ? (
        <EmptyTracesTable filtersApplied={Boolean(filtersApplied)} />
      ) : (
        <ScrollableContainer>
          <Table size="small">
            <Thead className="sticky top-0">
              {ths.headers.map(header => (
                <Th key={header.id} style={{ width: header.column.getSize() ?? 'auto' }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Th>
              ))}
            </Thead>
            <Tbody>
              {rows.map((row, index) => (
                <Row
                  key={row.id}
                  isActive={index === activeIndex}
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
          <InfiniteScrollSentinel
            setEndOfListElement={setEndOfListElement}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
          />
        </ScrollableContainer>
      )}
    </div>
  );
}

const TracesTableSkeleton = () => (
  <Table size="small">
    <Thead>
      <Th>ID</Th>
      <Th>Date & Time</Th>
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
            <Skeleton className="h-4 w-20" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

interface EmptyTracesTableProps {
  filtersApplied: boolean;
  error?: string;
}

const EmptyTracesTable = ({ filtersApplied, error }: EmptyTracesTableProps) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<EyeOff className="w-10 h-10 text-neutral3" />}
      titleSlot={error ? 'Error loading traces' : filtersApplied ? 'No traces found' : 'No Traces Yet'}
      descriptionSlot={
        error
          ? error
          : filtersApplied
            ? 'No traces found for the applied filters. Try adjusting your filters.'
            : 'Traces will appear here once your agents and workflows start running.'
      }
      actionSlot={
        !error &&
        !filtersApplied && (
          <Button
            size="lg"
            variant="outline"
            as="a"
            href="https://mastra.ai/docs/observability"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon>
              <BookOpen />
            </Icon>
            Documentation
          </Button>
        )
      }
    />
  </div>
);

interface InfiniteScrollSentinelProps {
  setEndOfListElement?: (el: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
}

const InfiniteScrollSentinel = ({
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
}: InfiniteScrollSentinelProps) => {
  if (!setEndOfListElement) {
    return null;
  }

  return (
    <div ref={setEndOfListElement} className="text-ui-md text-neutral3 opacity-50 flex mt-8 justify-center">
      {isFetchingNextPage && 'Loading more traces...'}
      {!hasNextPage && !isFetchingNextPage && 'All traces loaded'}
    </div>
  );
};
