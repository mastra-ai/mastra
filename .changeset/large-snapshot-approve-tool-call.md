---
'@mastra/core': patch
---

Fix `agent.approveToolCall()` / `declineToolCall()` / `resumeStream({ toolCallId })` wrongly throwing `AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED` for a genuinely-suspended run when the workflow snapshot is large. The suspension is persisted to the nested `executionWorkflow` row before the parent `agentic-loop` row that resume validation reads, and the `tool-call-approval` chunk is emitted before either row is durable — so a client approving immediately could be rejected once the snapshot write outran the previous fixed 2s validation deadline (write time scales with snapshot size). The validator now waits for the parent row to carry the suspension keyed to observed persistence (also consulting the nested row and run liveness), while still rejecting a stale/non-suspended `toolCallId` promptly.
