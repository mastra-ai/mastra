import { TaskList } from '@mastra/playground-ui/components/ai/task-list';

import { useChatTranscript } from '../context/useChatTranscript';

export function TaskPanel() {
  const { tasks } = useChatTranscript();
  const hasVisibleTasks = tasks.some(task => task.status !== 'completed');

  if (!hasVisibleTasks) return null;

  return (
    <div className="w-full px-3 md:px-5" role="region" aria-label="Current tasks" data-testid="task-panel">
      <div className="mx-auto w-full max-w-[80ch]">
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
}
