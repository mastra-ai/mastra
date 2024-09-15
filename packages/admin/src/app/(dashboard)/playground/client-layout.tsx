'use client';

import { TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { useState } from 'react';

import Link from 'next/link';

import { Tabs } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { ApiSection } from './components/api-section';
import { ConnectedIntegration } from './components/connected-integration';
import { EventSection } from './components/events-section';

interface ClientLayoutProps {
  connectedIntegrations: {
    referenceId: string;
    name: string;
    apis: any;
    connections: number;
    events: any;
    icon: string;
  }[];
}
export const ClientLayout = ({ connectedIntegrations }: ClientLayoutProps) => {
  const [integrationPlaygroundItem, setIntegrationPlaygroundItem] = useState({
    name: 'system',
  });

  const updateCurrentIntegrationItem = (name: string) => {
    setIntegrationPlaygroundItem({
      name,
    });
  };

  const currentIntegrationName = lowerCaseWord(integrationPlaygroundItem.name);
  const icon = connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.icon;
  const apis = connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.apis;
  const events = connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.events;

  return (
    <Tabs defaultValue={currentIntegrationName} asChild>
      <>
        <div className="border-r-[0.5px] border-r-kpl-border-1">
          <h1 className="text-sm gradient sticky top-0 bg-kpl-bg-3 capitalize border-b-kpl-border-1 border-b-[0.5px] py-3 p-4">
            Playground
          </h1>

          <TabsList asChild>
            <div>
              <div className="flex px-3 py-2 flex-col gap-2 overflow-y-scroll">
                <SystemEventApiTrigger
                  isActive={currentIntegrationName === 'system'}
                  updateCurrentIntegration={updateCurrentIntegrationItem}
                />
                {connectedIntegrations.map(integration => {
                  return (
                    <ConnectedIntegration
                      isActive={currentIntegrationName === lowerCaseWord(integration.name)}
                      updateCurrentIntegration={updateCurrentIntegrationItem}
                      key={integration.name}
                      name={integration.name}
                      connections={integration.connections}
                      icon={integration.icon}
                    />
                  );
                })}
                <Link
                  href="/integrations"
                  className="flex px-2 gap-3 py-2 group hover:bg-kpl-bg-3 transition-all items-center w-full"
                >
                  <span className="w-[2.25rem] grid place-items-center h-[2.25rem] rounded-xs bg-[rgba(255,255,255,0.03)]">
                    <Icon name="plus-icon" className="text-kpl-el-3" />
                  </span>
                  <span className="text-kpl-el-1 group-hover:text-kpl-el-3 text-sm">Connect More</span>
                </Link>
              </div>
            </div>
          </TabsList>
        </div>
        <section>
          <h2 className="border-b-kpl-border-1 sticky top-0 bg-kpl-bg-3 capitalize text-sm border-b-[0.5px] py-3 p-4">
            {currentIntegrationName}
          </h2>
          <TabsContent asChild value={currentIntegrationName}>
            <div className="px-4 py-3 flex flex-col gap-3 text-sm">
              <ApiSection integrationName={currentIntegrationName as IconName} apis={apis} />
              <EventSection
                icon={icon as string}
                integrationName={currentIntegrationName as IconName}
                events={events}
              />
            </div>
          </TabsContent>
        </section>
      </>
    </Tabs>
  );
};

function SystemEventApiTrigger({
  updateCurrentIntegration,
  isActive,
}: {
  updateCurrentIntegration: (name: string) => void;
  isActive: boolean;
}) {
  return (
    <TabsTrigger asChild value={'system'}>
      <button
        key={'system'}
        onClick={() => {
          updateCurrentIntegration('system');
        }}
        className={cn(
          'rounded-[0.625rem] h-14 w-full px-2 transition-all flex gap-4 items-center hover:shadow-sm',
          isActive ? 'bg-[rgba(255,255,255,0.03)]' : '',
        )}
      >
        <span className={cn('bg-kpl-bg-4 shrink-0 h-7 w-7 rounded-xs grid place-items-center')}>
          <Icon name="system" />
        </span>
        <p className="flex text-left flex-col">
          <span className="capitalize text-sm">System</span>
          <span className="text-kpl-el-2 text-[0.6rem]">Connection</span>
        </p>
      </button>
    </TabsTrigger>
  );
}
