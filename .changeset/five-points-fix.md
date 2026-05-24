---
'@mastra/core': patch
---

**Cancellation now propagates through the subagent tree.** When `Session.cancel(...)` runs on a parent, every live subagent registered on `_activeSubagents` receives its own `cancel({reason})` call. Cancellation is one-directional — a subagent cancel does NOT propagate up to the parent. Children's own queued items get dropped and their resolvers rejected per the existing primitive.

**Resume gating.** `respondToToolApproval / respondToToolSuspension / respondToQuestion / respondToPlanApproval / respondToSandboxAccess` now refuse to resume when a durable `cancelRequest` committed before the resume reached the CAS. The caller sees `HarnessSessionCancelledError` instead of a silent no-op.
