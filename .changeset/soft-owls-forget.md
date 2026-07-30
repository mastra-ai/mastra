---
'@mastra/memory': patch
---

Thread-scoped processors no-op gracefully when there is no thread.

The `observational-memory` and `working-memory-state` processors previously threw at runtime with "requires Mastra memory with an active resourceId and threadId" the moment they ran without a thread. Ephemeral agent invocations (workflow agent steps, sub-agent tool calls) don't have — and don't need — a persistent chat thread, so the correct behavior when no thread is present is to no-op, not to throw and abort the call.

Both processors remain attached by `getInputProcessors` / `getOutputProcessors` unconditionally (processor discovery can run before the runtime `MastraMemory` payload is populated, and direct discovery calls may not carry a `RequestContext` at all). Instead, the no-thread case is handled at execution time: observational memory already returned the message list unchanged when no thread context resolves, and working-memory state-signal computation now skips gracefully when thread/resource identity is unavailable at runtime. A genuinely missing memory instance still errors as before.
