---
'@mastra/core': minor
---

Added an `interrupted` thread run status. Thread subscribers no longer see a durable agent's run as `failed` when `mastra.shutdown()` stops it mid-run, for example during a rolling restart, and recovery then finishes the same run. `subscribeToThread({ withRunStatus: true })` now reports that run as `{ status: "interrupted" }`, which is not final, so the recovered output and its final status follow on the same subscription. If nothing recovers the run, for example because recovery is off, `interrupted` is the last status. A real failure still reports `failed`, and so does a regular agent's run that shutdown stops, because nothing recovers it. Fixes [#30480](https://github.com/mastra-ai/mastra/issues/30480).

```ts
for await (const chunk of subscription.stream) {
  if (chunk.type === "thread-run-status" && chunk.payload.status === "interrupted") {
    // Show "recovering" and keep listening for the final outcome.
  }
}
```

`useChat` from `@mastra/react` still treats `interrupted` as the end of the run.
