import { CheckedState } from '@radix-ui/react-checkbox';
import { HeaderGroup, Row } from '@tanstack/react-table';

import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableRow } from '@/components/ui/table';

import { useTableContext } from '../context/table-context';

import { HeaderCell } from './record-table-header-cell';

export const convertRowsToTanStack = (selected: Row<any>[]) => {
  return selected.reduce((acc, { id }) => (id ? { [id]: true, ...acc } : acc), {});
};

export function HeaderRow<TData, TValue>({ headerRow }: { headerRow: HeaderGroup<TData> }) {
  const { table, setRowSelection, getRowLockCondition } = useTableContext();

  if (!table) return <></>;
  const rows = table?.getRowModel()?.rows;

  function toggleValidRows(value: CheckedState) {
    if (value) {
      const tanstackRows = convertRowsToTanStack(rows);
      setRowSelection?.(tanstackRows);
    } else {
      table?.toggleAllPageRowsSelected(false);
    }
  }

  return (
    <TableRow key={headerRow.id} className="relative flex border-none">
      <TableHead className="border-b-mastra-border-1 border-b-[0.5px] bg-mastra-bg-2 sticky left-0 z-40 flex h-11 w-[3rem] items-center justify-center p-0">
        <Checkbox checked={table.getIsAllRowsSelected()} onCheckedChange={toggleValidRows} aria-label="Select all" />
      </TableHead>
      {headerRow.headers.map((headerCell, i: number) => (
        <HeaderCell index={i} headerCell={headerCell} key={i} />
      ))}
    </TableRow>
  );
}
