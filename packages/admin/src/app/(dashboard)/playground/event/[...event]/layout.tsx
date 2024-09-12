import { RefinedIntegrationEvent } from '@arkw/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { EventPlaygroundProvider } from '@/domains/playground/providers/event-playground-provider';
import { getSerializedFrameworkEvents } from '@/domains/workflows/utils';

import { PlaygroundBreadCrumb } from '../../components/playground-breadcrumb';

export default async function Layout({ children }: { children: ReactNode }) {
  const systemEvents = framework?.getSystemEvents();

  const availableIntegrations = framework?.availableIntegrations()?.map(({ integration }) => integration) || [];

  const availableIntegrationsEvents = availableIntegrations.reduce<RefinedIntegrationEvent[]>((acc, { name }) => {
    const events = framework?.getEventsByIntegration(name) ?? {};
    const refinedEvents: RefinedIntegrationEvent[] = Object.entries(events).map(([k, v]) => {
      return {
        ...v,
        key: k,
        label: k,
        integrationName: name,
      };
    });
    return [...acc, ...refinedEvents];
  }, []);

  const refinedSystemEvents: RefinedIntegrationEvent[] = Object.entries(systemEvents ?? {}).map(([k, v]) => {
    return {
      ...v,
      key: k,
      integrationName: framework?.config.name,
    };
  });

  const frameworkEvents = [...refinedSystemEvents, ...availableIntegrationsEvents];

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { referenceId: '' },
  });

  return (
    <div className="overflow-hidden">
      <nav className="text-sm h-fit capitalize border-b-[0.5px] py-2 border-arkw-border-1 p-4">
        <PlaygroundBreadCrumb />
      </nav>
      <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>
        <section className="p-[0.62rem] bg-arkw-bg-1 h-[calc(100%-1.24rem)]">{children}</section>
      </EventPlaygroundProvider>
    </div>
  );
}
