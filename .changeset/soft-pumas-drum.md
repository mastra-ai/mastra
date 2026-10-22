---
'@mastra/core': minor
---

Added `get(pid, { release: false })` to the sandbox process manager. It reads a process without dismissing it once it has exited, so one reader can look at a finished command's output without taking it from another, such as the agent that started it. The default is unchanged.

```ts
// Show a finished command's output without dismissing it
const handle = await sandbox.processes.get(pid, { release: false })
console.log(handle?.stdout)
```
