import { ToolMessage } from '@mastra/playground-ui/domains/chat';
import type { ToolMessageProps } from '@mastra/playground-ui/domains/chat';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useToolApprovalActions } from './use-tool-approval-actions';
import { useGetBackgroundTaskById, useBackgroundTaskStream } from '@/hooks';

export interface ToolBadgeProps
  extends
    Omit<ToolMessageProps, 'isRunning' | 'approvalRequired' | 'status' | 'toolStatus' | 'onApprove' | 'onDecline'>,
    Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  status?: ToolMessageProps['toolStatus'];
}

function BackgroundToolMessage({
  backgroundTask,
  ...props
}: ToolMessageProps & {
  backgroundTask: { taskId: string; completedAt?: Date; suspendedAt?: Date };
}) {
  const { data: task } = useGetBackgroundTaskById(
    backgroundTask.taskId,
    !!backgroundTask.completedAt || !!backgroundTask.suspendedAt,
  );
  const { tasks } = useBackgroundTaskStream({
    taskId: backgroundTask.taskId,
    enabled: !backgroundTask.completedAt && !backgroundTask.suspendedAt,
  });
  return <ToolMessage {...props} backgroundTaskDetails={task || tasks[backgroundTask.taskId]} />;
}

export const ToolBadge = ({ toolApprovalMetadata, isNetwork, status, ...props }: ToolBadgeProps) => {
  const approval = useToolApprovalActions({
    toolCallId: props.toolCallId,
    toolName: props.toolName,
    toolCalled: !!props.toolCalled,
    toolApprovalMetadata,
    isNetwork,
    isGenerateMode: props.metadata?.mode === 'generate',
  });
  const backgroundTask =
    props.metadata?.mode === 'stream' || props.metadata?.mode === 'generate'
      ? props.metadata.backgroundTasks?.[props.toolCallId]
      : undefined;
  const messageProps: ToolMessageProps = {
    ...props,
    ...approval,
    toolStatus: status,
    approvalRequired: !!toolApprovalMetadata,
  };
  if (backgroundTask?.taskId && backgroundTask.startedAt) {
    return <BackgroundToolMessage {...messageProps} backgroundTask={backgroundTask} />;
  }
  return <ToolMessage {...messageProps} />;
};
