import { Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { WorkflowCodeContent } from '@/ds/components/Workflow';

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
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{stepName} config</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <WorkflowCodeContent data={mapConfig} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
