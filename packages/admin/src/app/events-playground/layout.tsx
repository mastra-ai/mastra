import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { EventPlaygroundProvider } from '@/domains/playground/providers/event-playground-provider';
import { getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemEvents = framework?.getSystemEvents();

  const allEvents = { ...systemEvents };

  const frameworkEvents = Object.values(allEvents)
    ?.filter(({ triggerProperties }) => triggerProperties)
    ?.map(({ triggerProperties }) => triggerProperties!);

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { referenceId: `user-1` },
  });

  return (
    <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>{children}</EventPlaygroundProvider>
  );
}
