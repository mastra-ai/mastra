import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { EventPlaygroundProvider } from '@/domains/playground/providers/event-playground-provider';
import { getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const globalEvents = framework?.getGlobalEvents();

  const allEvents = Array.from(globalEvents?.entries() || []).flatMap(([intName, obj]) => {
    return Object.entries(obj).map(([k, v]) => {
      return {
        key: k,
        intName,
        ...v
      }
    })
  })

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents: allEvents,
    ctx: { referenceId: `1` },
  });

  console.log(serializedFrameworkEvents)

  return (
    <EventPlaygroundProvider serializedFrameworkEvents={serializedFrameworkEvents}>{children}</EventPlaygroundProvider>
  );
}
