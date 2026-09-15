import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { WorkflowTracingRunOptions } from './workflow-tracing-run-options';

export const WorkflowRunOptionsDialog = () => {
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
            <DialogDescription>Configure tracing and debug options for this workflow run</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <WorkflowTracingRunOptions onSaved={() => setOpen(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
