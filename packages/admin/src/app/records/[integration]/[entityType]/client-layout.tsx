'use client';

import { Property } from '@arkw/core';
import _ from 'lodash';
import { useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { createColumnDef } from '@/domains/records/components/columns/column-def';
import { RecordTable } from '@/domains/records/components/record-table';
import DisplayDropdown from '@/domains/records/components/sort-and-display/display-dropdown';
import { TableProvider } from '@/domains/records/context/table-context';

export function ClientLayout({
  integration,
  properties,
  data,
  entityTypes,
}: {
  integration: string;
  properties: any[];
  data: any[];
  entityTypes: Record<string, string>;
}) {
  const [orderedProperties, setOrderedProperties] = useState<{
    properties: Property[];
    lastOrderedAt?: number;
  }>({ properties, lastOrderedAt: Date.now() });

  const entityTypesArr = Object.values(entityTypes);

  const { entityType: entityTypeParam } = useParams<{ entityType: string }>();
  const currentEntityType = entityTypeParam.toUpperCase();

  const router = useRouter();

  console.log({
    data,
    properties,
  });

  function updatePropertiesData(propertiesData: { properties: Property[]; lastOrderedAt?: number }) {
    setOrderedProperties(propertiesData);
  }

  const cols: any[] = orderedProperties ? createColumnDef({ properties: orderedProperties.properties }) : [];

  const handleEntityChange = (eT: string) => {
    router.push(`/records/${integration.toLowerCase()}/${eT.toLowerCase()}`);
  };

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-arkw-border-1 p-4">
        {integration}
      </h1>

      <Tabs defaultValue={currentEntityType}>
        <div className="flex gap-2 items-center py-2 px-4 overflow-clip">
          <p className="text-sm gradient">Tables:</p>
          <TabsList className="inline-flex gap-2 items-center">
            {entityTypesArr.map((entityType, index) => {
              const isActive = entityType === currentEntityType;
              return (
                <TabsTrigger
                  onClick={() => {
                    handleEntityChange(entityType);
                  }}
                  value={entityType}
                  asChild
                  key={index}
                >
                  <button
                    type="button"
                    className={cn(
                      'rounded-xs text-xs capitalize text-arkw-el-3 border border-arkw-border-1 border-opacity-50 px-2.5 py-1 transition-colors duration-200 hover:text-arkw-el-6',
                      isActive ? 'text-arkw-el-6 bg-arkw-bg-5/40' : '',
                    )}
                  >
                    {_.startCase(entityType.toLowerCase())}
                  </button>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <div className="ml-auto">
            <TopBar properties={orderedProperties.properties} setPropertiesData={updatePropertiesData} />
          </div>
        </div>

        {entityTypesArr.map(entityType => (
          <TabsContent key={entityType} className="mt-0" value={entityType}>
            <TableTypeViewType key={orderedProperties.lastOrderedAt} cols={cols} data={data}></TableTypeViewType>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TableTypeViewType({ cols, data }: { cols: any[]; data: any[] }) {
  const [rowSelection, setRowSelection] = useState({});

  return (
    <>
      <TableProvider rowSelection={rowSelection} setRowSelection={setRowSelection} columns={cols} data={data}>
        <RecordTable />
      </TableProvider>
    </>
  );
}

function TopBar({ properties, setPropertiesData }: Pick<DisplayDropdown, 'properties' | 'setPropertiesData'>) {
  return (
    <DisplayDropdown properties={properties} setPropertiesData={setPropertiesData}>
      <Button
        className="rounded-xs h-fit text-xs capitalize group flex items-center gap-1 text-arkw-el-6 border border-arkw-border-1 border-opacity-50 px-2.5 py-1 transition-colors duration-200"
        variant={'secondary'}
      >
        <Icon name="display" className="text-arkw-el-3 h-3 w-3 group-hover:text-arkw-el-6 transition-colors" />
        <p>Display</p>
      </Button>
    </DisplayDropdown>
  );
}
