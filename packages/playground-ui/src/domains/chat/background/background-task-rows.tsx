import { useBackgroundTaskStream } from '@mastra/react/hooks/agents';
import { BackgroundTaskRow } from './background-task-row';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

function streamProblem({ failed, dropped }: { failed: boolean; dropped: boolean }): string | undefined {
  if (failed) return "Couldn't follow background tasks";
  if (dropped) return 'Stopped following background tasks';
  return undefined;
}

/** The thread's running background tasks, followed over the task stream (its first events replay what runs). */
export function BackgroundTaskRows({ threadId }: { threadId: string }) {
  const { tasks, runningTasks, error, isConnected, reconnect } = useBackgroundTaskStream({ threadId });
  // A stream that delivered tasks and then closed (a server restart, say) reports no error, and the
  // rows it left would read as running for good.
  const dropped = !isConnected && Object.keys(tasks).length > 0;
  const problem = streamProblem({ failed: Boolean(error), dropped });

  return (
    <>
      {runningTasks.map(task => (
        <BackgroundTaskRow key={task.taskId} task={task} />
      ))}
      {/* The stream doesn't reconnect by itself, and without it the tasks can't be seen. */}
      {problem && (
        <li className="flex items-center justify-between gap-2 px-1.5 py-1">
          <Txt as="span" variant="caption" tone="muted">
            {problem}
          </Txt>
          <Button variant="ghost" size="sm" onClick={reconnect}>
            Retry
          </Button>
        </li>
      )}
    </>
  );
}
