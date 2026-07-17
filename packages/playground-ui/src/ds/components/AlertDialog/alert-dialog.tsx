import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import * as React from 'react';

import { buttonVariants } from '@/ds/components/Button/Button';
import { asChildRenderProps } from '@/lib/as-child';
import { cn } from '@/lib/utils';

import '@/ds/components/Dialog/dialog.css';

const AlertDialogRoot = AlertDialogPrimitive.Root;

function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      {children}
    </AlertDialogRoot>
  );
}

type AlertDialogTriggerProps = AlertDialogPrimitive.Trigger.Props & {
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    return (
      <AlertDialogPrimitive.Trigger ref={ref} {...asChildRenderProps(asChild, children)} {...props}>
        {asChild ? undefined : children}
      </AlertDialogPrimitive.Trigger>
    );
  },
);
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

const AlertDialogPortal = AlertDialogPrimitive.Portal;

type AlertDialogOverlayProps = Omit<AlertDialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, AlertDialogOverlayProps>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Backdrop
    ref={ref}
    className={cn('dialog-overlay-anim fixed inset-0 z-50 bg-overlay backdrop-blur-xs', className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
};

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Popup
      ref={ref}
      data-slot="alert-dialog-content"
      className={cn(
        'dialog-content-anim',
        'fixed top-[50%] left-[50%] z-50 grid translate-[-50%]',
        'w-full max-w-[calc(100%-2rem)] sm:max-w-lg',
        'rounded-xl border border-border1/40 bg-surface2/96 shadow-dialog backdrop-blur-md',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-0.5 px-4 py-3 text-left', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-1.5 px-4 py-2.5 sm:flex-row sm:justify-end', className)} {...props} />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('max-h-[50vh] overflow-y-auto px-4 py-3.5', className)} {...props} />
);
AlertDialogBody.displayName = 'AlertDialogBody';

type AlertDialogTitleProps = Omit<AlertDialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, AlertDialogTitleProps>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn('text-ui-md font-medium', className)} {...props} />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

type AlertDialogDescriptionProps = Omit<AlertDialogPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, AlertDialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description ref={ref} className={cn('text-ui-sm text-neutral3', className)} {...props} />
  ),
);
AlertDialogDescription.displayName = 'AlertDialogDescription';

type AlertDialogActionProps = Omit<AlertDialogPrimitive.Close.Props, 'className'> & {
  className?: string;
};

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Close
      ref={ref}
      className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), className)}
      {...props}
    />
  ),
);
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Close
      ref={ref}
      className={cn(buttonVariants({ variant: 'default', size: 'lg' }), className)}
      {...props}
    />
  ),
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

AlertDialog.Trigger = AlertDialogTrigger;
AlertDialog.Portal = AlertDialogPortal;
AlertDialog.Overlay = AlertDialogOverlay;
AlertDialog.Content = AlertDialogContent;
AlertDialog.Header = AlertDialogHeader;
AlertDialog.Footer = AlertDialogFooter;
AlertDialog.Body = AlertDialogBody;
AlertDialog.Title = AlertDialogTitle;
AlertDialog.Description = AlertDialogDescription;
AlertDialog.Action = AlertDialogAction;
AlertDialog.Cancel = AlertDialogCancel;

export { AlertDialog };
