import type { WorkflowTrigger, UpdateTrigger } from '@arkw/core';
import { useState } from 'react';

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

  return (
    <>
      {/*this renders the list of triggers to select from*/}
      <WorkflowSidebarHeader title={editTrigger ? 'Change Trigger' : 'Set Trigger'} />
      <div className="border-kp-border-1 flex flex-col gap-5 border-b-[0.3px] p-6">
        <div className="space-y-1">
          {editTrigger ? (
            <>
              <h1 className="text-xs">Change Trigger</h1>
              <p className="text-kp-el-6 text-[11px]">Change the event that starts the automation</p>
            </>
          ) : (
            <>
              <h1 className="text-xs">Trigger</h1>
              <p className="text-kp-el-3 text-[11px]">Pick an event to start automation</p>
            </>
          )}
        </div>
        <div className="space-y-2">
          {frameworkEvents.map(event => (
            <TriggerEventSelector
              key={event.type}
              type={event.type}
              icon={event.icon}
              label={event.label}
              onSelectTriggerEvent={handleUpdateTrigger}
              isSelected={trigger?.type === event.type}
            />
          ))}
        </div>
      </div>
    </>
  );
}
