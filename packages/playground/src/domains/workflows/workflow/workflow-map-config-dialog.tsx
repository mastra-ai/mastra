import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { WorkflowCodeContent } from '@mastra/playground-ui/components/Workflow';
import { Eye } from 'lucide-react';
import { useState } from 'react';

export interface WorkflowMapConfigDialogProps {
  stepName: string;
  mapConfig: string;
}

export function WorkflowMapConfigDialog({ stepName, mapConfig }: WorkflowMapConfigDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon={<Eye />} type="button" size="sm" onClick={() => setOpen(true)}>
        Map config
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-4xl">
          <DialogHeader>
            <DialogTitle>{stepName} config</DialogTitle>
            <DialogDescription>View the map configuration for this step</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <WorkflowCodeContent data={mapConfig} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
