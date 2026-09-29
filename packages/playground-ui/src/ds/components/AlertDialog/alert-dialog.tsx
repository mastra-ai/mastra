import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import {
  DialogBody,
  DialogCancel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { dialogActionLayoutClasses, dialogActionSizeClasses } from '@/ds/components/Dialog/dialog-context';
import {
  dialogContentSizeClasses,
  dialogOverlayClassName,
  dialogPopupClassName,
} from '@/ds/components/Dialog/dialog-shell';
import type { DialogSize } from '@/ds/components/Dialog/dialog-shell';
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
  <AlertDialogPrimitive.Backdrop ref={ref} className={cn(dialogOverlayClassName, className)} {...props} />
));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  size?: DialogSize;
};

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, size = 'sm', ...props }, ref) => (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        ref={ref}
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(dialogPopupClassName, dialogContentSizeClasses[size], className)}
        {...props}
      />
    </AlertDialogPortal>
  ),
);
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <DialogHeader className={cn('pr-5', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogPrimitive.Close.Props>(
  ({ children, ...props }, ref) => (
    <AlertDialogPrimitive.Close
      ref={ref}
      render={
        <Button
          variant="primary"
          size="md"
          className={cn(dialogActionLayoutClasses, dialogActionSizeClasses.md)}
          children={children}
        />
      }
      {...props}
    />
  ),
);
AlertDialogAction.displayName = 'AlertDialogAction';

AlertDialog.Trigger = AlertDialogTrigger;
AlertDialog.Portal = AlertDialogPortal;
AlertDialog.Overlay = AlertDialogOverlay;
AlertDialog.Content = AlertDialogContent;
AlertDialog.Header = AlertDialogHeader;
AlertDialog.Footer = DialogFooter;
AlertDialog.Body = DialogBody;
AlertDialog.Title = DialogTitle;
AlertDialog.Description = DialogDescription;
AlertDialog.Action = AlertDialogAction;
AlertDialog.Cancel = DialogCancel;

export { AlertDialog };
