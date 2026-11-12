---
'@mastra/react': minor
---

Added hooks to cancel background tasks and to manage background processes in a workspace sandbox: `useCancelBackgroundTask`, `useSandboxProcesses`, `useSandboxProcess` and `useKillSandboxProcess`.

```tsx
import { useCancelBackgroundTask } from '@mastra/react/hooks/agents';
import { useKillSandboxProcess, useSandboxProcess, useSandboxProcesses } from '@mastra/react/hooks/workspace';

const cancel = useCancelBackgroundTask();
const { data } = useSandboxProcesses({ workspaceId, threadId, queryOptions: { refetchInterval: 2000 } });
const output = useSandboxProcess({ workspaceId, pid, threadId, tail: 100 });
const kill = useKillSandboxProcess();

const onCancel = () => cancel.mutate(taskId);
const onKill = () => {
  const pid = data?.processes[0]?.pid;
  if (pid) kill.mutate({ workspaceId, pid, threadId });
};
```

`useBackgroundTaskStream` now keeps each task's latest output chunks on `task.output` instead of dropping them. Set `maxOutputChunks` to change how many are kept (200 by default).

A cancelled background task no longer reads as running in chat messages: its call is marked `cancelled` when the `background-task-cancelled` event arrives.
