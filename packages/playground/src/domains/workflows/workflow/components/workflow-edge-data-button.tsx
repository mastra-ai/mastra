import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Database } from 'lucide-react';
import { useState } from 'react';

import { CodeDialogContent } from '../workflow-code-dialog-content';

export interface WorkflowEdgeDataButtonProps {
  previousStepId?: string;
  output?: unknown;
  label?: string;
}

const hasPayload = (value: unknown) => value !== undefined;

export const WorkflowEdgeDataButton = ({ previousStepId, output, label }: WorkflowEdgeDataButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasOutput = hasPayload(output);
  const dataLabel = label ?? (previousStepId ? `${previousStepId} output` : 'Previous output');

  if (!hasOutput) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-7 gap-1 rounded-full border border-border1 bg-surface3/95 px-2 text-neutral5 shadow-lg hover:bg-surface4"
      >
        <Database className="h-icon-sm w-icon-sm text-accent1" />
        Data
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>Step output</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[700px] overflow-auto">
            <div className="min-w-0 rounded-lg border border-border1 bg-surface2 p-3">
              <Txt variant="ui-sm" className="mb-2 block text-neutral5">
                {dataLabel}
              </Txt>
              <CodeDialogContent data={output} />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
