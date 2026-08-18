import { Button } from '@mastra/playground-ui/components/Button';
import { Check, X } from 'lucide-react';
import { useToolCall } from '@/services/tool-call-provider';

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
  isGenerateMode?: boolean;
}

export const ToolApprovalButtons = ({
  toolCalled,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  isNetwork,
  isGenerateMode,
}: ToolApprovalButtonsProps) => {
  const {
    approveToolcall,
    declineToolcall,
    approveToolcallGenerate,
    declineToolcallGenerate,
    isRunning,
    toolCallApprovals,
    approveNetworkToolcall,
    declineNetworkToolcall,
    networkToolCallApprovals,
  } = useToolCall();

  const handleApprove = () => {
    if (isNetwork) {
      approveNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else if (isGenerateMode) {
      approveToolcallGenerate(toolCallId);
    } else {
      approveToolcall(toolCallId);
    }
  };

  const handleDecline = () => {
    if (isNetwork) {
      declineNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else if (isGenerateMode) {
      declineToolcallGenerate(toolCallId);
    } else {
      declineToolcall(toolCallId);
    }
  };

  const toolCallApprovalStatus = isNetwork
    ? networkToolCallApprovals?.[toolApprovalMetadata?.runId ? `${toolApprovalMetadata.runId}-${toolName}` : toolName]
        ?.status
    : toolCallApprovals?.[toolCallId]?.status;

  if (toolApprovalMetadata && !toolCalled) {
    return (
      <div>
        <p className="text-ui-xs text-neutral3 mb-1.5">Approval is required to continue.</p>
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            onClick={handleApprove}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'approved' ? 'text-accent1!' : ''}
          >
            <Check />
            Approve
          </Button>
          <Button
            size="xs"
            onClick={handleDecline}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'declined' ? 'text-accent2!' : ''}
          >
            <X />
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
