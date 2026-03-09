import { Loader2, StopCircle } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';

export interface WorkflowCancelButtonProps {
  status?: string;
  cancelMessage: string | null;
  isCancelling: boolean;
  onCancel: () => void;
}

const DONE_STATUSES = ['success', 'failed', 'canceled', 'tripwire'];

export function WorkflowCancelButton({ status, cancelMessage, isCancelling, onCancel }: WorkflowCancelButtonProps) {
  if (status !== 'running') {
    return null;
  }

  return (
    <Button
      variant="light"
      className="w-full"
      onClick={onCancel}
      disabled={!!cancelMessage || isCancelling || (status && DONE_STATUSES.includes(status))}
    >
      {isCancelling ? (
        <Icon>
          <Loader2 className="animate-spin" />
        </Icon>
      ) : (
        <Icon>
          <StopCircle />
        </Icon>
      )}
      {cancelMessage || 'Cancel Workflow Run'}
    </Button>
  );
}
