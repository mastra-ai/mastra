import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { useToolCall } from '@/services/tool-call-provider';
import { Check, X } from 'lucide-react';

export interface ToolApprovalButtonsProps {
  toolCallId: string;
  toolName: string;
  toolCalled: boolean;
  toolApprovalMetadata:
    | {
        toolCallId: string;
        toolName: string;
        args: Record<string, any>;
        runId?: string;
      }
    | undefined;
  isNetwork: boolean;
}

export const ToolApprovalButtons = ({
  toolCalled,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  isNetwork,
}: ToolApprovalButtonsProps) => {
  const {
    approveToolcall,
    declineToolcall,
    isRunning,
    toolCallApprovals,
    approveNetworkToolcall,
    declineNetworkToolcall,
    networkToolCallApprovals,
  } = useToolCall();

  const handleApprove = () => {
    if (isNetwork) {
      approveNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else {
      approveToolcall(toolCallId);
    }
  };

  const handleDecline = () => {
    if (isNetwork) {
      declineNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else {
      declineToolcall(toolCallId);
    }
  };

  const toolCallApprovalStatus = isNetwork
    ? networkToolCallApprovals?.[toolName]?.status
    : toolCallApprovals?.[toolCallId]?.status;

  if (toolApprovalMetadata && !toolCalled) {
    return (
      <div>
        <p className="font-medium pb-2">Approval required</p>
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleApprove}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'approved' ? '!text-accent1' : ''}
          >
            <Icon>
              <Check />
            </Icon>
            Approve
          </Button>
          <Button
            onClick={handleDecline}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'declined' ? '!text-accent2' : ''}
          >
            <Icon>
              <X />
            </Icon>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
