import { BackgroundProcessRow } from './background-process-row';
import { useThreadSandboxProcesses } from './use-thread-sandbox-processes';

/** The thread's running background processes in one workspace's sandbox. */
export function BackgroundProcessRows({ workspaceId, threadId }: { workspaceId: string; threadId: string }) {
  const { data } = useThreadSandboxProcesses({ workspaceId, threadId });
  return (data?.processes ?? [])
    .filter(process => process.running)
    .map(process => (
      <BackgroundProcessRow key={process.pid} workspaceId={workspaceId} threadId={threadId} process={process} />
    ));
}
