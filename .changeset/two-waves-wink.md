---
'@mastra/core': minor
---

Changed background process output retention.

**Before:** Spawned process handles retained all stdout and stderr, which could grow without bound for long-running background processes.

**After:** Spawned process handles now retain the latest 1 MiB of stdout and stderr per stream by default. Pass `maxRetainedBytes` to `processes.spawn()` to customize the limit, use `0` to disable retained polling output, or use `Infinity` to keep the previous retain-all behavior.

```ts
const handle = await sandbox.processes.spawn('npm run dev', {
  maxRetainedBytes: 512 * 1024,
});
```

Streaming callbacks and reader streams still receive every chunk in full. Handles also expose truncation and dropped-byte counters so callers can detect when `stdout`, `stderr`, or `wait()` results only include retained output.

The built-in `executeCommand()` implementation still retains full output by default; pass `maxRetainedBytes` there only when you want bounded command results.
