'use client';

import type { WorkflowTrigger, UpdateTrigger, RefinedIntegrationEvent } from '@mastra/core';
import { useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { lodashTitleCase } from '@/lib/string';

import { useIntegrationDetails } from '@/domains/integrations/hooks/use-integration';

import { useWorkflowContext } from '../../context/workflow-context';
import { TriggerEventSelector } from '../utils/trigger-event-selector';

import { WorkflowSidebarHeader } from './workflow-sidebar-header';
import { WorkflowSidebarTriggerForm } from './workflow-sidebar-trigger-form';

interface WorkflowSidebarTriggerProps {
  trigger: WorkflowTrigger;
  blueprintId: string;
}

export function WorkflowSidebarTrigger({ trigger, blueprintId }: WorkflowSidebarTriggerProps) {
  const [editTrigger, setEditTrigger] = useState(false);
  const { updateTrigger, frameworkEvents } = useWorkflowContext();

  const handleUpdateTrigger = (updatedTrigger: UpdateTrigger) => {
    setEditTrigger(false);
    updateTrigger(updatedTrigger);
  };

  const handleOpenEdit = () => {
    setEditTrigger(true);
  };

  if (trigger && trigger?.type && !editTrigger) {
    return (
      <>
        <WorkflowSidebarHeader title="Configure Trigger" type="trigger" onBackToList={() => handleOpenEdit()} />
        {/*this renders the selected trigger form*/}
        <WorkflowSidebarTriggerForm
          trigger={trigger}
          onUpdateTrigger={handleUpdateTrigger}
          onEditTrigger={handleOpenEdit}
        />
      </>
    );
  }

  const groupByIntegrationName = frameworkEvents?.reduce((acc, fwEvent) => {
    return {
      ...acc,
      [fwEvent.integrationName!]: [...(acc[fwEvent.integrationName!] || []), fwEvent],
    };
  }, {} as { [key: string]: RefinedIntegrationEvent[] });

  return (
    <>
      {/*this renders the list of triggers to select from*/}
      <WorkflowSidebarHeader title={editTrigger ? 'Change Trigger' : 'Set Trigger'} />
      <ScrollArea>
        <div className="border-mastra-border-1 flex flex-col gap-5 border-b-[0.3px] p-6">
          <div className="space-y-1">
            {editTrigger ? (
              <>
                <h1 className="text-xs">Change Trigger</h1>
                <p className="text-mastra-el-6 text-[11px]">Change the event that starts the automation</p>
              </>
            ) : (
              <>
                <h1 className="text-xs">Trigger</h1>
                <p className="text-mastra-el-3 text-[11px]">Pick an event to start automation</p>
              </>
            )}
          </div>
          <div className="space-y-10">
            {Object.entries(groupByIntegrationName).map(([integrationName, eventsList]) => (
              <TriggerEventsGroup
                key={integrationName}
                integrationName={integrationName}
                eventsList={eventsList}
                handleUpdateTrigger={handleUpdateTrigger}
                trigger={trigger}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

const TriggerEventsGroup = ({
  integrationName,
  eventsList,
  handleUpdateTrigger,
  trigger,
}: {
  integrationName: string;
  eventsList: RefinedIntegrationEvent[];
  handleUpdateTrigger: (updatedTrigger: UpdateTrigger) => void;
  trigger: { type: string };
}) => {
  const { integration } = useIntegrationDetails({ name: integrationName });
  return (
    <div className="space-y-2">
      <p className="text-xs">{lodashTitleCase(integrationName)} Events</p>
      <div className="max-h-96 overflow-scroll">
        <ScrollArea>
          <div className="space-y-2">
            {eventsList.map(event => (
              <TriggerEventSelector
                key={event?.key}
                type={event?.key!}
                icon={{ icon: integration?.logoUrl || 'dashboard', alt: integrationName }}
                label={event.label}
                onSelectTriggerEvent={handleUpdateTrigger}
                isSelected={trigger?.type === event?.key}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
