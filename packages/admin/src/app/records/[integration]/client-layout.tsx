'use client';

import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import { createColumnDef } from '@/domains/records/columns/column-def';
import { TableProvider } from '@/domains/records/context/table-context';
import { RecordTable } from '@/domains/records/record-table';

const tables: { [key: string]: Array<{ name: string; param: string }> } = {
  google: [
    {
      name: 'contacts',
      param: 'contacts',
    },
    { name: 'emails', param: 'email' },
    { name: 'calendar events', param: 'calendar-events' },
  ],
};

export function ClientLayout({ integration, fields, data }: { integration: string; fields: any[]; data: any[] }) {
  const cols: any[] = fields ? createColumnDef({ fields }) : [];
  const [rowSelection, setRowSelection] = useState({});
  const [tableParam, setTableParam] = useQueryState('table');

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {integration}
      </h1>

      <div className="flex gap-2 items-center py-2 px-4">
        <p className="text-sm gradient">Tables:</p>

        {tables[integration].map(table => {
          const isActive = table.param === tableParam;
          return (
            <button
              type="button"
              onClick={() => {
                setTableParam(table.param);
              }}
              className={cn(
                'rounded-xs text-xs capitalize text-dim-text border border-primary-border border-opacity-50 px-2.5 py-1 transition-colors duration-200 hover:text-light-text',
                isActive ? 'text-light-text bg-dropdown-bg/40' : '',
              )}
              key={table.name}
            >
              {table.name}
            </button>
          );
        })}
      </div>
      <TableProvider rowSelection={rowSelection} setRowSelection={setRowSelection} columns={cols} data={data}>
        <RecordTable key={tableParam} />
      </TableProvider>
    </section>
  );
}
