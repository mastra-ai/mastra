# Exploration Log

## 2026-06-18 - Initial Fit Pass

Read:

- `pulse/AGENTS.md`
- `pulse/README.md`
- `pulse/code_audit/11-pulse-applicability-review.md`
- selected raw audit files: `07`, `08`, `09`, `10`

Assumptions used:

- A Pulse is not a span. Start/end-style events can exist as paired point-in-time Pulses, but duration remains derived from timestamps.
- The top-level `type` is semantic: `input`, `output`, `decision`, `error`, `state`, `progress`, `reasoning`, `system`.
- Runtime primitive category belongs in `attributes`, not `type`.
- Primitive identity should be lean and preferably inherited from parent/root rather than repeated on every child Pulse.
- Storage/query/admin internals should not emit Pulse initially unless failure or result is directly visible inside a user primitive run.

Tried:

1. Mapping raw candidate names directly into `type`.
   - Rejected. Names like `tool.execute_started`, `model_stream.transport_resolved`, and `task_state_signal.snapshot_emitted` are useful event names, but they are too component-specific for top-level `type`.
   - Better fit: put the specific event name in `attributes.event` or a future `name` field, while `type` stays semantic.

2. Treating start/end as implicit spans.
   - Rejected. It recreates spans if every operation becomes `{start,end,duration}`.
   - Better fit: emit point Pulses for meaningful boundaries: `input` when work is accepted, `output` when result exists, `error` when it fails, `decision` when runtime chooses a branch.

3. Putting token counts, retry counts, chunk counts, and status counters into `data`.
   - Accepted when the number is directly measured at the moment of the Pulse.
   - Explicitly avoided duration. Duration is derived from paired Pulse timestamps.

4. Putting primitive kind into top-level `type`.
   - Rejected. `agent`, `workflow`, `tool`, `model`, `processor`, `scorer` are runtime surfaces, not semantic Pulse types.
   - Better fit: `attributes.primitive.type = "agent"` or `attributes.surface = "agent"`.

5. Emitting storage pulses for every persistence operation.
   - Mostly rejected for initial scope.
   - Better fit: primitive callers emit `state` or `error` Pulses when persistence changes user primitive behavior.

Early pattern:

- `input`: a primitive receives user/model/tool/workflow input.
- `decision`: runtime selects a path, policy, model, transport, provider, resume branch, retry, fallback, or state-signal mode.
- `state`: durable/user-visible state changes: memory, task list, working memory, workflow snapshot, suspension.
- `progress`: streaming/chunk/long-running lifecycle.
- `output`: primitive result, model response, tool result, scorer score, posted channel reply.
- `error`: thrown/returned failure, validation failure, provider failure, denied policy.

Risk noticed:

- The current shape lacks a clear place for a stable event name. For exploration, examples use `attributes.event`. This may become noisy and query-hostile if not standardized.

