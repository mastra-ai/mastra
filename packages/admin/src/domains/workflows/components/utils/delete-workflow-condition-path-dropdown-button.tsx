'use client';

import type { WorkflowAction, WorkflowLogicConditionGroup } from '@mastra/core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { useWorkflowContext } from '../../context/workflow-context';
import { DeleteWorkflowActionBlockDialog } from '../dialogs/delete-workflow-action-block-dialog';

interface DeleteWorkflowConditionPathDropdownButtonProps {
  parentAction: WorkflowAction;
  conditionGroup: WorkflowLogicConditionGroup;
}

export const DeleteWorkflowConditionPathDropdownButton = ({
  parentAction,
  conditionGroup,
}: DeleteWorkflowConditionPathDropdownButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { updateAction, setSelectedBlock, selectedBlock, actions } = useWorkflowContext();
  const { condition } = parentAction;
  const conditions = Array.isArray(condition) ? condition : [];

  const handleDelete = () => {
    let removeActionId: string = '';
    let updatedConditions = conditions as WorkflowLogicConditionGroup[];
    removeActionId = conditionGroup.actionId;
    updatedConditions = updatedConditions?.filter(cond => cond.id !== conditionGroup.id);

    updateAction({ ...parentAction, condition: updatedConditions }, removeActionId);

    if (selectedBlock?.type === 'path') {
      setSelectedBlock({ type: 'action', block: parentAction });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const conditionAction = actions[conditionGroup.actionId];
          if (conditionAction.type) {
            setIsDialogOpen(true);
          } else {
            handleDelete();
          }
        }}
        className="delete-action-button text-mastra-el-4 opacity-80 transition-opacity hover:opacity-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="17" viewBox="0 0 24 24" fill="none">
          <g strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" strokeWidth={'1.5'} fill="none">
            {/* <!-- body--> */}
            <g className="body">
              <polygon points="6 8, 7 20, 17 20, 18 8" />
              <line x1={'14'} y1={'11'} x2={'14'} y2={'17'} />
              <line x1={'10'} y1={'11'} x2={'10'} y2={'17'} />
            </g>
            {/* <!-- lid --> */}
            <g className="lid">
              <line x1={'5'} y1={'8'} x2={'19'} y2={'8'} />
              <rect width={'4'} height={'2.5'} x={'10'} y={'5.5'} />
            </g>
          </g>
        </svg>
        Delete path
      </Button>

      <DeleteWorkflowActionBlockDialog
        onDelete={handleDelete}
        isOpen={isDialogOpen}
        type="path"
        setOpen={setIsDialogOpen}
      />
    </>
  );
};
