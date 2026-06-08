import {
  Button,
  CodeEditor,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui';
import { Braces } from 'lucide-react';
import { useState } from 'react';

export interface WorkflowJsonDialogProps {
  result: Record<string, unknown>;
}

export const WorkflowJsonDialog = ({ result }: WorkflowJsonDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="default" onClick={() => setOpen(true)}>
        <Braces className="text-neutral3" />
        Workflow Execution
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Workflow Execution (JSON)</DialogTitle>
            <DialogDescription>JSON view of the workflow execution result</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[90vh]">
            <CodeEditor data={result} className="p-4" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
