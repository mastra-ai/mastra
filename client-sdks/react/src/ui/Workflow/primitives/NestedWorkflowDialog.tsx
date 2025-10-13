import * as Dialog from '@radix-ui/react-dialog';
import { X, Workflow as WorkflowIcon } from 'lucide-react';

// Base dialog primitives using Radix
export const NestedWorkflowDialogRoot = Dialog.Root;
export const NestedWorkflowDialogTrigger = Dialog.Trigger;
export const NestedWorkflowDialogPortal = Dialog.Portal;
export const NestedWorkflowDialogClose = Dialog.Close;

export const NestedWorkflowDialogOverlayClass =
  'mastra:fixed mastra:inset-0 mastra:bg-black/50 mastra:backdrop-blur-sm mastra:data-[state=open]:animate-in mastra:data-[state=closed]:animate-out mastra:data-[state=closed]:fade-out-0 mastra:data-[state=open]:fade-in-0';

export const NestedWorkflowDialogOverlay = ({ className, ...props }: Dialog.DialogOverlayProps) => (
  <Dialog.Overlay className={className || NestedWorkflowDialogOverlayClass} {...props} />
);

export const NestedWorkflowDialogContentClass =
  'mastra:fixed mastra:left-1/2 mastra:top-1/2 mastra:-translate-x-1/2 mastra:-translate-y-1/2 mastra:w-[45rem] mastra:h-[45rem] mastra:max-w-[90vw] mastra:max-h-[90vh] mastra:bg-surface2 mastra:rounded-lg mastra:border mastra:border-border1 mastra:shadow-lg mastra:flex mastra:flex-col mastra:overflow-hidden mastra:data-[state=open]:animate-in mastra:data-[state=closed]:animate-out mastra:data-[state=closed]:fade-out-0 mastra:data-[state=open]:fade-in-0 mastra:data-[state=closed]:zoom-out-95 mastra:data-[state=open]:zoom-in-95';

export const NestedWorkflowDialogContent = ({ className, children, ...props }: Dialog.DialogContentProps) => (
  <NestedWorkflowDialogPortal>
    <NestedWorkflowDialogOverlay />
    <Dialog.Content className={className || NestedWorkflowDialogContentClass} {...props}>
      {children}
    </Dialog.Content>
  </NestedWorkflowDialogPortal>
);

export const NestedWorkflowDialogHeaderClass =
  'mastra:flex mastra:items-center mastra:justify-between mastra:px-4 mastra:py-3 mastra:border-b mastra:border-border1 mastra:bg-surface3';

export const NestedWorkflowDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className || NestedWorkflowDialogHeaderClass} {...props} />
);

export const NestedWorkflowDialogTitleClass =
  'mastra:text-sm mastra:font-medium mastra:text-text6 mastra:flex mastra:items-center mastra:gap-2';

export const NestedWorkflowDialogTitle = ({ className, ...props }: Dialog.DialogTitleProps) => (
  <Dialog.Title className={className || NestedWorkflowDialogTitleClass} {...props} />
);

export const NestedWorkflowDialogBodyClass = 'mastra:flex-1 mastra:overflow-hidden';

export const NestedWorkflowDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className || NestedWorkflowDialogBodyClass} {...props} />
);

export const NestedWorkflowDialogCloseButtonClass =
  'mastra:p-1 mastra:rounded mastra:text-text3 mastra:hover:text-text6 mastra:hover:bg-surface4 mastra:transition-colors';

export const NestedWorkflowDialogCloseButton = ({ className, children, ...props }: Dialog.DialogCloseProps) => (
  <Dialog.Close className={className || NestedWorkflowDialogCloseButtonClass} aria-label="Close dialog" {...props}>
    {children}
  </Dialog.Close>
);

// Convenience component with title and close button built-in
export interface NestedWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export const NestedWorkflowDialog = ({ open, onOpenChange, title, children }: NestedWorkflowDialogProps) => {
  return (
    <NestedWorkflowDialogRoot open={open} onOpenChange={onOpenChange}>
      <NestedWorkflowDialogContent>
        <NestedWorkflowDialogHeader>
          <NestedWorkflowDialogTitle>
            <WorkflowIcon className="mastra:w-4 mastra:h-4" />
            <span>{title}</span>
          </NestedWorkflowDialogTitle>
          <NestedWorkflowDialogCloseButton>
            <X className="mastra:w-4 mastra:h-4" />
          </NestedWorkflowDialogCloseButton>
        </NestedWorkflowDialogHeader>
        <NestedWorkflowDialogBody>{children}</NestedWorkflowDialogBody>
      </NestedWorkflowDialogContent>
    </NestedWorkflowDialogRoot>
  );
};
