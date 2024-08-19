import { useEffect, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { lodashTitleCase } from '@/lib/string';

import { RefinedIntegrationAction } from '../../workflows/types';
import { useActionPlaygroundContext } from '../providers/action-playground-provider';

import { ActionPlaygroundSidebarHeader } from './action-header';
import ActionSelector from './action-sclector';
import DynamicForm from './dynamic-form';

export function ActionPlaygroundSidebar() {
  const { frameworkActions, selectedAction } = useActionPlaygroundContext();
  const [actionToEdit, setActionToEdit] = useState<RefinedIntegrationAction | undefined>(undefined);

  function handleEditActionType(action: RefinedIntegrationAction) {
    setActionToEdit(action);
  }

  useEffect(() => {
    if (selectedAction) {
      handleEditActionType(selectedAction);
    }
  }, [selectedAction]);

  if (selectedAction) {
    return (
      <>
        <ActionPlaygroundSidebarHeader
          title="Configure Action"
          type="action"
          onBackToList={() => handleEditActionType(selectedAction)}
        />
        <DynamicForm key={selectedAction.type} />
        {/* <ExecuteAction onRunAction={() => handleRunAction()} /> */}
      </>
    );
  }

  const groupByIntegrationName = frameworkActions?.reduce((acc, fwAct) => {
    return {
      ...acc,
      [fwAct.integrationName]: [...(acc[fwAct.integrationName] || []), fwAct],
    };
  }, {} as { [key: string]: RefinedIntegrationAction[] });

  return (
    <>
      {/*this renders the list of action blocks to select from*/}
      <ActionPlaygroundSidebarHeader title={actionToEdit ? 'Change next step' : 'Choose next step'} />
      <ScrollArea>
        <div className="border-kp-border-1 flex flex-col gap-5 border-b-[0.3px] p-6">
          <div className="mb-5 space-y-1">
            <h1 className="text-xs">Actions</h1>
            <p className="text-kp-el-3 text-[11px]">Select an action</p>
          </div>
          <div className="space-y-10">
            {Object.entries(groupByIntegrationName).map(([integrationName, actionList]) => (
              <div key={integrationName} className="space-y-2">
                <p className="text-xs">{lodashTitleCase(integrationName)} Actions</p>
                {(actionList as any).map((actionItem: any) => (
                  <ActionSelector
                    key={actionItem.type}
                    isSelected={actionToEdit?.type === actionItem.type}
                    type={actionItem.type}
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
