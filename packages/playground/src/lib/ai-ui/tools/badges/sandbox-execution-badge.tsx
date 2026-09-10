import { SandboxExecutionMessage } from '@mastra/playground-ui/domains/chat';
import type { SandboxExecutionMessageProps } from '@mastra/playground-ui/domains/chat';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useToolApprovalActions } from './use-tool-approval-actions';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useLinkComponent } from '@/lib/framework';

export interface SandboxExecutionBadgeProps
  extends
    Omit<
      SandboxExecutionMessageProps,
      'isRunning' | 'status' | 'onApprove' | 'onDecline' | 'approvalRequired' | 'onNavigate'
    >,
    Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  metadata?: MessageMetadata;
}

export const SandboxExecutionBadge = ({
  toolApprovalMetadata,
  isNetwork,
  metadata,
  ...props
}: SandboxExecutionBadgeProps) => {
  const approval = useToolApprovalActions({
    toolCallId: props.toolCallId,
    toolName: props.toolName,
    toolCalled: !!props.toolCalled,
    toolApprovalMetadata,
    isNetwork,
    isGenerateMode: metadata?.mode === 'generate',
  });
  const { navigate } = useLinkComponent();
  return (
    <SandboxExecutionMessage {...props} {...approval} approvalRequired={!!toolApprovalMetadata} onNavigate={navigate} />
  );
};
