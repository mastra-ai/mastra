import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { RequestContextSchemaForm } from '@/domains/request-context/components/request-context-schema-form';
import { Button } from '@/ds/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowRequestContextDialogProps {
  requestContextSchema: string;
  requestContext: Record<string, any>;
  onRequestContextChange: (values: Record<string, any>) => void;
}

export const WorkflowRequestContextDialog = ({
  requestContextSchema,
  requestContext,
  onRequestContextChange,
}: WorkflowRequestContextDialogProps) => {
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
            {/* The dialog is a React child of the outer workflow form; without this guard,
                the inner form's Save submit bubbles through the portal and runs the workflow. */}
            <div onSubmit={e => e.stopPropagation()}>
              <RequestContextSchemaForm
                requestContextSchema={requestContextSchema}
                values={requestContext}
                onSave={onRequestContextChange}
              />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
