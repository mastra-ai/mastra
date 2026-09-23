import { TaskList } from '@mastra/playground-ui/components/ai/task-list';
import { useChatTasks } from '@mastra/playground-ui/domains/chat/context/chat-context';

export const TaskPanel = () => {
  const tasks = useChatTasks();
  const hasVisibleTasks = tasks.length > 0 && tasks.some(task => task.status !== 'completed');

  if (!hasVisibleTasks) return null;

  return (
    <div data-testid="task-panel">
      <TaskList tasks={tasks} />
    </div>
  );
};
