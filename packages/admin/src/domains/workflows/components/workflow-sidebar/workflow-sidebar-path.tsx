import type { WorkflowAction, WorkflowLogicConditionGroup } from '@mastra/core';
import { createId } from '@paralleldrive/cuid2';

import { ScrollArea } from '@/components/ui/scroll-area';

import { useWorkflowContext } from '../../context/workflow-context';
import { pathAlphabet } from '../../utils';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import { ConditionBox } from './condition-box';
import { WorkflowPathDropdown } from './workflow-path-dropdown';
import { WorkflowSidebarHeader } from './workflow-sidebar-header';

interface WorkflowSidebarPathProps {
  path: WorkflowLogicConditionGroup;
}

export function WorkflowSidebarPath({ path }: WorkflowSidebarPathProps) {
  const { actions, addNewBlankAction, setSelectedBlock } = useWorkflowContext();
  const parentActionId = actions[path.actionId]?.parentActionId;
  const parentAction = actions[parentActionId || ''] as WorkflowAction;

  if (!parentAction || !path.id) {
    return null;
  }

  const { condition } = parentAction;
  const conditions = Array.isArray(condition) ? condition : [];
  const customConditions = conditions.filter(({ isDefault }) => !isDefault);
  const currentConditionIndex = customConditions?.map(({ id }) => id)?.indexOf(path.id);
  const conditionLogicGroup = conditions?.find(({ id }) => id === path.id);
  const isDefaultPath = conditionLogicGroup?.isDefault;

  if (!conditionLogicGroup) {
    return null;
  }

  const handleAddNewAction = (conditionId: string) => {
    const id = createId();

    addNewBlankAction({
      newAction: {
        id,
        type: '',
        parentActionId: parentAction.id,
      },
      isParentACondition: true,
      conditionId,
    });
  };

  return (
    <>
      <WorkflowSidebarHeader
        title="Configure Path"
        type="path"
        onBackToList={() => {
          setSelectedBlock({ type: 'action', block: parentAction });
        }}
      />
      <ScrollArea className="h-full" viewportClassName="mastra-workflows-scroll-area">
        <div className="flex h-full flex-col pb-5">
          <div className="flex h-full flex-col pb-5">
            <BlockHeader
              title={isDefaultPath ? 'Default Path' : `Path ${pathAlphabet[currentConditionIndex]}`}
              pathIndex={isDefaultPath ? null : currentConditionIndex}
              category="path"
              pathDropdown={
                isDefaultPath ? null : <WorkflowPathDropdown parentAction={parentAction} conditionGroup={path} />
              }
            />

            {isDefaultPath ? (
              <div className="border-mastra-border-1 border-t-[0.3px] px-5 py-6">
                <NextStep
                  actionId={parentAction.id}
                  conditionActionId={conditionLogicGroup.actionId}
                  isCondition
                  onAddNextStep={() => {
                    handleAddNewAction(conditionLogicGroup.id!);
                  }}
                />
              </div>
            ) : (
              <ConditionBox //this renders the action condition box
                condition={conditionLogicGroup}
                index={currentConditionIndex}
                action={parentAction}
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
