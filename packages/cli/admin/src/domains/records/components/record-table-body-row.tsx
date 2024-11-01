'use client';

import { Row } from '@tanstack/react-table';
import { VirtualItem } from '@tanstack/react-virtual';
import { RefObject, forwardRef, useEffect, useRef } from 'react';
import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useTableContext } from '../context/table-context';
import useCellKeydown from '../hooks/use-cell-keydown';

import BodyCell from './record-table-body-cell';

export const BodyRow = forwardRef<
  HTMLTableRowElement,
  {
    virtualRow: VirtualItem;
    currentRowId: string;
    tableRef: RefObject<HTMLDivElement | null>;
  }
>(({ virtualRow, currentRowId, tableRef }, ref) => {
  const { setRowSelection, table, getRowLockCondition } = useTableContext();
  let tableRowRef = useRef<HTMLTableRowElement>(null);
  const rows = table?.getRowModel().rows;
  const headers = table?.getAllColumns();
  const focusedRowIndex = virtualRow.index;

  const { handleKeydownEvents } = useCellKeydown({ tableRowRef, virtualRow, tableRef });

  //TODO: update types
  const row = rows?.[focusedRowIndex] as Row<any>;

  const isSelectedRow = row?.getIsSelected();

  const rowIsLocked = getRowLockCondition?.(row?.original as any);

  useEffect(() => {
    if (typeof ref === 'function') ref(tableRowRef.current);
  }, [ref]);

  return (
    <TableRow
      id={row.id}
      key={row.id}
      data-index={focusedRowIndex} //needed for dynamic row height measurement
      ref={tableRowRef}
      data-state={isSelectedRow ? 'selected' : ''}
      className={cn('border-neutral-775 group relative flex', 'focus-within:bg-muted/70')}
      style={{
        height: 'fit-content',
        transform: `translateY(${virtualRow.start}px)`,
        position: 'absolute',
      }}
    >
      {!!headers?.length && (
        <TableCell
          id={`checkbox-${row.id}`}
          tabIndex={0}
          data-state={isSelectedRow ? 'selected' : ''}
          //   onKeyDown={e => handleKeydownEvents(e, { id: `checkbox-${row.id}` })}
          className={cn(
            "before:border-mastra-border-5 bg-mastra-bg-2 sticky left-0 z-40 flex w-[3rem] items-center justify-center p-0 pl-[1px] text-center before:pointer-events-none before:absolute before:inset-0 before:left-0 before:top-0 before:z-10 before:rounded before:border before:opacity-0 before:content-[''] focus-within:outline-none focus:outline-none focus:before:opacity-100",
          )}
          onClick={e => {
            e.stopPropagation();
            if (!rowIsLocked) {
              row.toggleSelected();
            }
          }}
        >
          <Checkbox
            id={row.id}
            checked={row?.getIsSelected()}
            onCheckedChange={value => row?.toggleSelected(!!value)}
            aria-label="Select row"
            onKeyDown={e => e.stopPropagation()}
          />
        </TableCell>
      )}

      {row.getVisibleCells().map((cell: any, i: number) => {
        return (
          <BodyCell
            handleKeyDown={handleKeydownEvents}
            index={i}
            cell={cell}
            key={i}
            currentRowId={currentRowId}
            rows={rows}
            row={row}
            virtualRow={virtualRow}
          />
        );
      })}
    </TableRow>
  );
});

BodyRow.displayName = 'BodyRow';
