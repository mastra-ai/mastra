import { Button, Icon } from '@mastra/playground-ui';
import { Loader2, StopCircle } from 'lucide-react';

export interface WorkflowCancelButtonProps {
  status?: string;
  cancelMessage: string | null;
  isCancelling: boolean;
  onCancel: () => void;
  disabled?: boolean;
}

const DONE_STATUSES = ['success', 'failed', 'canceled', 'tripwire'];
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

  return (
    <Button
      type="button"
      variant="default"
      className="w-full"
      onClick={onCancel}
      disabled={disabled || !!cancelMessage || isCancelling || DONE_STATUSES.includes(status)}
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
