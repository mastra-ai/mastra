import type { BackgroundTaskEvent } from '@mastra/react/hooks/agents';
import { useCancelBackgroundTask } from '@mastra/react/hooks/agents';
import { memoryThreadMessagesQueryKey } from '@mastra/react/hooks/memory';
import { useQueryClient } from '@tanstack/react-query';
import { backgroundTaskOutputText } from './background-task-output';
import { BackgroundWorkRow } from './background-work-row';
import { StopBackgroundWorkButton } from './stop-background-work-button';
import { presentTool, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';
import { toast } from '@/lib/toast';

// The running event carries when the task started, though the stream's event type leaves it out.
const startedAtOf = (task: BackgroundTaskEvent): number | undefined => {
  const startedAt: unknown = 'startedAt' in task ? task.startedAt : undefined;
  if (typeof startedAt !== 'string' && !(startedAt instanceof Date)) return undefined;
  const time = new Date(startedAt).getTime();
  return Number.isNaN(time) ? undefined : time;
};

export function BackgroundTaskRow({ task, threadId }: { task: BackgroundTaskEvent; threadId: string }) {
  const { icon: Icon, label, detail, description } = presentTool(task.toolName, task.args);
  const queryClient = useQueryClient();
  const cancel = useCancelBackgroundTask();
  // A cancel starts no run, so nothing refreshes the chat; read the thread again so its call comes back
  // cancelled. The first key holds the chat's messages, the second the memory panel's.
  const refreshThread = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['memory', 'messages', threadId] }),
      queryClient.invalidateQueries({ queryKey: memoryThreadMessagesQueryKey(threadId) }),
    ]);
  const output = backgroundTaskOutputText(task.output);

  return (
    <BackgroundWorkRow
      icon={<Icon aria-hidden />}
      label={label}
      detail={description ?? detail}
      startedAt={startedAtOf(task)}
      stop={
        <StopBackgroundWorkButton
          action="Cancel task"
          title="Cancel this task?"
          description={`${label} stops now and its call is marked cancelled.`}
          pending={cancel.isPending}
          onConfirm={() =>
            cancel.mutate(task.taskId, {
              onSuccess: () => void refreshThread(),
              onError: error => toast.error(`Couldn't cancel the task: ${error.message}`),
            })
          }
        />
      }
    >
      {output ? (
        <ToolCallOutput text={output} />
      ) : (
        <Txt variant="caption" tone="muted">
          No output yet
        </Txt>
      )}
    </BackgroundWorkRow>
  );
}
