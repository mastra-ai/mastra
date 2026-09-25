---
'@mastra/core': patch
'mastracode': patch
'@mastra/code-sdk': patch
---

**Tool approvals can no longer cross threads or runs.** Concurrent and detached approvals stop overwriting, stranding, or answering each other's gates: gates are keyed by tool call and tagged with the thread and run that opened them, abort and user-message interjection release only the current thread's gates, detached-thread approvals no longer fire notifications or permission hooks, and an approved run resumes against the thread, run, resource, agent, and cancellation signal that actually parked it — so a mode switch, resource re-scope, or a successor run cannot redirect or cancel the parked continuation.

**Approval responses now require the gate's `toolCallId`.** Without the id, a response could release whichever gate happened to be parked — another thread's or another run's — so an id-less response is rejected instead of silently applied. Every caller inside the repo already passes the id; this only affects external callers of the session API.

Before:

```ts
session.respondToToolApproval({ decision: 'approve' });
```

After:

```ts
session.respondToToolApproval({ decision: 'approve', toolCallId });
```

Similarly, `SessionApproval.arm()` now requires a `toolCallId`, and `getToolCallId()` is replaced by `getToolCallIds()` (which accepts an optional thread/run filter).

**"Always allow" grants are now scoped to the gate's thread.** Approving with `always_allow_category` grants the tool's category to the thread that owns the gate rather than the whole session, so a background thread's approval cannot widen what the current thread may run without prompting. `grantCategory`, `grantTool`, `hasCategoryGrant`, `hasToolGrant`, and `getGrants` accept an optional `threadId`; passing one scopes the grant to that thread, omitting it keeps the existing session-wide behavior for embedders that grant explicitly.
