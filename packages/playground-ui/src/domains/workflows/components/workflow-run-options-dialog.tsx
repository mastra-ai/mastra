import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { WorkflowTracingRunOptions } from './workflow-tracing-run-options';
import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { TextFieldBlock } from '@/ds/components/FormFieldBlocks';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowRunOptionsDialogProps {
  resourceId: string;
  onResourceIdChange: (resourceId: string) => void;
}

export const WorkflowRunOptionsDialog = ({ resourceId, onResourceIdChange }: WorkflowRunOptionsDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon-md" aria-label="Run Options" onClick={() => setOpen(true)}>
            <Icon>
              <SlidersHorizontal />
            </Icon>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Run Options</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Options</DialogTitle>
            <DialogDescription>
              Configure resource attribution, tracing and debug options for this workflow run
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="px-5 py-2">
              <TextFieldBlock
                name="workflow-run-resource-id"
                label="Resource ID"
                value={resourceId}
                onChange={event => onResourceIdChange(event.target.value)}
                placeholder="e.g. tenant-42"
                helpText="Ignored when server auth derives the resource ID from the user."
              />
            </div>
            <WorkflowTracingRunOptions onSaved={() => setOpen(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
