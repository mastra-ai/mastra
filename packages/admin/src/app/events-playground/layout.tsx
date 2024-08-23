import { IntegrationEvent } from '@arkw/core';
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

  const connectedIntegrationsEvents: Record<string, IntegrationEvent<any>> = connectedIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getEventsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const allEvents = { ...systemEvents, ...connectedIntegrationsEvents };

  const frameworkEvents = Object.values(allEvents)
    ?.filter(({ triggerProperties }) => triggerProperties)
    ?.map(({ triggerProperties }) => triggerProperties!);

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { referenceId: `1` },
  });

  return (
    <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>{children}</EventPlaygroundProvider>
  );
}
