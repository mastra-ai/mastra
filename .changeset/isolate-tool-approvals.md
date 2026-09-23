---
'@mastra/core': patch
'mastracode': patch
'@mastra/code-sdk': patch
---

**Tool approvals can no longer cross threads or runs.** Concurrent and detached approvals stop overwriting, stranding, or answering each other's gates: gates are keyed by tool call and tagged with the thread and run that opened them, abort and user-message interjection release only the current thread's gates, detached-thread approvals no longer fire notifications or permission hooks, and an approved run resumes against the thread, run, resource, and agent that actually parked it.

**Responding to a gate now requires its `toolCallId`.** Without the id, a response could release whichever gate happened to be parked — another thread's or another run's — so an id-less response is rejected instead of silently applied. Every caller inside the repo already passes the id; this only affects external callers of the session API.

Before:

```ts
session.respondToToolApproval({ decision: 'approve' });
```

After:

```ts
session.respondToToolApproval({ decision: 'approve', toolCallId });
```

Similarly, `SessionApproval.arm()` now requires a `toolCallId`, and `getToolCallId()` is replaced by `getToolCallIds()` (which accepts an optional thread/run filter).
