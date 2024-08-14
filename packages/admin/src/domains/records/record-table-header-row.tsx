import { HeaderGroup } from '@tanstack/react-table';

import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableRow } from '@/components/ui/table';

import { useTableContext } from './context/table-context';
import { HeaderCell } from './record-table-header-cell';

export function HeaderRow<TData, TValue>({ headerRow }: { headerRow: HeaderGroup<TData> }) {
  const { setRowSelection, table } = useTableContext();

  if (!table) return <></>;

  return (
    <TableRow key={headerRow.id} className="border-kp-border-1 relative flex border border-b-0 border-l-0 border-t-0">
      {!!setRowSelection && (
        <TableHead className="border-kp-border-1 bg-kp-bg-2 sticky left-0 z-40 flex h-11 w-[3rem] items-center justify-center border-b p-0">
          <Checkbox
            checked={table.getIsSomePageRowsSelected() && 'indeterminate'}
            // onCheckedChange={toggleValidRows}
            aria-label="Select all"
          />
        </TableHead>
      )}
      {headerRow.headers.map((headerCell, i: number) => (
        <HeaderCell index={i} headerCell={headerCell} key={i} />
      ))}
    </TableRow>
  );
}
