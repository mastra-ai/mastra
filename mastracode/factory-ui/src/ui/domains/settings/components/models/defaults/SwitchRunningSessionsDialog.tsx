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
import { formatModelName } from '@mastra/playground-ui/utils/model';

export function SwitchRunningSessionsDialog({
  modelId,
  pending,
  onConfirm,
  onClose,
}: {
  modelId: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Also switch running sessions to {formatModelName(modelId)}?</DialogTitle>
          <DialogDescription>
            New activity using the Factory defaults will use this model. Running work and review sessions keep their
            current model unless you switch them. Switched sessions keep their work and pick up the new model on their
            next step.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogCancel>Keep them as-is</DialogCancel>
          <DialogAction onConfirm={onConfirm}>{pending ? 'Switching…' : 'Switch running sessions'}</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
