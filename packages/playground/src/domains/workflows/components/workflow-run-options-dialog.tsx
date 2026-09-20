import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { WorkflowTracingRunOptions } from './workflow-tracing-run-options';

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
            <div className="space-y-2 px-5 py-2">
              <Label htmlFor="workflow-run-resource-id">Resource ID</Label>
              <Input
                id="workflow-run-resource-id"
                value={resourceId}
                onChange={event => onResourceIdChange(event.target.value)}
                placeholder="e.g. tenant-42"
              />
              <Txt variant="ui-sm" className="text-neutral3">
                Attributes runs started here to a resource so they show up in resource-filtered run lists. Ignored when
                server auth derives the resource ID from the authenticated user.
              </Txt>
            </div>
            <WorkflowTracingRunOptions onSaved={() => setOpen(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
