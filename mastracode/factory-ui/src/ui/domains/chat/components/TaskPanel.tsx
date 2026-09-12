import { TaskList } from '@mastra/playground-ui/components/ai/task-list';

import { useChatConnection } from '../context/useChatConnection';

export function TaskPanel() {
  const { state } = useChatConnection();
  const tasks = state?.tasks;

  if (!tasks?.some(task => task.status !== 'completed')) return null;

  return (
    <div role="region" aria-label="Current tasks" data-testid="task-panel">
      <TaskList tasks={tasks} />
    </div>
  );
}
