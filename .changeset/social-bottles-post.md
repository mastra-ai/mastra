---
'@mastra/client-js': patch
---

Fix per-call `abortSignal` cancellation so it stops durable runs when streaming, resuming, or approving or declining tool calls. Cancelling `response.body` or the client-wide signal only stops receiving updates and does not cancel the run. With older servers, per-call cancellation closes the stream and preserves `AbortError` handling.
