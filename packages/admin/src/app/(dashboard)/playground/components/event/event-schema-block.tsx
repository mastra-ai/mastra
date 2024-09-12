'use client';

import { useEffect } from 'react';

import EventDynamicForm from '@/domains/playground/components/event-dynamic-form';
import { useEventPlaygroundContext } from '@/domains/playground/providers/event-playground-provider';

function EventSchemaBlock({ name }: { name: string }) {
  const { frameworkEvents, setSelectedEvent } = useEventPlaygroundContext();

  const frameworkEvent = frameworkEvents.find(event => event.key === name);

  useEffect(() => {
    setSelectedEvent(frameworkEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkEvent]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-arkw-bg-2 border-arkw-border-1 overflow-hidden">
      <EventDynamicForm showChangeButton={false} headerClassname="p-4 bg-arkw-bg-13" />
    </div>
  );
}

export { EventSchemaBlock };
