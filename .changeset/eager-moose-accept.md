---
'@mastra/client-js': patch
---

Fixed `agent.stream()` cancellation in `@mastra/client-js`. Cancelling a returned stream now aborts the underlying HTTP request and stops pending client-tool executions and follow-up requests. Fixes #24271.

Added a per-call `abortSignal` option to `stream()`, `streamUntilIdle()`, `resumeStream()`, `resumeStreamUntilIdle()`, `approveToolCall()`, `declineToolCall()`, `streamLegacy()`, `generate()` and `generateLegacy()`. It is merged with the client-wide `abortSignal`, and aborted requests are not retried.

```ts
const controller = new AbortController();
const response = await agent.stream('Hello', { abortSignal: controller.signal });
// later
controller.abort();
```
