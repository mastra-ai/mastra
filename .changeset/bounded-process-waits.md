---
'@mastra/core': patch
---

Fixed agents getting stuck waiting on a background command that never exits. The `get_process_output` workspace tool now waits for a set time instead of waiting forever.

`wait: true` is replaced by `waitSeconds` (1 to 300). If the process is still running when the wait ends, the tool returns the output so far, says how long it waited, and tells the agent to call again or use `kill_process`. The process keeps running.

```ts
// Before: blocks until the process exits, however long that takes
{ pid, wait: true }

// After: waits up to 60 seconds, then returns the output so far
{ pid, waitSeconds: 60 }
```

Update any agent instructions or skills that tell the agent to pass `wait: true`. It is now ignored, and the tool returns right away.
