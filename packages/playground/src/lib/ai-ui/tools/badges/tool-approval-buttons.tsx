import { ToolApprovalControls } from '@mastra/playground-ui/domains/chat';
import { useToolApprovalActions } from './use-tool-approval-actions';

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

export const ToolApprovalButtons = (props: ToolApprovalButtonsProps) => {
  const approval = useToolApprovalActions(props);
  if (props.toolApprovalMetadata && !props.toolCalled) {
    return <ToolApprovalControls {...approval} />;
  }
  return null;
};
