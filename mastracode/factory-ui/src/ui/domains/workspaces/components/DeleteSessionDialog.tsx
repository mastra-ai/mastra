import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';

import type { SessionListRow } from '../services/sessionRows';

export function DeleteSessionDialog({
  row,
  pending,
  onCancel,
  onConfirm,
}: {
  row: SessionListRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const factorySession = row.origin === 'factory';
  return (
    <Dialog open onOpenChange={open => !open && onCancel()} intent="destructive" pending={pending}>
      <DialogContent size="sm" aria-label={factorySession ? 'Delete workspace' : 'Delete user session'}>
        <DialogHeader>
          <DialogTitle>{factorySession ? 'Delete workspace?' : 'Delete session?'}</DialogTitle>
          <DialogDescription>
            {factorySession ? (
              <>
                This deletes the <span className="text-foreground">{row.session.branch}</span> checkout and its
                uncommitted changes. This can’t be undone. Threads from this workspace are kept.
              </>
            ) : (
              <>
                This deletes the <span className="text-foreground">{row.name}</span> session and its checkout with any
                uncommitted changes. This can’t be undone. Its conversation is kept.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={onConfirm}>{pending ? 'Deleting…' : 'Delete'}</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
