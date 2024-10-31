'use client';

import { Cell, Row, flexRender } from '@tanstack/react-table';
import { VirtualItem } from '@tanstack/react-virtual';
import React, { useRef } from 'react';

import { TableCell } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useTableContext } from '../context/table-context';

interface BodyCellProps<TData, TValue> {
  cell: Cell<TData, TValue>;
  currentRowId: string;
  row: Row<any>;
  rows: any;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTableCellElement>, cell: Cell<TData, TValue>) => void;
  index?: number;
  virtualRow: VirtualItem;
}

function BodyCell<TData, TValue>({ cell, handleKeyDown, row, index }: BodyCellProps<TData, TValue>) {
  const ref = useRef<HTMLTableCellElement>(null);

  const { columnSizeVars } = useTableContext();

  return (
    <TableCell
      tabIndex={0}
      id={cell.id}
      ref={ref}
      onKeyDown={e => handleKeyDown(e, cell)}
      key={cell.id}
      style={{
        minWidth: '50px',
        width: columnSizeVars[`--col-${cell.column.id}-size`]
          ? `calc(var(--col-${cell.column.id}-size) * 1px)`
          : '200px',
        minHeight: '2.5rem',
      }}
      className={cn(
        "mastra-table-cell group/cell border-mastra-border-1 text-text before:border-mastra-border-5 no-scrollbar group relative inset-0 flex w-[200px] grow cursor-pointer items-center overflow-x-scroll border-r p-0 text-base before:pointer-events-none before:absolute before:inset-0 before:left-0 before:top-0 before:z-10 before:h-full before:w-full before:rounded before:border before:opacity-0 before:content-[''] focus-within:outline-none focus-within:before:opacity-100 focus:outline-none focus:before:opacity-100",
        index === 0 && 'sticky bg-mastra-bg-2 left-[3rem] z-40 !min-w-[200px]',
      )}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}

export default React.memo(BodyCell);
