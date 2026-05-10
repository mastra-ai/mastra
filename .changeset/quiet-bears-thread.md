---
'@mastra/core': minor
---

Harness v1: ship the user-facing Session and Harness surface for MastraCode-class agent runtimes. Adds:

- Session events (agent_start/text_delta/tool_start/tool_end/agent_end, mode_changed, model_changed, session_closed, suspension_required/resolved) and a Harness-level event firehose that forwards session events with id/timestamp/sessionId preserved.
- `Session.queue()` — durable FIFO with per-turn model/mode overrides, atomic capacity check + append, and `queue_item_started` / `queue_item_replayed` events including crash-replay on rehydration.
- `Session.getState()` / `Session.setState()` with object + functional forms, and a full `HarnessRequestContext` slot (identity, state, abort signal, event emission) injected into every tool call via `agent.stream/generate`'s `requestContext` option. Custom events are validated for reserved prefixes and JSON-serializability.
- `harness.threads` CRUD (`create`, `list`, `get`, `rename`, `clone`, `selectOrCreate`, `delete`) backed by Mastra's memory storage domain. `delete` cascades to the live session via `_closeSession`. Emits `thread_created` / `thread_renamed` / `thread_cloned` / `thread_deleted` lifecycle events. Resource scoping is enforced — cross-resource access never leaks.
- Method renames to match spec: `setMode` → `switchMode({ mode })`, `setModel` → `switchModel({ model })`, `respondToolApproval` → `respondToToolApproval`, `respondToolSuspension` → `respondToToolSuspension`, `respondToolQuestion` → `respondToQuestion`, `respondPlanApproval` → `respondToPlanApproval`.
- Standalone Harness construction (`new Harness({ agents })`) now defaults to `InMemoryStore` so both the harness storage domain and the memory domain (used by thread CRUD) work without the caller wiring a composite by hand.
- New error classes: `HarnessQueueFullError`, `HarnessEventSerializationError`, `HarnessThreadNotFoundError`.
