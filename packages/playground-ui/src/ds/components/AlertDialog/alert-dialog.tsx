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

function AlertDialogTrigger({ asChild, children, ...props }: AlertDialogTriggerProps) {
  return (
    <AlertDialogPrimitive.Trigger {...asChildRenderProps(asChild, children)} {...props}>
      {asChild ? undefined : children}
    </AlertDialogPrimitive.Trigger>
  );
}

const AlertDialogPortal = AlertDialogPrimitive.Portal;

type AlertDialogOverlayProps = Omit<AlertDialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

function AlertDialogOverlay({ className, ...props }: AlertDialogOverlayProps) {
  return <AlertDialogPrimitive.Backdrop className={cn(dialogOverlayClassName, className)} {...props} />;
}

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  size?: DialogSize;
};

function AlertDialogContent({ className, size = 'sm', ...props }: AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(dialogPopupClassName, dialogContentSizeClasses[size], className)}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogAction({ children, ...props }: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
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
  );
}

AlertDialog.Trigger = AlertDialogTrigger;
AlertDialog.Portal = AlertDialogPortal;
AlertDialog.Overlay = AlertDialogOverlay;
AlertDialog.Content = AlertDialogContent;
AlertDialog.Header = DialogHeader;
AlertDialog.Footer = DialogFooter;
AlertDialog.Body = DialogBody;
AlertDialog.Title = DialogTitle;
AlertDialog.Description = DialogDescription;
AlertDialog.Action = AlertDialogAction;
AlertDialog.Cancel = DialogCancel;

export { AlertDialog };
