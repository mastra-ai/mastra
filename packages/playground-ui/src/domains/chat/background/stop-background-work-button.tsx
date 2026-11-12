import { Square } from 'lucide-react';
import { useState } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';

export interface StopBackgroundWorkButtonProps {
  /** The verb on the button, its tooltip and the confirm action, e.g. "Kill process". */
  action: string;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
}

/** Stops running background work once the reader confirms: the work can't be resumed. */
export function StopBackgroundWorkButton({
  action,
  title,
  description,
  pending,
  onConfirm,
}: StopBackgroundWorkButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip={action}
        aria-label={action}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <Square />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description>{description}</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep running</AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm}>{action}</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
