---
'@mastra/core': patch
---

Added durable-agent recovery for orphaned RUNNING runs after process restart.

**What changed**

- `DurableAgent.listActiveRuns()` — discover in-flight durable runs for an agent from persistent storage, filtered by agentId, threadId, and resourceId (mirrors `listSuspendedRuns` but for `running` status).
- `DurableAgent.recoverActiveRuns()` — re-drives each active run in storage by calling `workflow.createRun({ runId }).restart()`, so agentic loops that were interrupted by a deploy or crash resume without user intervention.
- The default workflow engine now persists `running` snapshots for the durable agentic loop, with a guard that prevents a `running` write from overwriting an already-`suspended` snapshot for the same run.
- Snapshot rows are now deleted after a durable run reaches any non-suspended terminal status — this applies to `stream`/`generate` (the initial `run.start()`), `resume()`, and `recoverActiveRuns()`. Suspended terminals still keep their snapshots so a later resume/recover can find them. Mirrors the existing loop-stream cleanup so snapshot storage doesn't grow one stale row per completed durable run.

**Why**

Previously, the durable agent's agentic loop was an awaited in-process Promise and `globalRunRegistry` was an in-memory TTLCache, so any RUNNING run silently died on process restart with no boot-time recovery or re-drive API (see issue #19056). Suspended runs already had `prepare`/`resume`/`listSuspendedRuns`; RUNNING runs now have the equivalent discover-and-recover pair.

**Usage**

```ts
// After boot, recover any RUNNING durable runs orphaned by the last shutdown.
const agent = mastra.getAgent('support') as DurableAgent;
const { recovered, failed } = await agent.recoverActiveRuns();
```
