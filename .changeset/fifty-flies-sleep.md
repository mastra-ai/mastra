---
'@mastra/core': patch
---

Fixed thread subscribers seeing a run as `failed` when `mastra.shutdown()` handed it back mid-run, for example during a rolling restart, even though durable recovery then finished the same run. `subscribeToThread({ withRunStatus: true })` now reports that hand-back as `{ status: "interrupted" }`, which is not final, so the recovered output and its final status follow on the same subscription. A real failure still reports `failed`. Fixes [#30480](https://github.com/mastra-ai/mastra/issues/30480).

```ts
for await (const chunk of subscription.stream) {
  if (chunk.type === 'thread-run-status' && chunk.payload.status === 'interrupted') {
    // Show "recovering" and keep listening for the final outcome.
  }
}
```
