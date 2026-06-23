---
'@mastra/core': patch
---

Make the evented workflow engine safe for agent streams that carry non-serializable runtime state.

- Agent streams no longer drop or flatten `Date`, `Error`, `Map`, `Set`, `RegExp`, `URL`, `BigInt`, `undefined`, or registered class instances (e.g. `GeneratedFile`) when workflow events travel across the cross-process pubsub broker.
- New per-run `RunScope` on `Mastra` keeps live runtime handles (message lists, memory, tools, background tasks, transports, …) off the wire entirely. The scope is keyed by `runId`, never persisted, never published, and is released when the run ends.
- Migrated the agent's `prepare-stream`, `agentic-execution`, and `agentic-loop` workflow steps onto this scope. The legacy `_internal` field on `streamVNext()` options is still accepted as bootstrap input — it is hydrated into the scope once and marked `@deprecated`; no caller changes are required.

Resolves intermittent `getFullOutput is not a function` and `Workflow not found` errors on multi-instance deployments running the evented workflow engine.
