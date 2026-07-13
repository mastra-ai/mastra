---
'@mastra/memory': patch
---

Skip thread-scoped memory processors when the runtime has no thread context.

**What changed**

- `observational-memory` and `working-memory-state` are only added to `getInputProcessors` / `getOutputProcessors` when `requestContext`'s `MastraMemory` payload carries a `thread.id`. Previously the factories always attached the processors, which then threw at runtime with "requires Mastra memory with an active resourceId and threadId" as soon as they ran without a thread.

**Why**

Ephemeral agent invocations (workflow agent steps, sub-agent tool calls) don't have — and don't need — a persistent chat thread. The processors are thread-scoped by design, so the correct behavior when no thread is present is to no-op, not to throw and abort the call.
