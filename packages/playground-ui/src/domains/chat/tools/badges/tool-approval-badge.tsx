import { BadgeWrapper } from '../../components/badge-wrapper';
import type { BadgeWrapperProps } from '../../components/badge-wrapper';
import { useOptionalToolCall } from '../../context/tool-call-context';
import { awaitsToolApproval } from './awaits-tool-approval';
import { ToolApprovalActions, ToolApprovalStatus } from '@/ds/components/ai/tool-approval';

export interface ToolApprovalRequest {
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

function useToolApproval(request: ToolApprovalRequest) {
  const { toolCallId, toolApprovalMetadata, toolName, isNetwork, isGenerateMode } = request;
  const toolCall = useOptionalToolCall();
  if (!toolCall) return undefined;

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
  } = toolCall;

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

  const status = isNetwork
    ? networkToolCallApprovals?.[toolApprovalMetadata?.runId ? `${toolApprovalMetadata.runId}-${toolName}` : toolName]
        ?.status
    : toolCallApprovals?.[toolCallId]?.status;

  if (!awaitsToolApproval(request) && !status) return undefined;

  return {
    status,
    actions: { onApprove: handleApprove, onDecline: handleDecline, disabled: isRunning, toolName },
  };
}

type ToolApprovalBadgeProps = BadgeWrapperProps & { approval: ToolApprovalRequest };

export function ToolApprovalBadge({ approval: request, children, collapsible, ...props }: ToolApprovalBadgeProps) {
  const approval = useToolApproval(request);
  const pendingActions = approval && !approval.status ? approval.actions : undefined;

  return (
    <BadgeWrapper
      {...props}
      collapsible={pendingActions ? false : collapsible}
      badges={approval && <ToolApprovalStatus status={approval.status} />}
    >
      {pendingActions ? (
        <>
          {children}
          <ToolApprovalActions {...pendingActions} />
        </>
      ) : (
        children
      )}
    </BadgeWrapper>
  );
}
