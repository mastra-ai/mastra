import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Braces } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

export interface WorkflowJsonDialogProps {
  data: Record<string, unknown>;
  triggerLabel?: string;
  title: string;
  triggerIcon?: ReactNode;
  trigger?: ReactNode;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const WorkflowJsonDialogContent = ({ data, title }: Pick<WorkflowJsonDialogProps, 'data' | 'title'>) => (
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    <DialogBody className="max-h-[90vh]">
      <CodeEditor data={data} className="p-0" />
    </DialogBody>
  </DialogContent>
);

export const WorkflowJsonDialog = ({
  data,
  triggerLabel,
  title,
  triggerIcon = <Braces className="text-neutral3 shrink-0" />,
  trigger,
  variant = 'default',
  size = 'md',
  className,
  open: controlledOpen,
  onOpenChange,
}: WorkflowJsonDialogProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <>
      {trigger ?? (
        <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
          {triggerIcon}
          {triggerLabel && <span className="truncate">{triggerLabel}</span>}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <WorkflowJsonDialogContent data={data} title={title} />
      </Dialog>
    </>
  );
};
