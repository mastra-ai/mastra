import { createId } from '@paralleldrive/cuid2';

import { Tooltip, TooltipContent, TooltipPortal, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useWorkflowContext } from '../../context/workflow-context';
import { NewActionInMiddleProps } from '../../types';

interface WorkflowGraphAddBlockProps extends Omit<NewActionInMiddleProps, 'newAction'> {
  parentActionId: string;
  isPath?: boolean;
}

export function WorkflowGraphAddBlock({
  parentActionId,
  isParentACondition,
  isParentATrigger,
  conditionId,
  isPath,
}: WorkflowGraphAddBlockProps) {
  const { addNewBlankAction, updateLogicActionCondition } = useWorkflowContext();

  const handleAddNewCondition = () => {
    const id = createId();
    updateLogicActionCondition({
      actionId: parentActionId,
      condition: {
        id,
        blockId: '',
        operator: '',
        field: '',
        actionId: '',
        value: '',
      },
      isNewCondition: true,
      isPathFromGraph: true,
    });
    //write to temp file
  };

  const handleNewBlankAction = () => {
    if (isPath) {
      handleAddNewCondition();
      return;
    }
    const id = createId();
    addNewBlankAction({
      newAction: {
        id,
        type: '',
        parentActionId,
      },
      isParentATrigger,
      isParentACondition,
      conditionId,
    } as NewActionInMiddleProps);

    //write to temp file
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            role="button"
            className="text-kp-el-2 bg-kp-bg-1 relative z-20 flex h-6 w-6 items-center justify-center rounded-full text-lg leading-tight"
            onClick={handleNewBlankAction}
          >
            +
          </div>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side="right"
            className="bg-kp-bg-1 flex h-6 items-center justify-center rounded-[30px] border-0 text-[10px]"
          >
            Add {isPath ? 'path' : 'step'}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
