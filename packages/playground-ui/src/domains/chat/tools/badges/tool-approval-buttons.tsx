import { BadgeWrapper } from '../../components/badge-wrapper';
import type { BadgeWrapperProps } from '../../components/badge-wrapper';
import { useToolCall } from '../../context/tool-call-context';
import { awaitsToolApproval } from './awaits-tool-approval';
import { ToolApproval } from '@/ds/components/ai/tool-approval';
import type { ToolApprovalProps } from '@/ds/components/ai/tool-approval';

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

function useToolApproval({
  toolCalled,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  isNetwork,
  isGenerateMode,
}: ToolApprovalButtonsProps): ToolApprovalProps | undefined {
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

  if (!awaitsToolApproval({ toolApprovalMetadata, toolCalled }) && !toolCallApprovalStatus) return undefined;

  return {
    onApprove: handleApprove,
    onDecline: handleDecline,
    disabled: isRunning,
    status: toolCallApprovalStatus,
    toolName,
  };
}

/** Studio adapter: owns dispatch and keeps pending decisions visible in every tool activity. */
type ToolApprovalBadgeProps = BadgeWrapperProps & { approval: ToolApprovalButtonsProps };

export function ToolApprovalBadge({ approval, ...props }: ToolApprovalBadgeProps) {
  if (!approval.toolApprovalMetadata) return <BadgeWrapper {...props} />;
  return <RequestedToolApprovalBadge approval={approval} {...props} />;
}

function RequestedToolApprovalBadge({ approval: request, children, ...props }: ToolApprovalBadgeProps) {
  const approval = useToolApproval(request);
  const pending = Boolean(approval && !approval.status);
  return (
    <BadgeWrapper
      {...props}
      collapsible={pending ? false : props.collapsible}
      badges={approval && <ToolApproval.Status status={approval.status} />}
    >
      {pending && approval ? (
        <>
          {children}
          <ToolApproval {...approval} variant="inline" showStatus={false} />
        </>
      ) : (
        children
      )}
    </BadgeWrapper>
  );
}

/** @deprecated Use ToolApprovalBadge to keep status in the header and pending requests expanded. */
export function ToolApprovalButtons(props: ToolApprovalButtonsProps) {
  const approval = useToolApproval(props);
  if (!awaitsToolApproval(props) || !approval) return null;
  return <ToolApproval {...approval} variant="inline" />;
}
