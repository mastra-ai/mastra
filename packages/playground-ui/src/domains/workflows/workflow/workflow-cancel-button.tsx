import { Loader2, Square } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export interface WorkflowCancelButtonProps {
  status?: string;
  cancelMessage: string | null;
  isCancelling: boolean;
  onCancel: () => void;
  disabled?: boolean;
}

const VISIBLE_STATUSES = ['running', 'suspended', 'paused'];

export function WorkflowCancelButton({
  status,
  cancelMessage,
  isCancelling,
  onCancel,
  disabled,
}: WorkflowCancelButtonProps) {
  if (!status || !VISIBLE_STATUSES.includes(status)) {
    return null;
  }

  const label = isCancelling ? 'Cancelling run…' : cancelMessage || 'Cancel workflow run';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-md"
      tooltip={label}
      onClick={onCancel}
      disabled={disabled || !!cancelMessage || isCancelling}
    >
      {isCancelling ? <Loader2 className="motion-safe:animate-spin" /> : <Square />}
    </Button>
  );
}
