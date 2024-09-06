'use client';

import { TabsContent, TabsList } from '@radix-ui/react-tabs';
import { useState } from 'react';

import Link from 'next/link';

import { Tabs } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { ApiSection } from './components/api-section';
import { ConnectedIntegration } from './components/connected-integration';
import { EventSection } from './components/events-section';

export const ClientLayout = ({
  connectedIntegration,
}: {
  connectedIntegration: { referenceId: string; name: string; apis: any; connections: number; events: any }[];
}) => {
  const [integrationPlaygroundItem, setIntegrationPlaygroundItem] = useState({
    name: lowerCaseWord(connectedIntegration[0]?.name || ''),
  });

  const updateCurrentIntegrationItem = (name: string) => {
    setIntegrationPlaygroundItem({
      name,
    });
  };

  const currentIntegrationName = lowerCaseWord(integrationPlaygroundItem.name);
  const apis = connectedIntegration.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.apis;
  const events = connectedIntegration.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.events;

  return (
    <Tabs defaultValue={currentIntegrationName} asChild>
      <>
        <div className="border-r-[0.5px] border-r-arkw-border-1">
          <h1 className="text-sm gradient sticky top-0 bg-arkw-bg-3 capitalize border-b-arkw-border-1 border-b-[0.5px] py-3 p-4">
            Connected Integrations
          </h1>
          <TabsList asChild>
            <div className="flex px-3 py-2 flex-col gap-2 overflow-y-scroll">
              {connectedIntegration.map(integration => {
                return (
                  <ConnectedIntegration
                    isActive={currentIntegrationName === lowerCaseWord(integration.name)}
                    updateCurrentIntegration={updateCurrentIntegrationItem}
                    key={integration.name}
                    name={integration.name}
                    connections={integration.connections}
                  />
                );
              })}
              <Link
                href="/integrations"
                className="flex px-2 gap-3 py-2 group hover:bg-arkw-bg-3 transition-all items-center w-full"
              >
                <span className="w-[2.25rem] grid place-items-center h-[2.25rem] rounded-xs bg-[rgba(255,255,255,0.03)]">
                  <Icon name="plus-icon" className="text-arkw-el-3" />
                </span>
                <span className="text-arkw-el-1 group-hover:text-arkw-el-3 text-sm">Connect More</span>
              </Link>
            </div>
          </TabsList>
        </div>
        <section>
          <h2 className="border-b-arkw-border-1 sticky top-0 bg-arkw-bg-3 capitalize text-sm border-b-[0.5px] py-3 p-4">
            {currentIntegrationName} events
          </h2>
          <TabsContent asChild value={currentIntegrationName}>
            <div className="px-4 py-3 flex flex-col gap-3 text-sm">
              <ApiSection integrationName={currentIntegrationName as IconName} apis={apis} />
              <EventSection integrationName={currentIntegrationName as IconName} events={events} />
            </div>
          </TabsContent>
        </section>
      </>
    </Tabs>
  );
};
