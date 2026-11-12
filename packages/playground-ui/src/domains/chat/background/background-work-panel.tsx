import { useContext } from 'react';
import { BackgroundProcessRows } from './background-process-rows';
import { BackgroundTaskRows } from './background-task-rows';
import { exitFor, threadBackgroundWork } from './thread-background-work';
import { ChatAgentContext, useChatMessages } from '@/domains/chat/context/chat-context';
import { TaskListContainer } from '@/ds/components/ai/task-list';

/**
 * The thread's running background work, docked above the composer: tasks deferred by the agent and
 * processes it started with `execute_command`. Nothing is read until a call in the thread started such
 * work, and the panel stays hidden while nothing runs.
 */
export function BackgroundWorkPanel() {
  const messages = useChatMessages();
  const threadId = useContext(ChatAgentContext)?.threadId;
  if (!threadId) return null;

  const work = threadBackgroundWork(messages);
  const workspaceIds = new Set(
    work.commands.flatMap(command =>
      command.workspaceId && !exitFor(work.exits, command) ? [command.workspaceId] : [],
    ),
  );
  if (!work.hasDeferredCalls && workspaceIds.size === 0) return null;

  return (
    // Shown only once a row lands: the rows read their own sources.
    <TaskListContainer
      aria-label="Background work"
      data-testid="background-work-panel"
      className="hidden has-[li]:block"
    >
      <ul className="flex flex-col px-1.5 py-1">
        {work.hasDeferredCalls && <BackgroundTaskRows threadId={threadId} />}
        {[...workspaceIds].map(workspaceId => (
          <BackgroundProcessRows key={workspaceId} workspaceId={workspaceId} threadId={threadId} />
        ))}
      </ul>
    </TaskListContainer>
  );
}
