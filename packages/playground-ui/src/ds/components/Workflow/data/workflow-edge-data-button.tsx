import { Database } from 'lucide-react';
import { useState } from 'react';
import { WorkflowCodeContent } from './workflow-code-dialog-content';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Txt } from '@/ds/components/Txt';

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
        className="border-border1 bg-surface3/95 text-neutral5 hover:bg-surface4 h-7 rounded-full border px-2 shadow-lg"
        icon={<Database className="text-accent1" />}
      >
        Data
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Step output</DialogTitle>
          </DialogHeader>
          <DialogBody className="overflow-auto" style={{ maxHeight: 700 }}>
            <div className="border-border1 bg-surface2 min-w-0 rounded-lg border p-3">
              <Txt variant="ui-sm" className="text-neutral5 mb-2 block">
                {dataLabel}
              </Txt>
              <WorkflowCodeContent data={output} />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
