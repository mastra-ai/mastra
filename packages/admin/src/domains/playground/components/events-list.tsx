'use client';

import type { RefinedIntegrationEventTriggerProperties } from '@arkw/core/dist/types';
import { useEffect, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { lodashTitleCase } from '@/lib/string';

import { useEventPlaygroundContext } from '../providers/event-playground-provider';

import { ActionPlaygroundSidebarHeader } from './action-header';
import EventDynamicForm from './event-dynamic-form';
import EventSelector from './event-selector';

export function EventPlaygroundSidebar() {
  const { frameworkEvents, selectedEvent } = useEventPlaygroundContext();
  const [eventToEdit, setEventToEdit] = useState<RefinedIntegrationEventTriggerProperties | undefined>(undefined);

  function handleEditEventType(event: RefinedIntegrationEventTriggerProperties) {
    setEventToEdit(event);
  }

  useEffect(() => {
    if (selectedEvent) {
      handleEditEventType(selectedEvent);
    }
  }, [selectedEvent]);

  if (selectedEvent) {
    return (
      <>
        <ActionPlaygroundSidebarHeader
          title="Configure Trigger"
          type="trigger"
          onBackToList={() => handleEditEventType(selectedEvent)}
        />
        <EventDynamicForm key={selectedEvent.type} />
      </>
    );
  }

  const groupByIntegrationName = frameworkEvents?.reduce((acc, fwAct) => {
    return {
      ...acc,
      // TODO: update to be grouped by integration name
      ['system']: [...(acc['system'] || []), fwAct],
    };
  }, {} as { [key: string]: RefinedIntegrationEventTriggerProperties[] });

  return (
    <>
      {/*this renders the list of event blocks to select from*/}
      <ActionPlaygroundSidebarHeader title={eventToEdit ? 'Change next step' : 'Choose an event'} />
      <ScrollArea>
        <div className="border-arkw-border-1 flex flex-col gap-5 border-b-[0.3px] p-6">
          <div className="mb-5 space-y-1">
            <h1 className="text-xs">Events</h1>
            <p className="text-arkw-el-3 text-[11px]">Select an event</p>
          </div>
          <div className="space-y-10">
            {Object.entries(groupByIntegrationName).map(([integrationName, eventList]) => (
              <div key={integrationName} className="space-y-2">
                <p className="text-xs">{lodashTitleCase(integrationName)} Events</p>
                {(eventList as any).map((eventItem: any) => (
                  <EventSelector
                    key={eventItem.type}
                    isSelected={eventToEdit?.type === eventItem.type}
                    type={eventItem.type}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
