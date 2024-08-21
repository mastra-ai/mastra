'use client';

import { Property } from '@arkw/core';
import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { createColumnDef } from '@/domains/records/components/columns/column-def';
import { RecordTable } from '@/domains/records/components/record-table';
import DisplayDropdown from '@/domains/records/components/sort-and-display/display-dropdown';
import { TableProvider } from '@/domains/records/context/table-context';

// TODO: this should be defined dynamically from info provided by the integrations
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
  slack: [
    {
      name: 'channels',
      param: 'channels',
      viewType: '',
    },
  ],
};

export function ClientLayout({
  integration,
  properties,
  data,
}: {
  integration: string;
  properties: any[];
  data: any[];
}) {
  const [orderedProperties, setOrderedProperties] = useState<{
    properties: Property[];
    lastOrderedAt?: number;
  }>({ properties, lastOrderedAt: Date.now() });

  const [tableParam, setTableParam] = useQueryState('table');

  function updatePropertiesData(propertiesData: { properties: Property[]; lastOrderedAt?: number }) {
    setOrderedProperties(propertiesData);
  }

  const cols: any[] = orderedProperties ? createColumnDef({ properties: orderedProperties.properties }) : [];

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {integration}
      </h1>

      <Tabs defaultValue={'contacts'}>
        <div className="flex gap-2 items-center py-2 px-4 w-full">
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
          <div className="ml-auto">
            <TopBar properties={orderedProperties.properties} setPropertiesData={updatePropertiesData} />
          </div>
        </div>

        {/* You must know ahead of time the value */}
        {tables[integration].map(table => (
          <TabsContent key={table.name} className="mt-0" value={table.name}>
            <TableTypeViewType
              key={orderedProperties.lastOrderedAt}
              cols={cols}
              data={data}
              viewType={table.viewType}
            ></TableTypeViewType>
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
      <>
        <TableProvider rowSelection={rowSelection} setRowSelection={setRowSelection} columns={cols} data={data}>
          <RecordTable />
        </TableProvider>
      </>
    );
  }
  return null;
}

function TopBar({ properties, setPropertiesData }: Pick<DisplayDropdown, 'properties' | 'setPropertiesData'>) {
  return (
    <DisplayDropdown properties={properties} setPropertiesData={setPropertiesData}>
      <Button
        className="rounded-xs h-fit text-xs capitalize group flex items-center gap-1 text-light-text border border-primary-border border-opacity-50 px-2.5 py-1 transition-colors duration-200"
        variant={'secondary'}
      >
        <Icon name="display" className="text-dim-text h-3 w-3 group-hover:text-light-text transition-colors" />
        <p>Display</p>
      </Button>
    </DisplayDropdown>
  );
}
