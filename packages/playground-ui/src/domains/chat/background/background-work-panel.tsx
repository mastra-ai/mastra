import { BackgroundProcessRows } from './background-process-rows';
import { BackgroundTaskRows } from './background-task-rows';
import { exitFor } from './thread-background-work';
import { useChatBackgroundWork } from './use-chat-background-work';
import { useChatThreadId } from '@/domains/chat/context/chat-context';
import { TaskListContainer } from '@/ds/components/ai/task-list';

/**
 * The thread's running background work, docked above the composer: tasks deferred by the agent and
 * processes it started with `execute_command`. Nothing is read until a call in the thread started such
 * work, and the panel stays hidden while nothing runs.
 */
export function BackgroundWorkPanel() {
  const work = useChatBackgroundWork();
  const threadId = useChatThreadId();
  if (!work || !threadId) return null;

  const workspaceIds = new Set(
    work.commands.flatMap(command => (command.workspaceId && !exitFor(work, command) ? [command.workspaceId] : [])),
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
        {/* Keyed so a thread switch drops the previous thread's tasks with its stream. */}
        {work.hasDeferredCalls && <BackgroundTaskRows key={threadId} threadId={threadId} />}
        {[...workspaceIds].map(workspaceId => (
          <BackgroundProcessRows key={workspaceId} workspaceId={workspaceId} threadId={threadId} />
        ))}
      </ul>
    </TaskListContainer>
  );
}
