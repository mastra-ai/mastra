import { useState } from 'react';
import type { WorkflowConditionCardViewProps, WorkflowConditionCodeCondition } from '../types';
import { WorkflowConditionCardView } from './workflow-condition-card-view';

export interface WorkflowConditionCardProps extends Pick<
  WorkflowConditionCardViewProps,
  'conditions' | 'previousDisplayStatus' | 'actionBar'
> {
  initiallyOpen?: boolean;
}

export function WorkflowConditionCard({ conditions, initiallyOpen = true, ...props }: WorkflowConditionCardProps) {
  const [isOpen, setOpen] = useState(initiallyOpen);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogCondition, setDialogCondition] = useState<WorkflowConditionCodeCondition>();

  return (
    <WorkflowConditionCardView
      {...props}
      type={conditions[0]?.type}
      conditions={conditions}
      isOpen={isOpen}
      onOpenChange={setOpen}
      openDialog={openDialog}
      onOpenDialogChange={setOpenDialog}
      dialogCondition={dialogCondition}
      onConditionClick={condition => {
        setDialogCondition(condition);
        setOpenDialog(true);
      }}
    />
  );
}
