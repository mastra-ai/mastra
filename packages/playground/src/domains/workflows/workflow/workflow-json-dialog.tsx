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
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

export interface WorkflowJsonDialogProps {
  data: Record<string, unknown>;
  triggerLabel: string;
  title: string;
  description: string;
  triggerIcon?: ReactNode;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
}

export const WorkflowJsonDialog = ({
  data,
  triggerLabel,
  title,
  description,
  triggerIcon = <Braces className="shrink-0 text-neutral3" />,
  variant = 'default',
  size = 'default',
  className,
}: WorkflowJsonDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {triggerIcon}
        <span className="truncate">{triggerLabel}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[90vh]">
            <CodeEditor data={data} className="p-4" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
