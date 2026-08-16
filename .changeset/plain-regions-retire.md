---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/pulse': patch
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed Pulse abort attribution and data loss (experimental).

**Exact abort attribution.** Session abort facts now carry the aborted run's id, and every layer (writer accumulators, in-memory reads, flow status) joins on it exactly — an abort flips only the flow that contains that run. Previously a thread-plus-2-second window could mark the wrong flow (or several) as aborted; that heuristic remains only as a fallback for rows captured before run ids existed. Deleting a session mid-run no longer loses the abort fact.

**No more silent data loss.**

- `observability.flush()` now transitively drains the pulse writers, so durable/serverless engines that freeze after a flush lose nothing.
- `Mastra.shutdown()` closes storage after the final pulse batch is written (was: before).
- One unserializable record no longer discards its whole batch — failed batches fall back to per-record writes.
- Dropped batches now surface as `events_dropped` pulse rows once storage recovers, and post-shutdown emits are dropped loudly instead of buffered forever.

**A real relationship graph.** Structure edges (`origin_of`, `parent_of`) are emitted at span start (running flows have a tree), every trace-bearing pulse gets a `flow_contains` membership edge, and all `pulse` endpoints now reference pulse record ids — the graph joins on `pulses.id`. External endpoints gained a `system` field and relationships a `metadata` field.

Standalone AgentControllers now attach session forwarding when a parent Mastra registers later.
