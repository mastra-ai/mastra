import { SectionLabel } from '../../components/section-label';
import { useToolCall } from '../../context/tool-call-context';
import { ToolApprovalActions } from '@/ds/components/ai/tool-approval';

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
        <SectionLabel>Approval required</SectionLabel>
        <ToolApprovalActions
          onApprove={handleApprove}
          onDecline={handleDecline}
          disabled={isRunning}
          status={toolCallApprovalStatus}
          toolName={toolName}
        />
      </div>
    );
  }

  return null;
};
