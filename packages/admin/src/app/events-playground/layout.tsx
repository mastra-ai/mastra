import { RefinedIntegrationEvent } from '@arkw/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { EventPlaygroundProvider } from '@/domains/playground/providers/event-playground-provider';
import { getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemEvents = framework?.getSystemEvents();

  const connectedIntegrations =
    (await framework?.connectedIntegrations({
      context: {
        referenceId: `1`,
      },
    })) || [];

  const connectedIntegrationsRefinedEvents = connectedIntegrations.reduce<RefinedIntegrationEvent[]>(
    (acc, { name }) => {
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
    },
    [],
  );

  const refinedSystemEvents: RefinedIntegrationEvent[] = Object.entries(systemEvents ?? {}).map(([k, v]) => {
    return {
      ...v,
      key: k,
      integrationName: framework?.config.name,
    };
  });

  const frameworkEvents = [...refinedSystemEvents, ...connectedIntegrationsRefinedEvents];

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { referenceId: `1` },
  });

  return (
    <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>{children}</EventPlaygroundProvider>
  );
}
