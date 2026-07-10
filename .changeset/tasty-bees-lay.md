---
'@mastra/core': patch
'@mastra/deployer': patch
---

Added durable-agent recovery for orphaned RUNNING runs after process restart.

**What changed**

- `DurableAgent.listActiveRuns()` — discover in-flight durable runs for an agent from persistent storage, filtered by agentId, threadId, and resourceId (mirrors `listSuspendedRuns` but for `running` status).
- `DurableAgent.recover(runId, options?)` — rehydrate a single orphaned run's non-serializable state (`MessageList`, model, tools, memory, `SaveQueueManager`, processors, request context, agent span, `BackgroundTaskManager` + agent background-tasks config) from its persisted workflow snapshot, re-subscribe to the pubsub topic, and re-drive the workflow in the background. Returns the same `{ output, fullStream, runId, threadId, resourceId, cleanup, abort }` shape as `stream()`/`resume()`, so callers can stream the recovered response or attach later via `observe(runId)`. Memory writes flow through the rebuilt `SaveQueueManager` exactly like a fresh run.
- `DurableAgent.recoverActiveRuns(options?)` — bulk recovery hook that delegates to `recover(runId)` for each in-flight run discovered via `listActiveRuns()` (or a caller-supplied `runId`), awaits each workflow settlement, and returns `{ recovered, succeeded, failed }` counts. Use this on boot to drain the backlog; use `recover()` when you want to stream a specific run.
- The default workflow engine now persists `running` snapshots for the durable agentic loop, with a guard that prevents a `running` write from overwriting an already-`suspended` snapshot for the same run. Without this, `listActiveRuns()` would never see a live durable run in storage.
- Background-task state is re-wired on recovery so the `bg-task-check` step waits for pre-crash in-flight tasks (still tracked in `BackgroundTaskManager` storage), the `tool-call` step can still dispatch new tools as background tasks, and `llm-execution` still injects the background-task system prompt. Without this, the recovered segment would silently run with background-tasks disabled and could end before storage-backed tasks delivered their tool-result chunks.
- Snapshot rows are now deleted after a durable run reaches any non-suspended terminal status — this applies to `stream`/`generate` (the initial `run.start()`), `resume()`, `recover()`, and `recoverActiveRuns()`. Suspended terminals still keep their snapshots so a later resume/recover can find them. Mirrors the existing loop-stream cleanup so snapshot storage doesn't grow one stale row per completed durable run.
- `Mastra.recoverAllDurableAgents()` — new server-level fan-out that walks every registered agent, filters those exposing `recoverActiveRuns()` (default-engine `DurableAgent` only — Inngest and other externally-executed durable wrappers run their own recovery), and aggregates `{ agents, recovered, succeeded, failed }` counts. A per-agent failure is logged and skipped so one bad agent doesn't stop the rest.
- New `MastraConfig.recovery` option: `recovery?: { durableAgents?: 'auto' | 'off' }` (default `'off'`). When set to `'auto'`, the deployer's `/__restart-active-workflow-runs` boot handler will invoke `mastra.recoverAllDurableAgents()` right after `restartAllActiveWorkflowRuns()`, so both user workflows and durable-agent runs are re-driven from the same boot hook the CLI/deployer already call. Also exposed as `mastra.recoveryConfig` for callers who want to gate their own recovery pipelines on it.
- Recovery is opt-in on purpose. Auto-recovery re-runs the agentic loop from the last persisted snapshot, so it re-issues LLM calls (real cost) and re-executes tool calls (must be idempotent); in multi-instance deploys every replica will race to recover the same runs until a lease/lock is added. Leave `'off'` and call `mastra.recoverAllDurableAgents()` (or the per-agent APIs) from a cron, a leader-elected worker, or an admin endpoint if you need finer control.

**Why**

Previously, the durable agent's agentic loop was an awaited in-process Promise and `globalRunRegistry` was an in-memory TTLCache, so any RUNNING run silently died on process restart with no boot-time recovery or re-drive API (see issue #19056). Suspended runs already had `prepare`/`resume`/`listSuspendedRuns`; RUNNING runs now have the equivalent discover-and-recover pair.

**Usage**

```ts
// Opt into boot-time recovery for every durable agent on this Mastra instance.
// The deployer will call `mastra.recoverAllDurableAgents()` automatically
// after restarting active workflow runs.
const mastra = new Mastra({
  agents: { support: supportDurableAgent },
  storage,
  recovery: { durableAgents: 'auto' },
});

// Or drive it yourself (cron, leader election, admin endpoint, etc.):
const { agents, recovered, succeeded, failed } = await mastra.recoverAllDurableAgents();

// Per-agent: drain all orphaned RUNNING runs on one agent.
const agent = mastra.getAgent('support') as DurableAgent;
await agent.recoverActiveRuns();

// Per-run: recover a specific run and stream its output to the caller.
const { fullStream, runId, cleanup } = await agent.recover('run-abc123');
for await (const chunk of fullStream) {
  // forward chunks to the client, log them, etc.
}
cleanup();
```
