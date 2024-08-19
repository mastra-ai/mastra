'use client';

import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';

import { createColumnDef } from '@/domains/records/columns/column-def';
import { TableProvider } from '@/domains/records/context/table-context';
import { RecordTable } from '@/domains/records/record-table';

const tables: { [key: string]: Array<{ name: string; param: string; viewType: string }> } = {
  google: [
    {
      name: 'contacts',
      param: 'contacts',
      viewType: 'table',
    },
    { name: 'emails', param: 'emails', viewType: '' },
    { name: 'calendar events', param: 'calendar-events', viewType: '' },
  ],
};

export function ClientLayout({ integration, fields, data }: { integration: string; fields: any[]; data: any[] }) {
  const cols: any[] = fields ? createColumnDef({ fields }) : [];

  const [tableParam, setTableParam] = useQueryState('table');

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {integration}
      </h1>

      <Tabs defaultValue={'contacts'}>
        <div className="flex gap-2 items-center py-2 px-4">
          <p className="text-sm gradient">Tables:</p>
          <TabsList className="inline-flex gap-2 items-center">
            {tables[integration].map(table => {
              const isActive = table.param === tableParam;
              return (
                <TabsTrigger
                  onClick={() => {
                    setTableParam(table.param);
                  }}
                  value={table.param}
                  asChild
                  key={table.name}
                >
                  <button
                    type="button"
                    className={cn(
                      'rounded-xs text-xs capitalize text-dim-text border border-primary-border border-opacity-50 px-2.5 py-1 transition-colors duration-200 hover:text-light-text',
                      isActive ? 'text-light-text bg-dropdown-bg/40' : '',
                    )}
                  >
                    {table.name}
                  </button>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* You must know ahead of time the value */}
        {tables[integration].map(table => (
          <TabsContent key={table.name} className="mt-0" value={table.name}>
            <TableTypeViewType cols={cols} data={data} viewType={table.viewType} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TableTypeViewType({ viewType = 'table', cols, data }: { viewType: string; cols: any[]; data: any[] }) {
  const [rowSelection, setRowSelection] = useState({});
  if (viewType === 'table') {
    return (
      <TableProvider rowSelection={rowSelection} setRowSelection={setRowSelection} columns={cols} data={data}>
        <RecordTable />
      </TableProvider>
    );
  }
  return null;
}
