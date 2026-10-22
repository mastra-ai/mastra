import type * as React from 'react';

import { cn } from '../../../lib/utils';
import { Button } from '../Button';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../Dialog';
import type { DialogProps } from '../Dialog';
import { dialogActionLayoutClasses, dialogActionSizeClasses } from '../Dialog/dialog-context';

type AlertDialogProps = Omit<DialogProps, 'intent' | 'pending' | 'modal' | 'disablePointerDismissal'>;

// base-ui's AlertDialog is its Dialog with these three settings, so it shares Dialog's phone drawer.
function AlertDialog(props: AlertDialogProps) {
  return <Dialog {...props} modal disablePointerDismissal />;
}

type AlertDialogContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  'showCloseButton' | 'showOverlay' | 'overlayClassName' | 'role'
>;

function AlertDialogContent({ size = 'sm', ...props }: AlertDialogContentProps) {
  return (
    <DialogContent data-slot="alert-dialog-content" size={size} showCloseButton={false} {...props} role="alertdialog" />
  );
}

function AlertDialogAction({ children, ...props }: React.ComponentProps<typeof DialogClose>) {
  return (
    <DialogClose
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

AlertDialog.Trigger = DialogTrigger;
AlertDialog.Content = AlertDialogContent;
AlertDialog.Header = DialogHeader;
AlertDialog.Footer = DialogFooter;
AlertDialog.Body = DialogBody;
AlertDialog.Title = DialogTitle;
AlertDialog.Description = DialogDescription;
AlertDialog.Action = AlertDialogAction;
AlertDialog.Cancel = DialogCancel;

export { AlertDialog };
