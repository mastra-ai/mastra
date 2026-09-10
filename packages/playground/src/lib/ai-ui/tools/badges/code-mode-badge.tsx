import { CodeModeMessage } from '@mastra/playground-ui/domains/chat';
import type { CodeModeMessageProps } from '@mastra/playground-ui/domains/chat';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useToolApprovalActions } from './use-tool-approval-actions';
import { useTraceHighlight } from '@/domains/traces/components/trace-highlight-context';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export type { CodeModeResult } from '@mastra/playground-ui/domains/chat';

export interface CodeModeBadgeProps
  extends
    Omit<CodeModeMessageProps, 'isRunning' | 'status' | 'onApprove' | 'onDecline' | 'approvalRequired'>,
    Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  metadata?: MessageMetadata;
}

export const CodeModeBadge = ({ toolApprovalMetadata, isNetwork, metadata, ...props }: CodeModeBadgeProps) => {
  const approval = useToolApprovalActions({
    toolCallId: props.toolCallId,
    toolName: props.toolName,
    toolCalled: !!props.toolCalled,
    toolApprovalMetadata,
    isNetwork,
    isGenerateMode: metadata?.mode === 'generate',
  });
  const { onToolOpen } = useTraceHighlight();
  return <CodeModeMessage {...props} {...approval} approvalRequired={!!toolApprovalMetadata} onToolOpen={onToolOpen} />;
};
