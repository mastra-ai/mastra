import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';

import { WorkflowNestedGraph } from './workflow-nested-graph';

export interface WorkflowNestedGraphDialogProps {
  stepName: string;
  fullStep: string;
  stepGraph: SerializedStepFlowEntry[];
}

export function WorkflowNestedGraphDialog({ stepName, fullStep, stepGraph }: WorkflowNestedGraphDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        View nested graph
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-full z-10">
          <DialogHeader>
            <DialogTitle>{stepName} workflow</DialogTitle>
            <DialogDescription>View the nested workflow graph for this step</DialogDescription>
          </DialogHeader>
          <DialogBody className="min-h-[500px]">
            <ReactFlowProvider key={fullStep}>
              <WorkflowNestedGraph stepGraph={stepGraph} open={open} workflowName={fullStep} />
            </ReactFlowProvider>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
