import { HeaderGroup } from '@tanstack/react-table';

import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableRow } from '@/components/ui/table';

import { useTableContext } from './context/table-context';
import { HeaderCell } from './record-table-header-cell';

export function HeaderRow<TData, TValue>({ headerRow }: { headerRow: HeaderGroup<TData> }) {
  const { table, setRowSelection } = useTableContext();

  if (!table) return <></>;

  return (
    <TableRow key={headerRow.id} className="relative flex border-none">
      <TableHead className="border-b-primary-border border-b-[0.5px] bg-kp-bg-2 sticky left-0 z-40 flex h-11 w-[3rem] items-center justify-center p-0">
        <Checkbox
          checked={table.getIsSomePageRowsSelected() && 'indeterminate'}
          // onCheckedChange={toggleValidRows}
          aria-label="Select all"
        />
      </TableHead>
      {headerRow.headers.map((headerCell, i: number) => (
        <HeaderCell index={i} headerCell={headerCell} key={i} />
      ))}
    </TableRow>
  );
}
