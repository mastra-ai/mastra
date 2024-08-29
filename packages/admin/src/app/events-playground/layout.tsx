import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { EventPlaygroundProvider } from '@/domains/playground/providers/event-playground-provider';
import { getSerializedFrameworkEvents } from '@/domains/workflows/utils';
import { RefinedIntegrationEvent } from '@arkw/core';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemEvents = framework?.getSystemEvents();
  // const globalEvents = framework?.getGlobalEvents();

  const allEvents = { ...systemEvents };

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents: Object.values(allEvents),
    ctx: { referenceId: `1` },
  });

  return (
    <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>{children}</EventPlaygroundProvider>
  );
}
