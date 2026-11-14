import { useSandboxProcess } from '@mastra/react/hooks/workspace';
import { pollWhileRunning } from './background-polling';

/** Lines of output a process row shows, the window `kill_process` returns. */
export const PROCESS_OUTPUT_TAIL = 50;

/** The end of a process's output, polled while it runs. Never the full output: it can be megabytes. */
export function useProcessOutputTail({
  workspaceId,
  threadId,
  pid,
}: {
  workspaceId: string;
  threadId: string;
  pid: string;
}) {
  return useSandboxProcess({
    workspaceId,
    threadId,
    pid,
    tail: PROCESS_OUTPUT_TAIL,
    queryOptions: { refetchInterval: ({ state }) => pollWhileRunning(state.status, state.data?.running ?? false) },
  });
}
