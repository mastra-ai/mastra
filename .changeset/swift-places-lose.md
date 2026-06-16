---
'@mastra/core': patch
---

Fixed parallel sub-agent delegations that require approval. When a supervisor agent delegated the same sub-agent twice in a single step (for example, issuing two refunds in parallel), approving them one at a time only ran the first delegation. The second failed to resume with an "AGENT_RESUME_NO_SNAPSHOT_FOUND" error, and on a page refresh the second delegation's approval was lost entirely.

Now each delegation tracks its own suspended run, so approving both parallel delegations runs both of them, both during a live session and after reloading.

**Before**

```ts
// Supervisor delegates two refunds to the billing agent in one step
await supervisor.stream('Refund order A and order B in parallel.');

// Approving each one by one
await supervisor.approveToolCall({ runId, toolCallId: callA }); // runs refund A
await supervisor.approveToolCall({ runId, toolCallId: callB }); // error: AGENT_RESUME_NO_SNAPSHOT_FOUND, refund B never runs
```

**After**

```ts
await supervisor.approveToolCall({ runId, toolCallId: callA }); // runs refund A
await supervisor.approveToolCall({ runId, toolCallId: callB }); // runs refund B
```
