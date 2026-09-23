---
'@mastra/core': patch
'mastracode': patch
'@mastra/code-sdk': patch
---

# Isolate tool approvals by thread and run

Approval gates are now keyed by tool call and tagged with the thread and run that opened them, so concurrent runs cannot overwrite, strand, or answer each other's gates. Abort and user-message interjection release only the current thread's gates, and detached-thread approvals no longer fire notifications or permission hooks.

## Approval responses must name the tool call

Resolving a parked gate now requires its `toolCallId`. Without the id a response could release whichever gate happened to be parked — another thread's or another run's — so an id-less response is rejected instead of silently applying. Every caller inside the repo already passes the id; this only affects external callers of the session API.

Before:

```ts
session.respondToToolApproval({ decision: 'approve' });
```

After:

```ts
session.respondToToolApproval({ decision: 'approve', toolCallId });
```

Similarly, `SessionApproval.arm()` now requires a `toolCallId`, and `getToolCallId()` is replaced by `getToolCallIds()` (which accepts an optional thread/run filter).