import type { WorkflowAction } from '@mastra/core';

import { Icon } from '@/components/icon';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, TooltipPortal } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { FrameworkIcon } from '../utils/action-selector';
import { DeleteWorkflowActionDropdownButton } from '../utils/delete-workflow-action-dropdown-button';

import { WorkflowBlockDropdown } from './workflow-block-dropdown';
import { WorkflowGraphAddBlock } from './workflow-graph-add-block';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-mastra-border-1',
  states: 'hover:border-mastra-border-5 focus:border-mastra-border-5',
  header: 'p-[10px] text-[13px] flex gap-[7px] items-center',
  details: 'bg-neutral-800 rounded-b-md p-[10px] text-[10px] text-left text-neutral-300',
};

export function ActionNode({ action, handleActionClick }: { handleActionClick: () => void; action: WorkflowAction }) {
  const { frameworkApis, selectedBlock, attemptedPublish, actionsValidityObject } = useWorkflowContext();

  const isConditionAction = action.type === `CONDITIONS`;
  const concreteAction =
    frameworkApis.find(systemAction => systemAction.type === action.type) ||
    systemLogics.find(systemLogic => systemLogic.type === action.type);

  if (!action.id) return null;

  if (!concreteAction) {
    return (
      <>
        <ContextMenu modal={false}>
          <ContextMenuTrigger aria-label="context-menu" className="relative">
            <div
              onClick={handleActionClick}
              className={cn(
                blockStyles.default,
                blockStyles.states,
                'bg-mastra-bg-3 flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
                {
                  'border-mastra-border-5': selectedBlock?.block?.id === action?.id,
                },
              )}
              title="New API"
            >
              <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
                <Icon name="enrich" className="text-mastra-el-4" />
                <Text size="xs" className="text-mastra-el-4" weight="medium">
                  API
                </Text>
              </div>
              <Text className="text-mastra-el-3 max-w-[120px] text-left text-[10px]">
                Select API to continue your workflow
              </Text>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="rounded-[8px] border-0 bg-[#737373]/5 shadow-md ring-1 ring-neutral-700 backdrop-blur-xl">
            <DeleteWorkflowActionDropdownButton action={action} deleteOnlyBlock />
          </ContextMenuContent>
        </ContextMenu>
        {action.subActions?.length ? (
          <>
            <div
              role="presentation"
              className={cn('from-mastra-el-1 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
            />
            <WorkflowGraphAddBlock parentActionId={action.id} />
          </>
        ) : null}
      </>
    );
  }

  const { label, icon, description } = concreteAction;

  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger aria-label="context-menu" className="relative">
          <div
            onClick={handleActionClick}
            className={cn(blockStyles.default, blockStyles.states, 'bg-mastra-bg-8 min-w-[274px]', {
              'border-mastra-border-5': selectedBlock?.block?.id === action?.id,
            })}
          >
            <div className={cn(blockStyles.header, 'text-[13px]')}>
              <div className={cn('flex items-center gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
                <FrameworkIcon icon={icon} className="text-current" />
                <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
                  {label}
                </Text>
              </div>
              {attemptedPublish && !actionsValidityObject[action.id]?.isValid && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'border-mastra-border-2 bg-mastra-bg-9 rounded-sm border-[0.4px] border-solid p-1',
                        {},
                      )}
                    >
                      <Icon name="warning-square" className="text-mastra-el-warning" />
                    </div>
                  </TooltipTrigger>
                  <TooltipPortal>
                    <TooltipContent side="top" className="bg-dialog-bg rounded-md p-1 px-3">
                      {actionsValidityObject[action.id]?.message}
                    </TooltipContent>
                  </TooltipPortal>
                </Tooltip>
              )}

              <WorkflowBlockDropdown action={action} />
            </div>
            {description && <div className={cn(blockStyles.details)}>{description}</div>}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="rounded-[8px] border-0 bg-[#737373]/5 shadow-md ring-1 ring-neutral-700 backdrop-blur-xl">
          <DeleteWorkflowActionDropdownButton action={action} />
        </ContextMenuContent>
      </ContextMenu>

      <div
        role="presentation"
        className={cn('from-mastra-el-1 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
      />
      <WorkflowGraphAddBlock
        parentActionId={action.id}
        isParentACondition={isConditionAction}
        isPath={isConditionAction}
      />
    </TooltipProvider>
  );
}
