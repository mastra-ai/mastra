import type { WorkflowAction } from '@arkw/core';

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, TooltipPortal } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { FrameworkIcon } from '../utils/action-selector';
import { DeleteWorkflowActionDropdownButton } from '../utils/delete-workflow-action-dropdown-button';

import { WorkflowBlockDropdown } from './workflow-block-dropdown';
import { WorkflowGraphAddBlock } from './workflow-graph-add-block';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-arkw-border-1',
  states: 'hover:border-arkw-border-5 focus:border-arkw-border-5',
  header: 'p-[10px] text-[13px] flex gap-[7px] items-center',
  details: 'bg-neutral-800 rounded-b-md p-[10px] text-[10px] text-left text-neutral-300',
};

export function ActionNode({ action, handleActionClick }: { handleActionClick: () => void; action: WorkflowAction }) {
  const { frameworkActions, selectedBlock, attemptedPublish, actionsValidityObject } = useWorkflowContext();

  const isConditionAction = action.type === `CONDITIONS`;
  const concreteAction =
    frameworkActions.find(systemAction => systemAction.type === action.type) ||
    systemLogics.find(systemLogic => systemLogic.type === action.type);

  if (!action.id) return null;

  if (!concreteAction) {
    return (
      <>
        <ContextMenu modal={false}>
          <ContextMenuTrigger aria-label="context-menu" className="relative">
            <button
              onClick={handleActionClick}
              className={cn(
                blockStyles.default,
                blockStyles.states,
                'bg-arkw-bg-3 flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
                {
                  'border-arkw-border-5': selectedBlock?.block?.id === action?.id,
                },
              )}
              title="New action"
            >
              <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
                <Icon name="enrich" className="text-arkw-el-4" />
                <Text size="xs" className="text-arkw-el-4" weight="medium">
                  Action
                </Text>
              </div>
              <Text className="text-arkw-el-3 max-w-[120px] text-left text-[10px]">
                Select event to continue your workflow
              </Text>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="rounded-[8px] border-0 bg-[#737373]/5 shadow-md ring-1 ring-neutral-700 backdrop-blur-xl">
            <DeleteWorkflowActionDropdownButton action={action} deleteOnlyBlock />
          </ContextMenuContent>
        </ContextMenu>
        {action.subActions?.length ? (
          <>
            <div
              role="presentation"
              className={cn('from-arkw-el-1 to-arkw-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
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
          <button
            onClick={handleActionClick}
            className={cn(blockStyles.default, blockStyles.states, 'bg-arkw-bg-8 min-w-[274px]', {
              'border-arkw-border-5': selectedBlock?.block?.id === action?.id,
            })}
          >
            <div className={cn(blockStyles.header, 'text-[13px]')}>
              <span className={cn('border-arkw-border-2 bg-arkw-bg-9 rounded-sm border-[0.4px] border-solid p-2', {})}>
                <FrameworkIcon icon={icon} className="text-current" />
              </span>
              <Text className="text-arkw-el-6 capitalize" size="xs" weight="medium">
                {label}
              </Text>
              {attemptedPublish && !actionsValidityObject[action.id]?.isValid && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('border-arkw-border-2 bg-arkw-bg-9 rounded-sm border-[0.4px] border-solid p-1', {})}
                    >
                      <Icon name="warning-square" className="text-arkw-el-warning" />
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
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="rounded-[8px] border-0 bg-[#737373]/5 shadow-md ring-1 ring-neutral-700 backdrop-blur-xl">
          <DeleteWorkflowActionDropdownButton action={action} />
        </ContextMenuContent>
      </ContextMenu>

      <div
        role="presentation"
        className={cn('from-arkw-el-1 to-arkw-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
      />
      <WorkflowGraphAddBlock
        parentActionId={action.id}
        isParentACondition={isConditionAction}
        isPath={isConditionAction}
      />
    </TooltipProvider>
  );
}
