import { Check, X } from 'lucide-react';
import { SectionLabel } from '../../components/section-label';
import { useToolCall } from '../../context/tool-call-context';
import { Button } from '@/ds/components/Button';

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

  // The approval entry names the tool call the server suspended on, which is the only id a resume
  // accepts. For a sub-agent delegation that is the outer `agent-*` call, while this card renders
  // the child's inner call — submitting the inner id fails with "could not find suspended run".
  const approvalToolCallId = toolApprovalMetadata?.toolCallId ?? toolCallId;

  const handleApprove = () => {
    if (isNetwork) {
      approveNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else if (isGenerateMode) {
      approveToolcallGenerate(approvalToolCallId);
    } else {
      approveToolcall(approvalToolCallId);
    }
  };

  const handleDecline = () => {
    if (isNetwork) {
      declineNetworkToolcall(toolName, toolApprovalMetadata?.runId);
    } else if (isGenerateMode) {
      declineToolcallGenerate(approvalToolCallId);
    } else {
      declineToolcall(approvalToolCallId);
    }
  };

  const toolCallApprovalStatus = isNetwork
    ? networkToolCallApprovals?.[toolApprovalMetadata?.runId ? `${toolApprovalMetadata.runId}-${toolName}` : toolName]
        ?.status
    : toolCallApprovals?.[approvalToolCallId]?.status;

  if (toolApprovalMetadata && !toolCalled) {
    return (
      <div>
        <SectionLabel>Approval required</SectionLabel>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleApprove}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'approved' ? 'text-accent1!' : ''}
            icon={<Check />}
          >
            Approve
          </Button>
          <Button
            onClick={handleDecline}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'declined' ? 'text-accent2!' : ''}
            icon={<X />}
          >
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
