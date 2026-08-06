import { TaskList } from '@mastra/playground-ui/components/ai/task-list';

import { useChatTranscript } from '../context/useChatTranscript';

export function TaskPanel() {
  const { transcript } = useChatTranscript();
  const hasVisibleTasks = transcript.tasks.some(task => task.status !== 'completed');

  if (!hasVisibleTasks) return null;

  return (
    <div role="region" aria-label="Current tasks" data-testid="task-panel">
      <TaskList tasks={transcript.tasks} />
    </div>
  );
}
