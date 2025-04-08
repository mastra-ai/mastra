'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { PaginationResult } from '@/lib/pagination/types';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface DataTableProps<TData, TValue> {
  /**
   * table title
   */
  title?: string | React.ReactNode;
  /**
   * table icon
   */
  icon?: React.ReactNode;
  /**
   * disable table border
   * @default false
   */
  withoutBorder?: boolean;
  /**
   * table columns
   */
  columns: ColumnDef<TData, TValue>[];
  /**
   * table data
   */
  data: TData[];
  /**
   * custom className for the table parent container
   */
  className?: string;

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
   * table max height
   */
  maxHeight?: string;
  /**
   * disable table container radius
   * @default false
   */
  withoutRadius?: boolean;
  /**
   * disable flex container
   * @default false
   */
  disabledFlex?: boolean;

  /**
   * height of the table row when there are no results
   * @default '96px'
   */
  emptyStateHeight?: string;

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
  title,
  icon,
  withoutBorder = false,
  columns,
  data,
  className,
  pagination,
  gotoNextPage,
  gotoPreviousPage,
  maxHeight,
  withoutRadius = false,
  disabledFlex,
  emptyStateHeight,
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

  return (
    <div className={cn('flex flex-col', disabledFlex ? 'block' : '')}>
      <div className={cn('border', !withoutRadius && 'rounded-md', className)}>
        <Table>
          <TableHeader className="sticky top-0">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className={cn('z-50 bg-[#0f0f0f]', title && 'hover:bg-transparent')}>
                {icon && !title ? <TableHead className="w-9 rounded-tl-md"></TableHead> : null}
                {title ? (
                  <TableHead
                    className={cn('px-0', !withoutRadius && 'rounded-tl-md rounded-tr-md')}
                    colSpan={headerGroup.headers.length + (icon ? 1 : 0)}
                  >
                    {title}
                  </TableHead>
                ) : (
                  headerGroup.headers.map(header => {
                    return (
                      <TableHead
                        className={cn(
                          'last:pr-3',
                          !icon && 'first:pl-3',
                          !withoutBorder && 'border-r last:border-r-0',
                          !withoutRadius && 'last:rounded-tr-md',
                          !withoutRadius && !icon && 'first:rounded-tl-md',
                        )}
                        key={header.id}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })
                )}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index} className="border-b-gray-6 border-b-[0.1px] text-[0.8125rem]">
                    <TableCell className="p-2">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                    <TableCell className="p-2">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                    <TableCell className="p-2">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={(row.getIsSelected() || row.id === selectedRowId) && 'selected'}>
                  {icon && <TableCell className="w-9 first:pl-3">{icon}</TableCell>}
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      className={cn(
                        'p-0 last:pr-3',
                        !icon && 'first:pl-3',
                        !withoutBorder && 'border-r last:border-r-0',
                      )}
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className={cn('h-24 text-center', emptyStateHeight)}>
                  No {emptyText || 'results'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
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
