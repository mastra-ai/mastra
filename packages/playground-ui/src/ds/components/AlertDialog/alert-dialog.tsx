import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';

import { Button } from '@/ds/components/Button';
import {
  DialogBody,
  DialogCancel,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/ds/components/Dialog';
import {
  DialogContext,
  dialogActionLayoutClasses,
  dialogActionSizeClasses,
} from '@/ds/components/Dialog/dialog-context';
import type { DialogContextValue } from '@/ds/components/Dialog/dialog-context';
import { dialogContentSizeClasses, dialogPopupClassName } from '@/ds/components/Dialog/dialog-shell';
import type { DialogSize } from '@/ds/components/Dialog/dialog-shell';
import { cn } from '@/lib/utils';

const alertDialogContext: DialogContextValue = { intent: 'default', pending: false };

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return (
    <DialogContext.Provider value={alertDialogContext}>
      <AlertDialogPrimitive.Root {...props} />
    </DialogContext.Provider>
  );
}

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  size?: DialogSize;
};

function AlertDialogContent({ className, size = 'sm', ...props }: AlertDialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(dialogPopupClassName, dialogContentSizeClasses[size], className)}
        {...props}
      />
    </DialogPortal>
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

AlertDialog.Trigger = AlertDialogPrimitive.Trigger;
AlertDialog.Content = AlertDialogContent;
AlertDialog.Header = DialogHeader;
AlertDialog.Footer = DialogFooter;
AlertDialog.Body = DialogBody;
AlertDialog.Title = DialogTitle;
AlertDialog.Description = DialogDescription;
AlertDialog.Action = AlertDialogAction;
AlertDialog.Cancel = DialogCancel;

export { AlertDialog };
