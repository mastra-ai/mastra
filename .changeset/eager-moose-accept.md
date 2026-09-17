---
'@mastra/client-js': patch
---

Fixed `agent.stream()` cancellation in `@mastra/client-js`. Cancelling the returned stream (`response.body.cancel()`) now aborts the underlying HTTP request and stops any pending client-tool executions and follow-up requests, instead of only detaching the consumer. Added a per-call `abortSignal` option to `stream()`, `streamUntilIdle()`, `resumeStream()`, `resumeStreamUntilIdle()`, `approveToolCall()`, `declineToolCall()`, `streamLegacy()`, `generate()` and `generateLegacy()`. Aborted requests are no longer retried, including while waiting on retry backoff. Fixes #24271.

```ts
const controller = new AbortController();

const response = await agent.stream('Write a long story', {
  abortSignal: controller.signal,
});

// Later: aborts the HTTP request and any pending client-tool continuations
controller.abort();

// Cancelling the body has the same effect
const reader = response.body.getReader();
await reader.cancel();
```
