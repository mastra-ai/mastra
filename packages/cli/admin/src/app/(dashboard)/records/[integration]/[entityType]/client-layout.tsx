'use client';

import { Property } from '@mastra/core';
import { useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { IndividualIntegrationHeader } from '@/domains/integrations/components/individual-integration-header';
import { createColumnDef } from '@/domains/records/components/columns/column-def';
import { RecordTable } from '@/domains/records/components/record-table';
import DisplayDropdown from '@/domains/records/components/sort-and-display/display-dropdown';
import { TableProvider } from '@/domains/records/context/table-context';

export function ClientLayout({
  integration,
  properties,
  data,
  connectionIds,
  connectionId,
}: {
  integration: string;
  properties: any[];
  data: any[];
  connectionIds: { connectionId: string }[];
  connectionId: string;
}) {
  const [orderedProperties, setOrderedProperties] = useState<{
    properties: Property[];
    lastOrderedAt?: number;
  }>({ properties, lastOrderedAt: Date.now() });

  const { entityType: entityTypeParam } = useParams<{ entityType: string }>();

  const router = useRouter();

  function updatePropertiesData(propertiesData: { properties: Property[]; lastOrderedAt?: number }) {
    setOrderedProperties(propertiesData);
  }

  const cols: any[] = orderedProperties ? createColumnDef({ properties: orderedProperties.properties }) : [];

  const handleConnectionIdChange = (e: string) => {
    router.push(`/records/${integration.toLowerCase()}/${entityTypeParam.toLowerCase()}?connectionId=${e}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <IndividualIntegrationHeader
          name={integration}
          headerButton={
            <div className="ml-auto flex items-center gap-2">
              {connectionIds.length > 0 && (
                <Select value={connectionId || ''} onValueChange={handleConnectionIdChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a connection id" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectionIds.map(({ connectionId }) => (
                      <>
                        {connectionId ? (
                          <SelectItem key={connectionId} value={connectionId}>
                            {connectionId}
                          </SelectItem>
                        ) : null}
                      </>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <TopBar properties={orderedProperties.properties} setPropertiesData={updatePropertiesData} />
            </div>
          }
        />
      </div>
      <TableTypeViewType key={orderedProperties.lastOrderedAt} cols={cols} data={data} />
    </div>
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
