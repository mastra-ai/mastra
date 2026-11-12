import { useBackgroundTaskStream } from '@mastra/react/hooks/agents';
import { BackgroundTaskRow } from './background-task-row';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

/** The thread's running background tasks, followed over the task stream (its first events replay what runs). */
export function BackgroundTaskRows({ threadId }: { threadId: string }) {
  const { runningTasks, error, reconnect } = useBackgroundTaskStream({ threadId });
  return (
    <>
      {runningTasks.map(task => (
        <BackgroundTaskRow key={task.taskId} task={task} threadId={threadId} />
      ))}
      {/* The stream doesn't reconnect by itself, and without it the tasks can't be seen or cancelled. */}
      {error && (
        <li className="flex items-center justify-between gap-2 px-1.5 py-1">
          <Txt as="span" variant="caption" tone="muted">
            Couldn't follow background tasks
          </Txt>
          <Button variant="ghost" size="sm" onClick={reconnect}>
            Retry
          </Button>
        </li>
      )}
    </>
  );
}
