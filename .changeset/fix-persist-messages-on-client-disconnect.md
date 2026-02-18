---
"@mastra/core": patch
"@mastra/server": patch
---

Fixed a bug where partial assistant messages were lost when a client disconnects mid-stream (e.g. browser refresh during response). Three issues were causing this:

- **No `case 'abort':` handler in stream transformer**: `MastraModelOutput` only handled `finish` and `error` chunks — the `abort` chunk produced on client disconnect was silently ignored, so `runOutputProcessors()` (which triggers `MessageHistory` → `storage.saveMessages()`) never ran.

- **Abort detection missed provider-specific errors**: The check relied on `isAbortError()` which only matches standard `AbortError`. Providers like Groq throw "Client connection prematurely closed" instead, so the abort chunk was never produced. Now any error while `abortSignal.aborted` is true is treated as an abort.

- **Server stream handlers never called `consumeStream()`**: The stream wasn't consumed to completion when the HTTP response was cancelled by client disconnect. Added `consumeStream()` in the stream, approve-tool-call, and decline-tool-call handlers.
