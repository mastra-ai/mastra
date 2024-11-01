'use client';

import type { WorkflowAction } from '@mastra/core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { useWorkflowContext } from '../../context/workflow-context';
import { DeleteWorkflowActionBlockDialog } from '../dialogs/delete-workflow-action-block-dialog';

interface DeleteWorkflowBlockProps {
  action: WorkflowAction;
  deleteOnlyBlock?: boolean;
}

export const DeleteWorkflowActionBlock = ({ action, deleteOnlyBlock }: DeleteWorkflowBlockProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { removeAction } = useWorkflowContext();

  const handleDelete = () => {
    removeAction(action.id, deleteOnlyBlock);
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          if (action.subActions?.length && !deleteOnlyBlock) {
            setIsDialogOpen(true);
          } else {
            handleDelete();
          }
        }}
        className="delete-action-button border-mastra-border-destructive border-[0.5px] border-solid opacity-80 transition-opacity hover:opacity-100"
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
        Delete block
      </Button>

      <DeleteWorkflowActionBlockDialog onDelete={handleDelete} isOpen={isDialogOpen} setOpen={setIsDialogOpen} />
    </>
  );
};
