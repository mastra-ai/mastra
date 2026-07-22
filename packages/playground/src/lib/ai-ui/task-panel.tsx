import { TaskList } from '@mastra/playground-ui/components/ai/task-list';
import { useChatTasks } from './chat/chat-context';

export const TaskPanel = () => {
  const tasks = useChatTasks();
  const hasVisibleTasks = tasks.length > 0 && tasks.some(task => task.status !== 'completed');

  if (!hasVisibleTasks) return null;

  return (
    <div className="px-2 pb-1" data-testid="task-panel">
      <div className="mx-auto w-full max-w-3xl">
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
};
