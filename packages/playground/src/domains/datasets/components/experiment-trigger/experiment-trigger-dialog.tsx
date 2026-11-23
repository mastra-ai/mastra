import { useState } from 'react';
import type { ExperimentTriggerInitialValues } from './experiment-trigger-options';
import { NewExperimentDialog } from './new-experiment-dialog';

export interface ExperimentTriggerDialogProps extends ExperimentTriggerInitialValues {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

/**
 * A fresh form on every open, while the closing dialog keeps its state through its exit animation: the
 * form remounts once the dialog has finished closing. Its key also carries the initial values, so a form
 * mounted while closed starts from the values the caller passes for the next open.
 */
export function ExperimentTriggerDialog({ open, onOpenChange, onSuccess, ...initial }: ExperimentTriggerDialogProps) {
  const [closedCount, setClosedCount] = useState(0);

  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (!isOpen) setClosedCount(count => count + 1);
  };

  return (
    <NewExperimentDialog
      key={`${closedCount}:${JSON.stringify(initial)}`}
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
      onSuccess={onSuccess}
      {...initial}
    />
  );
}
