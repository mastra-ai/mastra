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
  isGenerateMode?: boolean;
}

function useToolApproval(request: ToolApprovalRequest) {
  const { toolCallId, toolApprovalMetadata, toolName, isGenerateMode } = request;
  const toolCall = useOptionalToolCall();
  if (!toolCall) return undefined;

  const {
    approveToolcall,
    declineToolcall,
    approveToolcallGenerate,
    declineToolcallGenerate,
    isRunning,
    toolCallApprovals,
  } = toolCall;

  const handleApprove = () => {
    if (isGenerateMode) {
      approveToolcallGenerate(toolCallId);
    } else {
      approveToolcall(toolCallId);
    }
  };

  const handleDecline = () => {
    if (isGenerateMode) {
      declineToolcallGenerate(toolCallId);
    } else {
      declineToolcall(toolCallId);
    }
  };

  const status = toolCallApprovals?.[toolCallId]?.status;

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
