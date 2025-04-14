'use client';

import {
  ColumnDef as ReactTableColumnDef,
  flexRender,
  getCoreRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Table, Tbody, Cell, Th, Thead, Row } from '@/ds/components/Table';

import { PaginationResult } from '@/lib/pagination/types';
import { Skeleton } from './skeleton';

export interface DataTableProps<TData, TValue> {
  /**
   * table columns
   */
  columns: ReactTableColumnDef<TData, TValue>[];
  /**
   * table data
   */
  data: TData[];

  pagination?: PaginationResult;
  /**
   * goto next page
   */
  gotoNextPage?: () => void;
  /**
   * goto previous page
   */
  gotoPreviousPage?: () => void;

  /**
   * get the row id
   */
  getRowId?: (row: TData) => string;

  /**
   * selected row id to use for row selection
   */
  selectedRowId?: string;

  /**
   * loading state
   */
  isLoading?: boolean;

  /**
   * text to display when there are no results
   */
  emptyText?: string;
}

export const DataTable = <TData, TValue>({
  columns,
  data,
  pagination,
  gotoNextPage,
  gotoPreviousPage,
  getRowId,
  selectedRowId,
  isLoading,
  emptyText,
}: DataTableProps<TData, TValue>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: pagination ? Math.floor(pagination.offset / pagination.limit) : 0,
    pageSize: pagination?.limit ?? 10,
  });
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination ? Math.ceil(pagination.total / pagination.limit) : -1,
    state: {
      sorting,
      pagination: {
        pageIndex,
        pageSize,
      },
      rowSelection,
    },
    getRowId,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
  });

  const emptyNode = (
    <Row>
      <Cell colSpan={columns.length}>
        <div className="py-12 text-center w-full">No {emptyText || 'results'}</div>
      </Cell>
    </Row>
  );

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  return (
    <div>
      <Table>
        <Thead className="sticky top-0">
          {ths.headers.map(header => {
            const size = header.column.getSize();
            const meta = header.column.columnDef.meta as { width?: string };

            return (
              <Th key={header.id} style={{ width: meta?.width || size || 'auto' }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </Th>
            );
          })}
        </Thead>
        <Tbody>
          {isLoading ? (
            <>
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <Row key={rowIndex}>
                  {Array.from({ length: columns.length }).map((_, cellIndex) => (
                    <Cell key={`row-${rowIndex}-cell-${cellIndex}`}>
                      <Skeleton className="h-4 w-1/2" />
                    </Cell>
                  ))}
                </Row>
              ))}
            </>
          ) : rows?.length > 0 ? (
            rows.map(row => (
              <Row key={row.id} data-state={(row.getIsSelected() || row.id === selectedRowId) && 'selected'}>
                {row.getVisibleCells().map(cell => flexRender(cell.column.columnDef.cell, cell.getContext()))}
              </Row>
            ))
          ) : (
            emptyNode
          )}
        </Tbody>
      </Table>

      {pagination && (
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="text-muted-foreground text-sm">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + data.length, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={gotoPreviousPage} disabled={!pagination.offset}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={gotoNextPage} disabled={!pagination.hasMore}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
