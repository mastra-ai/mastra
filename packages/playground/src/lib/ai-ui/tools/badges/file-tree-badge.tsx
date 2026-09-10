import { FileTreeMessage } from '@mastra/playground-ui/domains/chat';
import type { FileTreeMessageProps } from '@mastra/playground-ui/domains/chat';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useToolApprovalActions } from './use-tool-approval-actions';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useLinkComponent } from '@/lib/framework';

export interface FileTreeBadgeProps
  extends
    Omit<FileTreeMessageProps, 'isRunning' | 'status' | 'onApprove' | 'onDecline' | 'approvalRequired' | 'onNavigate'>,
    Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  metadata?: MessageMetadata;
}

export const FileTreeBadge = ({ toolApprovalMetadata, isNetwork, metadata, ...props }: FileTreeBadgeProps) => {
  const approval = useToolApprovalActions({
    toolCallId: props.toolCallId,
    toolName: props.toolName,
    toolCalled: !!props.toolCalled,
    toolApprovalMetadata,
    isNetwork,
  });
  const { navigate } = useLinkComponent();
  return <FileTreeMessage {...props} {...approval} approvalRequired={!!toolApprovalMetadata} onNavigate={navigate} />;
};
