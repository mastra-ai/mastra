---
'@mastra/memory': patch
---

Agents using observational memory or working-memory state signals no longer fail when invoked without a chat thread.

Ephemeral agent invocations (workflow agent steps, sub-agent tool calls) don't have — and don't need — a persistent chat thread, but the `observational-memory` and `working-memory-state` processors previously threw "requires Mastra memory with an active resourceId and threadId" the moment they ran without one, aborting the call.

Both processors now handle the no-thread case gracefully at execution time: observational memory returns the message list unchanged when no thread context resolves, and working-memory state-signal computation skips when thread/resource identity is unavailable. A genuinely missing memory instance still errors as before, and threaded invocations behave exactly as they did. Processor discovery (`getInputProcessors` / `getOutputProcessors`) attaches both processors unconditionally, so discovery also works before the runtime memory context is populated.
