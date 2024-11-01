'use client';

import { RefinedIntegrationEvent } from '@mastra/core';
import { useEffect } from 'react';

import EventDynamicForm from '@/domains/playground/components/event/event-dynamic-form';
import { useEventPlaygroundContext } from '@/domains/playground/context/event-playground-context';

type RefinedIntegrationEventWithLogo = RefinedIntegrationEvent & {
  logoUrl: string;
};

function EventSchemaBlock({ name }: { name: string }) {
  const { frameworkEvents, setSelectedEvent } = useEventPlaygroundContext();

  const frameworkEvent = frameworkEvents.find(
    event => event.key?.toLowerCase() === name.toLowerCase(),
  ) as RefinedIntegrationEventWithLogo;

  useEffect(() => {
    setSelectedEvent(frameworkEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkEvent]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-mastra-bg-2 border-mastra-border-1 overflow-hidden">
      <EventDynamicForm
        icon={frameworkEvent?.logoUrl || 'system'}
        showChangeButton={false}
        headerClassname="p-4 bg-mastra-bg-13"
      />
    </div>
  );
}

export { EventSchemaBlock };
