---
'@mastra/core': patch
---

Improved Pulse identity and record shape (experimental).

**Deterministic pulse ids.** Span-lane pulse ids are now computed from (traceId, spanId, phase) instead of random. A resumed run in a new process can address the suspended span's pulse by recomputing its id — cross-process `resume_of` edges land on real pulse ids with no placeholder references. Re-exported spans also produce identical ids instead of duplicate rows.

**Single home for join keys.** `runId`/`threadId`/`resourceId` live only as top-level fields now; the duplicated copies in `metadata` were removed.

**Spec-aligned naming.** The session lane's terminal pulse is now `agent.run_finished` (with the reason as an attribute), matching the Pulse design docs, instead of `agent_controller.agent_end`.
