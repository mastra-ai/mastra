import { TaskList } from '@mastra/playground-ui/components/ai/task-list';

import { useChatTranscript } from '../context/useChatTranscript';

export function TaskPanel() {
  const { transcript } = useChatTranscript();
  const hasVisibleTasks = transcript.tasks.some(task => task.status !== 'completed');

  if (!hasVisibleTasks) return null;

  return (
    <div
      className="w-full px-3 transition-[padding-right] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)] md:px-5 lg:in-data-[panel-open=true]:pr-[calc(var(--chat-right-panel-width)+0.5rem)] motion-reduce:transition-none in-data-[panel-gesture=active]:transition-none"
      role="region"
      aria-label="Current tasks"
      data-testid="task-panel"
    >
      <div className="mx-auto w-full max-w-[80ch]">
        <TaskList tasks={transcript.tasks} />
      </div>
    </div>
  );
}
