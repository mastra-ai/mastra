'use client';

import { ColumnDef, OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { RefObject, useRef } from 'react';

import { Table, TableBody, TableHeader } from '@/components/ui/table';

import { useIsClient } from '@/lib/hooks/use-is-client';
import { cn } from '@/lib/utils';

import { useTableContext } from '../context/table-context';

import { BodyRow } from './record-table-body-row';
import { HeaderRow } from './record-table-header-row';

export interface RecordTableProps<TData, TValue> {
  className?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  setRowSelection?: OnChangeFn<RowSelectionState>;
  rowSelection?: RowSelectionState;
  rowLockCondition?: (row: TData) => boolean;
}

export const RecordTable = <TData, TValue>() => {
  const tableRef = useRef<HTMLDivElement>(null);
  const { table, columnSizeVars } = useTableContext();

  return (
    <div className={cn('border-mastra-border-1 border-t-[0.5px] select-none h-full')}>
      <div ref={tableRef} className="relative h-full overflow-scroll scroll-smooth">
        <Table
          className="mastra-data-table relative border-separate w-full text-sm"
          style={{
            ...columnSizeVars, //Define column sizes on the <table> element
            width: table?.getTotalSize(),
          }}
        >
          <Header />
          <Body tableRef={tableRef} />
        </Table>
      </div>
    </div>
  );
};

const Header = React.memo(() => {
  const { table } = useTableContext();
  const headerGroups = table?.getHeaderGroups();

  return (
    <TableHeader className="border-mastra-border-1 bg-mastra-bg-2 sticky top-0 z-10 border-[0.5px]">
      {headerGroups?.map((headerRow, i) => (
        <HeaderRow headerRow={headerRow} key={i} />
      ))}
    </TableHeader>
  );
});

Header.displayName = 'Header';

const Body = React.memo(({ tableRef }: { tableRef: RefObject<HTMLDivElement | null> }) => {
  const { isClient } = useIsClient();
  const { table } = useTableContext();
  const rows = table?.getCoreRowModel().rows;

  /*
   *
   * Table Virtualizer
   *
   * The virtualizer needs to know the scrollable container element
   *
   */
  const tableBottomPadding = 120;

  const rowVirtualizer = useVirtualizer({
    count: rows?.length || 0,
    //estimate row height for accurate scrollbar dragging
    estimateSize: () => 48,
    getScrollElement: () => tableRef.current,
    // measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? element => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
    paddingEnd: tableBottomPadding,
  });

  const currentTableHeight = rowVirtualizer.getTotalSize();

  return (
    <TableBody
      className="relative flex w-full [&_tr:last-child]:border-b"
      style={{ height: isClient ? `${currentTableHeight + 50}px` : '' }}
    >
      {rowVirtualizer.getVirtualItems().map(virtualRow => {
        const row = rows?.[virtualRow.index];
        return (
          <BodyRow
            ref={node => rowVirtualizer.measureElement(node)}
            tableRef={tableRef}
            currentRowId={(row?.original as { id: string }).id}
            virtualRow={virtualRow}
            key={row?.original.id}
          />
        );
      })}
    </TableBody>
  );
});

Body.displayName = 'Body';

Table.displayName = 'Table';
