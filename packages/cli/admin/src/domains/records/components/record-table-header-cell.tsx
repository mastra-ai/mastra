'use client';

import { flexRender } from '@tanstack/react-table';
import { MouseEvent, useRef } from 'react';

import { TableHead } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useTableContext } from '../context/table-context';

export interface ColumnWidthMap {
  [key: string]: number;
}
interface HeaderCell<TData, TValue> {
  id: string;
  column: any;
  getContext: () => any;
  getResizeHandler: () => any;
}

export function HeaderCell<TData, TValue>({
  headerCell,
  onClick,
  index,
}: {
  headerCell: HeaderCell<TData, TValue>;
  onClick?: (e: MouseEvent) => void;
  index?: number;
}) {
  const cellRef = useRef<HTMLTableCellElement | null>(null);
  const { columnSizeVars } = useTableContext();

  return (
    <TableHead
      ref={cellRef}
      style={{
        borderTop: 'none',
        borderLeft: 'none',
        width: columnSizeVars[`--header-${headerCell?.id}-size`]
          ? `calc(var(--header-${headerCell?.id}-size) * 1px)`
          : '200px',
      }}
      key={headerCell.id}
      className={cn(
        'border-[0.5px] border-mastra-border-1 relative h-11 w-[200px] min-w-[50px] p-0 text-mastra-el-6',
        index === 0 && 'sticky bg-mastra-bg-2 left-[3rem] z-40 !min-w-[200px]',
      )}
      onClick={onClick}
      aria-label={headerCell.column.columnDef.field?.displayName}
    >
      {flexRender(headerCell.column.columnDef.header, headerCell.getContext())}
    </TableHead>
  );
}
