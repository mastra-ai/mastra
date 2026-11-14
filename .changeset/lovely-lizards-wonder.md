---
'@mastra/client-js': minor
---

Added client methods to list, read or kill background processes in a workspace sandbox.

```ts
const workspace = client.getWorkspace('my-workspace');
const { processes } = await workspace.listSandboxProcesses({ threadId });
const { stdout } = await workspace.getSandboxProcess(processes[0].pid, { threadId, tail: 100 });
await workspace.killSandboxProcess(processes[0].pid, { threadId });
```
