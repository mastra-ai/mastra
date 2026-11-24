import type * as React from 'react';

import { Button } from '@/ds/components/Button';
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
} from '@/ds/components/Dialog';
import type { DialogProps } from '@/ds/components/Dialog';
import { dialogActionLayoutClasses, dialogActionSizeClasses } from '@/ds/components/Dialog/dialog-context';
import { cn } from '@/lib/utils';

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
