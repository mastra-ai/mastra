import { flexRender } from '@tanstack/react-table';
import { MouseEvent, useRef } from 'react';

import { TableHead } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useTableContext } from './context/table-context';

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
        'border-primary-border relative h-11 w-[200px] min-w-[50px] border p-0 text-light-text',
        index === 0 && 'bg-window-bg sticky left-[3rem] z-40 !min-w-[200px]',
      )}
      onClick={onClick}
      aria-label={headerCell.column.columnDef.field?.displayName}
    >
      <>
        {flexRender(headerCell.column.columnDef.header, headerCell.getContext())}
        <div
          {...{
            onDoubleClick: () => headerCell.column.resetSize(),
            onMouseDown: headerCell.getResizeHandler(),
            onTouchStart: headerCell.getResizeHandler(),
            onClick: e => e.stopPropagation(),
            className: `resizer ${headerCell.column.getIsResizing() ? 'isResizing' : ''}`,
          }}
        />
        {index === 0 && (
          <div className="border-primary-border absolute -right-5 top-0 z-40 h-full w-5 border-l bg-gradient-to-r from-neutral-900 to-transparent opacity-40" />
        )}
      </>
    </TableHead>
  );
}
