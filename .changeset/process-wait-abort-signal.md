---
'@mastra/core': patch
---

Couple the blocking wait in get_process_output to the run's abortSignal: ProcessHandle.wait() now accepts abortSignal and kills the process on abort (the same convention the process manager applies at spawn time), and the workspace tool forwards context.abortSignal, so aborting a run no longer leaves the tool blocking on a background process.

```ts
const controller = new AbortController();

const result = await handle.wait({
  abortSignal: controller.signal,
});

// controller.abort() kills the process and wait() resolves with its exit result
```
