import { useBackgroundTaskStream } from '@mastra/react/hooks/agents';
import { BackgroundTaskRow } from './background-task-row';

/** The thread's running background tasks, followed over the task stream (its first events replay what runs). */
export function BackgroundTaskRows({ threadId }: { threadId: string }) {
  const { runningTasks } = useBackgroundTaskStream({ threadId });
  return runningTasks.map(task => <BackgroundTaskRow key={task.taskId} task={task} />);
}
