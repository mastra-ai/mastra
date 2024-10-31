import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { cn } from '@/lib/utils';

import { useManageWorkflow } from '../../hooks/use-manage-workflow';

import { WorkflowsTableEmptyState } from './workflows-table-empty-state';

interface IWorkflowsTable<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const WorkflowsTable = <TData, TValue>({ columns, data }: IWorkflowsTable<TData, TValue>) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { handleOpenWorkflow, handleCreateWorkflow } = useManageWorkflow();

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
                  'text-[#707070] h-[1.87rem] px-[1.3rem] py-0 tracking-wider',
                  header.id === 'canvas' ? 'w-[11rem] pr-0 text-center' : '',
                  header.id === 'name' ? 'w-1/2' : '',
                  header.id == 'canvas' || header.id == 'name' ? '' : 'text-center',
                )}
              >
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="border-b border-gray-6">
        {rows?.length ? (
          rows?.map(row => {
            const isLoading = (row.original as Record<string, any>)?.isLoading;
            return (
              <TableRow
                className="border-b-gray-6 cursor-pointer border-b-[0.1px] text-[0.8125rem]"
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                onClick={() => {
                  !isLoading && handleOpenWorkflow((row.original as Record<string, any>).id);
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    className={cn('h-[2.75rem] px-[1.3rem] py-0', cell.id.includes('canvas') ? 'pr-0' : '')}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        ) : (
          <TableRow className="border-b-gray-6 h-full border-b-[0.1px]">
            <TableCell className="h-full px-[1.3rem] py-0" colSpan={headerGroups?.[0]?.headers?.length}>
              <WorkflowsTableEmptyState handleCreateWorkflow={handleCreateWorkflow} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default WorkflowsTable;
