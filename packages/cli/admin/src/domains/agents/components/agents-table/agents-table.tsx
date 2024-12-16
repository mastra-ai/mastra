import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

interface IAgentsTable<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const AgentsTable = <TData, TValue>({ columns, data }: IAgentsTable<TData, TValue>) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();

  return (
    <Table className={cn('w-full font-[400]')}>
      <TableHeader className="bg-[#171717] sticky top-0 z-10">
        {headerGroups.map(headerGroup => (
          <TableRow key={headerGroup.id} className="border-gray-6 border-b-[0.1px] text-[0.8125rem]">
            {headerGroup?.headers?.map(header => (
              <TableHead
                key={header.id}
                className={cn(
                  'text-mastra-el-3 h-[1.87rem] px-[1.3rem] py-2 tracking-wider',
                  header.id === 'name' ? 'w-1/3' : '',
                )}
              >
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="border-b border-gray-6">
        {rows?.map(row => {
          return (
            <TableRow
              className="border-b-gray-6 cursor-pointer border-b-[0.1px] text-[0.8125rem]"
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
            >
              {row.getVisibleCells().map(cell => (
                <TableCell
                  className={cn('h-[2.75rem] px-[1.3rem] py-2', cell.id.includes('actions') ? 'pr-0' : '')}
                  key={cell.id}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default AgentsTable;
