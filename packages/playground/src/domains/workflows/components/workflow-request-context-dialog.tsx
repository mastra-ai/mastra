import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@mastra/playground-ui';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { RequestContextSchemaForm } from '@/domains/request-context';

export interface WorkflowRequestContextDialogProps {
  requestContextSchema: string;
}

export const WorkflowRequestContextDialog = ({ requestContextSchema }: WorkflowRequestContextDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            aria-label="Request Context"
            onClick={() => setOpen(true)}
          >
            <Icon>
              <KeyRound />
            </Icon>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Request Context</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Context</DialogTitle>
            <DialogDescription>Set request context values for this workflow run</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <RequestContextSchemaForm requestContextSchema={requestContextSchema} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
