'use client';

import { TabsContent, TabsList } from '@radix-ui/react-tabs';
import { useState } from 'react';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';

import { IconName } from '@/types/icons';

import { ApiSection } from './components/api-section';
import { ConnectedIntegration } from './components/connected-integration';

export const ClientLayout = ({
  connectedIntegration,
}: {
  connectedIntegration: { referenceId: string; name: string; apis: any }[];
}) => {
  const [integrationPlaygroundItem, setIntegrationPlaygroundItem] = useState({
    name: lowerCaseWord(connectedIntegration[0].name),
    events: {},
  });

  const updateCurrentIntegrationItem = (name: string) => {
    setIntegrationPlaygroundItem({
      name,
      events: {},
    });
  };

  const currentIntegrationName = lowerCaseWord(integrationPlaygroundItem.name);
  const apis = connectedIntegration.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.apis;

  return (
    <Tabs defaultValue={currentIntegrationName} asChild>
      <>
        <div className="border-r-[0.5px] border-r-arkw-border-1">
          <h1 className="text-sm gradient capitalize border-b-arkw-border-1 border-b-[0.5px] py-3 p-4">
            Connected Integrations
          </h1>
          <TabsList asChild>
            <ScrollArea className="h-screen">
              <div className="flex px-3 py-2 flex-col gap-2 overflow-y-scroll">
                {connectedIntegration.map(integration => {
                  return (
                    <ConnectedIntegration
                      isActive={currentIntegrationName === lowerCaseWord(integration.name)}
                      updateCurrentIntegration={updateCurrentIntegrationItem}
                      key={integration.name}
                      name={integration.name}
                    />
                  );
                })}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </TabsList>
        </div>
        <section>
          <h2 className="border-b-arkw-border-1 capitalize text-sm border-b-[0.5px] py-3 p-4">
            {currentIntegrationName} events
          </h2>
          <TabsContent asChild value={currentIntegrationName}>
            <div className="px-4 py-3 tet-sm">
              <ApiSection integrationName={currentIntegrationName as IconName} apis={apis} />
            </div>
          </TabsContent>
        </section>
      </>
    </Tabs>
  );
};
