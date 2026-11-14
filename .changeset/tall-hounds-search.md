---
'@mastra/react': minor
---

Added hooks to manage background processes in a workspace sandbox: `useSandboxProcesses`, `useSandboxProcess` and `useKillSandboxProcess`.

```tsx
import { useKillSandboxProcess, useSandboxProcess, useSandboxProcesses } from '@mastra/react/hooks/workspace';

const { data } = useSandboxProcesses({ workspaceId, threadId, queryOptions: { refetchInterval: 2000 } });
const output = useSandboxProcess({ workspaceId, pid, threadId, tail: 100 });
const kill = useKillSandboxProcess();

const onKill = () => {
  const pid = data?.processes[0]?.pid;
  if (pid) kill.mutate({ workspaceId, pid, threadId });
};
```

`useBackgroundTaskStream` now keeps each task's latest output chunks on `task.output` instead of dropping them. Set `maxOutputChunks` to change how many are kept (200 by default).
