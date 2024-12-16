'use client';

import { TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { useQueryState } from 'nuqs';

import Link from 'next/link';

import { Icon } from '@/components/icon';
import { Tabs } from '@/components/ui/tabs';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

import { ApiSection } from '@/domains/playground/components/api/api-section';
import { ConnectedIntegration } from '@/domains/playground/components/connected-integration';
import { EventSection } from '@/domains/playground/components/event/events-section';
import { IconName } from '@/types/icons';

interface ClientLayoutProps {
  connectedIntegrations: {
    connectionId: string;
    name: string;
    apis: any;
    connections: number;
    events: any;
    icon: string;
    isInstalled: boolean;
  }[];
}
export const ClientLayout = ({ connectedIntegrations }: ClientLayoutProps) => {
  const [integration, setIntegration] = useQueryState('integration', { defaultValue: 'system' });

  const updateCurrentIntegrationItem = (name: string) => {
    setIntegration(name);
  };

  const currentIntegrationName = lowerCaseWord(integration);
  const icon =
    connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.icon || 'system';
  const apis = connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.apis;
  const events = connectedIntegrations.find(item => lowerCaseWord(item.name) === currentIntegrationName)?.events;

  return (
    <Tabs defaultValue={currentIntegrationName} asChild orientation="vertical">
      <div className="grid grid-cols-[23.5rem_1fr]">
        <div className="border-r-[0.5px] border-r-mastra-border-1">
          <h1 className="text-sm text-mastra-el-5 sticky top-0 bg-mastra-bg-3 capitalize border-b-mastra-border-1 border-b-[0.5px] py-3 p-4">
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
                      isInstalled={integration.isInstalled}
                    />
                  );
                })}
                <Link
                  href="/integrations"
                  className="flex px-2 gap-3 py-2 group hover:bg-mastra-bg-3 transition-all items-center w-full"
                >
                  <span className="w-[2.25rem] grid place-items-center h-[2.25rem] rounded-xs bg-[rgba(255,255,255,0.03)]">
                    <Icon name="plus-icon" className="text-mastra-el-3" />
                  </span>
                  <span className="text-mastra-el-1 group-hover:text-mastra-el-3 text-sm">Connect More</span>
                </Link>
              </div>
            </div>
          </TabsList>
        </div>
        <section>
          <h2 className="border-b-mastra-border-1 sticky top-0 bg-mastra-bg-3 capitalize text-sm border-b-[0.5px] py-3 p-4">
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
      </div>
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
        <span className={cn('bg-mastra-bg-4 shrink-0 h-7 w-7 rounded-xs grid place-items-center')}>
          <Icon name="system" />
        </span>
        <p className="flex text-left flex-col">
          <span className="capitalize text-sm">System</span>
          <span className="text-mastra-el-2 text-[0.6rem]">Connection</span>
        </p>
      </button>
    </TabsTrigger>
  );
}
