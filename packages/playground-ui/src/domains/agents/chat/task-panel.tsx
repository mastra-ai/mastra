import { useChatTasks } from '@/domains/chat/context/chat-context';
import { TaskList } from '@/ds/components/ai/task-list';

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
