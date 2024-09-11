'use client';

import { Property } from '@kepler/core';
import _ from 'lodash';
import { useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  referenceIds,
  referenceId,
}: {
  integration: string;
  properties: any[];
  data: any[];
  entityTypes: Record<string, string>;
  referenceIds: { referenceId: string }[];
  referenceId: string;
}) {
  const [orderedProperties, setOrderedProperties] = useState<{
    properties: Property[];
    lastOrderedAt?: number;
  }>({ properties, lastOrderedAt: Date.now() });

  const entityTypesArr = Object.values(entityTypes);

  const { entityType: entityTypeParam } = useParams<{ entityType: string }>();
  const currentEntityType = entityTypeParam.toUpperCase();

  const router = useRouter();

  function updatePropertiesData(propertiesData: { properties: Property[]; lastOrderedAt?: number }) {
    setOrderedProperties(propertiesData);
  }

  const cols: any[] = orderedProperties ? createColumnDef({ properties: orderedProperties.properties }) : [];

  const handleEntityChange = (eT: string) => {
    router.push(`/records/${integration.toLowerCase()}/${eT.toLowerCase()}`);
  };

  const handleReferenceIdChange = (e: string) => {
    router.push(`/records/${integration.toLowerCase()}/${entityTypeParam.toLowerCase()}?referenceId=${e}`);
  };

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
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
                      'rounded-xs  text-kp-el-3 text-xs capitalize  border border-primary-border border-opacity-50 px-2.5 py-1 transition-colors duration-200 hover:text-light-text',
                      isActive ? ' text-kp-el-6 bg-kp-bg-3' : '',
                    )}
                  >
                    {_.startCase(entityType.toLowerCase())}
                  </button>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            {referenceIds.length > 0 && (
              <Select value={referenceId || ''} onValueChange={handleReferenceIdChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a connection id" />
                </SelectTrigger>
                <SelectContent>
                  {referenceIds.map(({ referenceId }) => (
                    <>
                      {referenceId ? (
                        <SelectItem key={referenceId} value={referenceId}>
                          {referenceId}
                        </SelectItem>
                      ) : null}
                    </>
                  ))}
                </SelectContent>
              </Select>
            )}
            <TopBar properties={orderedProperties.properties} setPropertiesData={updatePropertiesData} />
          </div>
        </div>
        <div>
          {entityTypesArr.map(entityType => (
            <TabsContent key={entityType} className="mt-0" value={entityType}>
              <TableTypeViewType key={orderedProperties.lastOrderedAt} cols={cols} data={data}></TableTypeViewType>
            </TabsContent>
          ))}
        </div>
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
        className="rounded-xs h-fit text-xs capitalize group flex items-center gap-1 text-light-text border border-primary-border border-opacity-50 px-2.5 py-1 transition-colors duration-200"
        variant={'secondary'}
      >
        <Icon name="display" className="text-dim-text h-3 w-3 group-hover:text-light-text transition-colors" />
        <p>Display</p>
      </Button>
    </DisplayDropdown>
  );
}
